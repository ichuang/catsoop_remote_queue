const path = require('path');

const socketio = require('socket.io');

const authentication = require('./authentication');
const db = require('./rethinkdb');
const log = require('./log');
const util = require('./util');
const entry_types = require('./entry_types');
const params = require('../config/params');

const default_options = {
    url_root: '',
};

Promise.map = function(iter, func) {
    const promises = [];
    iter.forEach(item => promises.push(func(item)));
    return Promise.all(promises);
};

Promise.prototype.map = function(func) {
    return this.then(iter => {
        const promises = [];
        iter.forEach(item => promises.push(func(item)));
        return Promise.all(promises);
    });
};

module.exports = function make_queue(server, user_options) {
    /// Set up globals
    const options = Object.assign({}, default_options, user_options);
    const io = socketio(server, {path: path.join(options.url_root, 'socket.io')});
    const SOCKETS = {};
    const USERS = {};
    const LOCKS = {};
    const STAFF_SETS = {};
    const ENTRIES = {};

    function broadcast(room, message_name, message_content) {
        Object.keys(SOCKETS[room]).forEach(username => {
            SOCKETS[room][username].forEach(socket => {
                socket.emit(message_name, message_content);
            });
        });
    }

    /// Staff List functions

    function remove_from_all_rooms(username) {
        for (let room of Object.keys(STAFF_SETS)) {
            STAFF_SETS[room].unconfirmed.delete(username);
            STAFF_SETS[room].confirmed.delete(username);

            broadcast(room, 'staff_list', {
                checked_in: [],
                logged_in: [],
                removed: [username],
            });
        }
    }

    function log_in(username, room) {
        remove_from_all_rooms(username);

        // Move from removed to unconfirmed
        STAFF_SETS[room].unconfirmed.add(username);

        broadcast(room, 'staff_list', {
            checked_in: [],
            logged_in: [username],
            removed: [],
        });
    }

    function check_in(username, room) {
        remove_from_all_rooms(username);

        // Move from unconfirmed to confirmed
        STAFF_SETS[room].unconfirmed.delete(username);
        STAFF_SETS[room].confirmed.add(username);

        USERS[username].confirmed = true;

        broadcast(room, 'staff_list', {
            checked_in: [username],
            logged_in: [],
            removed: [],
        });
    }

    function check_out(username, room) {
        remove_from_all_rooms(username);

        // Move from confirmed to removed
        STAFF_SETS[room].confirmed.delete(username);

        USERS[username].confirmed = false;

        broadcast(room, 'staff_list', {
            checked_in: [],
            logged_in: [],
            removed: [username],
        });
    }

    /// Initialize global data
    for (let room of params.ROOMS) {
        SOCKETS[room] = {};
        LOCKS[room] = false;
        STAFF_SETS[room] = {
            confirmed: new Set(),
            unconfirmed: new Set(),
        };
        ENTRIES[room] = {};
    }

    /// Get the current state of the queue
    db.table('queue')
      .then(docs => docs.forEach(doc => {
	  log.info("[queue init] doc=", doc);
	  try {
              ENTRIES[doc.room][doc.username] = new (entry_types[doc.type])(doc);
	  } catch(err){
	      log.info("[queue init] err", err);
	  }
          if (doc.data.claimant) {
              USERS[doc.data.claimant] = {claims: new Set([doc.username])};
          }
      }))
      .then(() => {
          /// Start listening for database changes
          params.ROOMS.forEach(room => {
              db.table('queue').filter({room: room}).changes().run((err, cursor) => {
                  if (err) throw err;
                  cursor.each((err, change) => {
                      let doc, msg_fn;
                      if (change.new_val === null) {
                          doc = change.old_val;
                          let entry = ENTRIES[doc.room][doc.username];
                          delete ENTRIES[doc.room][doc.username];
                          msg_fn = (user) => Promise.resolve({
                              added_entries: [],
                              edited_entries: [],
                              deleted_usernames: [
                                  entry.visible_to(user)
                                  ? entry.username
                                  : util.hash_username(entry.username),
                              ],
                          });
                      }
                      else if (change.old_val === null) {
                          doc = change.new_val;
                          let entry = new (entry_types[doc.type])(doc);
                          ENTRIES[doc.room][doc.username] = entry;
                          msg_fn = (user) => entry.render(user, USERS).then(rendered => ({
                              added_entries: [rendered],
                              edited_entries: [],
                              deleted_usernames: [],
                          }));
                      }
                      else {
                          doc = change.new_val;
                          let entry = Object.assign(ENTRIES[doc.room][doc.username], doc);
                          msg_fn = (user) => entry.render(user, USERS).then(rendered => ({
                              added_entries: [],
                              edited_entries: [rendered],
                              deleted_usernames: [],
                          }));
                      }

                      for (let username of Object.keys(SOCKETS[room])) {
                          let user = USERS[username];
                          let sockets = SOCKETS[room][username];
                          msg_fn(user).then(msg => {
                              for (let socket of sockets) {
                                  socket.emit('edit', msg);
                              }
                          });
                      }
                  });
              });
          });

          db.table('queue').changes().run((err, cursor) => {
              cursor.each((err, change) => {
                  if (change.old_val
                      && change.old_val.data.claimant
                      && USERS.hasOwnProperty(change.old_val.data.claimant)) {
                      USERS[change.old_val.data.claimant].claims.delete(change.old_val.username);
                  }
                  if (change.new_val
                      && change.new_val.data.claimant
                      && USERS.hasOwnProperty(change.new_val.data.claimant)) {
                      USERS[change.new_val.data.claimant].claims.add(change.new_val.username);
                  }
              });
          });
      });



    /// Start listening for connections
    io.on('connection', (socket) => {
        log.debug('incoming socket connection', {connection: "connect", socket: socket});

        socket.on('authenticate', (msg, cb) => {
            const room = msg.room;
            authentication.validate_auth(msg).then(
                user => {
                    log.info('successful authentication', {authentication: 'success', user: user});
                    let username = user.username;

                    if (USERS.hasOwnProperty(username)) {
                        // Grab the fields we need from the old user data
                        user.claims = USERS[username].claims;
                        user.confirmed = USERS[username].confirmed;

                        // Drop every field on the old user data
                        Object.keys(USERS[username]).forEach(key => {
                            delete USERS[username][key];
                        });

                        // Merge in the fields from the new user data
                        user = Object.assign(USERS[username], user);
                    }
                    else {
                        user.claims = new Set();
                        user.confirmed = false;
                        USERS[username] = user;
                    }

		    log.info("[queue.authenticate] user=", user);
                    util.getOrSet(SOCKETS[room], username, []).push(socket);

                    if (authentication.is_staff(user)) {
                        // Special staff get confirmed automatically
                        if (user.permissions.has('auto_check_in')) {
                            check_in(user.username, room);
                        }
                        else if (!STAFF_SETS[room].confirmed.has(username)) {
                            log_in(user.username, room);
                        }
                    }

                    attach_authorized_handlers(user, socket, room);
                    cb({
                        username: username,
                        token: user.token,
                        permissions: Array.from(user.permissions),
                    });
                },
                (err) => {
                    log.warn('failed authentication', {authentication: 'failure', msg, err});
                    cb({error: 'Invalid authentication'});
                }
            );
        });

        socket.on('disconnect', () => {
            log.debug('disconnected socket', {connection: "disconnect", socket});
        });
    });

    function attach_authorized_handlers(user, socket, room) {
        socket.on('disconnect', () => {
            util.spliceOut(SOCKETS[room][user.username], socket);
        });

        socket.on('get_all', (msg, cb) => {
            db.table('queue')
              .filter({room})
              .filter(msg)
              .orderBy(db.asc('date_added'))
              .then(docs => {
                  return docs
                      .map(doc => new (entry_types[doc.type])(doc));
              })
              .map(entry => entry.render(user, USERS))
              .then(rendered_entries => {
                  cb(rendered_entries);
              })
              .catch(err => log.error('unable to get_all', {err}));
        });

        socket.on('add', (msg, cb) => {
            log.info('new entry', {type: 'add', user, msg, room});
            if (LOCKS[room]) {
                cb({
                    success: false,
                });
                return;
            }

            let entry_class = entry_types[msg.type];
            let data = entry_class.data_skeleton(msg.data, user);
            let now = new Date();

            db.table('queue')
              .insert({
                  username: user.username,
                  type: msg.type,
                  date_added: now,
                  last_modified: now,
                  data: data,
                  room: room,
              }, {
                  conflict: (id, oldDoc, newDoc) => {
                      // If the old room and new room don't match, remove the claimant from both
                      // documents before merging.
                      const same_room = oldDoc('room').eq(newDoc('room'));
                      const old_doc = db.branch(same_room, oldDoc, oldDoc.without({data: 'claimant'}));
                      const new_doc = db.branch(same_room, newDoc, newDoc.without({data: 'claimant'}));

                      // Remove the 'date_added' and 'state' properties from the new document before
                      // the merge so as not to destroy the original date added or entry state.
                      return old_doc.merge(new_doc.without([
                          'date_added',
                          {data: ['state']},
                      ]))
                  },
              })
              .then(() => cb({
                  success: true,
              }))
              .catch(err => log.error('unable to add entry to database', {err}));
        });

        socket.on('action', (msg, cb) => {
            log.info('entry action', {type: 'action', user, msg, room});

            db.table('queue').get(msg.username)
              .then(doc => {
                  if (doc.room !== room) {
                      return;
                  }
                  let entry = ENTRIES[doc.room][doc.username];
                  return entry[msg.action](user);
              })
              .then(() => {
                  cb();
              })
              .catch(err => log.error(`unable to complete action`, {msg, err}));
        });

        socket.on('lock', (msg, cb) => {
            log.info('lock queue', {type: 'lock', user, msg, room});

            if (user.permissions.has('lock')) {
                LOCKS[room] = true;
                Object.keys(SOCKETS[room]).forEach(username => {
                    SOCKETS[room][username].forEach(socket => {
                        socket.emit('locked', LOCKS[room]);
                    });
                });
            }

            cb();
        });

        socket.on('unlock', (msg, cb) => {
            log.info('unlock queue', {type: 'unlock', user, msg, room});

            if (user.permissions.has('lock')) {
                LOCKS[room] = false;
                Object.keys(SOCKETS[room]).forEach(username => {
                    SOCKETS[room][username].forEach(socket => {
                        socket.emit('locked', LOCKS[room]);
                    });
                });
            }

            cb();
        });

        socket.on('get_locked', (msg, cb) => {
            cb(LOCKS[room]);
        });

        socket.on('clear', (msg, cb) => {
            log.info('clear queue', {type: 'clear', user, msg, room});

            if (!user.permissions.has('clear')) {
                cb();
                return;
            }

            db.table('queue')
              .filter({room})
              .delete()
              .then(() => cb())
              .catch(err => log.error(`unable to remove entry for ${user.username}`, {err}));
        });

        socket.on('get_staff_list', (msg, cb) => {
            cb({
                confirmed: Array.from(STAFF_SETS[room].confirmed),
                unconfirmed: Array.from(STAFF_SETS[room].unconfirmed),
            });
        });

        socket.on('check_in', (msg, cb) => {
            log.info('check_in', {type: 'check_in', user, msg, room});
            if (authentication.is_staff(USERS[msg.username])) {
                check_in(msg.username, room);
            }
            cb();
        });

        socket.on('check_out', (msg, cb) => {
            log.info('check_out', {type: 'check_out', user, msg, room});
            if (authentication.is_staff(USERS[msg.username])) {
                check_out(msg.username, room);
            }
            cb();
        });
    }
};
