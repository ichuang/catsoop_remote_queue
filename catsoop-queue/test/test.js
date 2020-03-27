const fs = require('fs');
const http = require('http');
const spawn = require('child_process').spawn;

const io = require('socket.io-client');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const assert = chai.assert;

const params = require('../config/params');
const Client = require('../imports/client.js');

const catsoop = require('./catsoop');


//////////////////////////////////////////////////////////////////////
// server/server.js
//////////////////////////////////////////////////////////////////////

if (!Object.values) {
    Object.values = obj => Object.keys(obj).map(key => obj[key]);
}

function dbReset(r) {
    return r
        .dbList().contains('test')
        .branch(
            r.dbDrop('test'),
            r.expr(null)
        )
        .then(() => r.dbCreate('test'))
        .then(() => r.tableCreate('queue', {primaryKey: 'username'}));
}

function dbStart() {
    return new Promise((resolve, reject) => {
        let db = spawn('rethinkdb',
                   [
                       '--port-offset', params.RETHINKDB.PORT_OFFSET || 0,
                       '--directory', __dirname + '/rethinkdb_data',
                   ],
                   {stdio: 'pipe'});
        db.stdio[1].on('data', data => {
            data.toString().split('\n').forEach(line => {
                if (!line) return;

                console.log(`DB: ${line}`);
                if (/^Server ready/.test(line)) {
                    resolve(db);
                }
            })
        });
    })
}

var PORT;
const options = {
    url_root: '/queue',
};


class User {
    constructor(user_info) {
        Object.assign(this, user_info);
    }

    connect() {
        const client = new Client({
            socket_url: `http://localhost:${PORT}/`,
            socket_path: `${options.url_root}/socket.io/`,
            room: this.room,
        });
        return new Promise((resolve, reject) => {
            client.login(Object.assign({succeed: true}, this), (auth) => {
                resolve(auth);
            });
        }).then((auth) => {
            this.socket = client.socket;
            this.client = client;
        });
    }

    send(name, msg={}) {
        return this.client.send(name, msg);
    }

    recv(name, callback) {
        return this.client.recv(name, callback);
    }

    stop_recv(name, callback) {
        return this.client.stop_recv(name, callback);
    }
}

describe('server', function() {
    let db;
    var dbProcess;

    let old_db_name;
    let old_catsoop_url;

    before(function(done) {
        old_db_name = params.RETHINKDB.DATABASE;
        params.RETHINKDB.DATABASE = 'test';
        params.RETHINKDB.PORT_OFFSET += 1;

        old_catsoop_url = params.CATSOOP.API_ROOT;
        params.CATSOOP.API_ROOT = 'http://localhost:3002';

        catsoop.start(3002);

        dbStart()
            .then(proc => dbProcess = proc)
            .then(() => db = require('../server/rethinkdb'))
            .then(() => dbReset(db))
            .then(() => done());
    });

    after(function() {
        params.RETHINKDB.DATABASE = old_db_name;
        params.CATSOOP.API_ROOT = old_catsoop_url;
        params.RETHINKDB.PORT_OFFSET -= 1;

        dbProcess.kill();
        catsoop.stop();
    });

    describe('low-level tests', function() {
        const room_name = 'low-level';
        let server;
        let port;

        let old_rooms;
        before(function() {
            old_rooms = params.ROOMS;
            params.ROOMS = [room_name];
        });

        after(function() {
            params.ROOMS = old_rooms;
        });

        beforeEach(function(done) {
            const make_queue = require('../server/queue');
            server = http.Server();
            queue = make_queue(server, options);
            PORT = 3001;

            server.listen(PORT, done);
        });

        afterEach(function() {
            server.close();
        });

        describe('port & URL', function() {
            it('serve socket.io', function() {
                const socket = io(`http://localhost:${PORT}/`, {path: `${options.url_root}/socket.io/`});
                return new Promise((resolve, reject) => {
                    socket.on('connect', resolve);
                    socket.on('connect_error', reject);
                });
            });
        });

        describe('login', function() {
            let socket;

            beforeEach(function() {
                socket = io(`http://localhost:${PORT}/`, {path: `${options.url_root}/socket.io/`});
                return new Promise((resolve, reject) => {
                    socket.on('connect', resolve);
                    socket.on('connect_error', reject);
                });
            });

            afterEach(function() {
                socket.disconnect()
            })

            it('accept valid login', function(done) {
                socket.emit('authenticate', {
                    succeed: true,
                    username: 'real',
                    room: room_name,
                }, function(res) {
                    assert.isUndefined(res.error);
                    done();
                });
            });

            it('reject invalid login', function(done) {
                socket.emit('authenticate', {}, function(res) {
                    assert.isDefined(res.error);
                    done();
                });
            });
        });
    });

    describe('single-room tests', function() {
        const room_name = 'single-room';
        let server;
        let port;

        let old_rooms;
        before(function() {
            old_rooms = params.ROOMS;
            params.ROOMS = [room_name];
        });

        after(function() {
            params.ROOMS = old_rooms;
        });

        beforeEach(function(done) {
            const make_queue = require('../server/queue');
            server = http.Server();
            queue = make_queue(server, options);
            PORT = 3001;

            server.listen(PORT, done);
        });

        afterEach(function() {
            server.close();
        });

        describe('messages', function() {
            var user;

            before(function(done) {
                db.table('queue').insert([
                    {type: 'help', username: 't1', room: room_name, data: {location: 'x1'}},
                    {type: 'help', username: 't2', room: room_name, data: {location: 'x2'}},
                    {type: 'help', username: 't3', room: room_name, data: {location: 'x3'}},
                ]).then(() => done());
            });

            beforeEach(function() {
                user = new User({
                    username: 'testuser',
                    role: 'Admin',
                    room: room_name,
                });

                return user.connect();
            });

            afterEach(function() {
                user.socket.disconnect();
            });

            it('get_all returns all entries', function(done) {
                user.send('get_all')
                    .then(entries => {
                        assert.lengthOf(entries, 3);
                        done();
                    });
            });

            it('add inserts an entry', function(done) {
                var original_length;
                user.send('get_all')
                    .then(entries => original_length = entries.length)
                    .then(() => user.send('add', {type: 'help', data: {}}))
                    .then(() => user.send('get_all'))
                    .then(entries => {
                        assert.lengthOf(entries, original_length+1);
                        done();
                    });
            });

            it('disallow adding a user twice', function(done) {
                user.send('add', {type: 'help', data: {}})
                    .then(() => user.send('get_all'))
                    .then(entries => {
                        assert.lengthOf(entries, 4);
                        done();
                    });
            });

            it('action acts on an entry', function(done) {
                const claimed_user = 't1';
                user.send('action', {action: 'claim', username: claimed_user})
                    .then(() => user.send('get_all'))
                    .then(entries => {
                        assert.lengthOf(entries, 4);

                        let matched_entries = entries.filter(r => r.username === claimed_user);
                        assert.lengthOf(matched_entries, 1);
                        let entry = matched_entries[0];
                        assert.equal(entry.data.state, 'claimed');
                        assert.equal(entry.data.claimant, 'testuser');
                        done();
                    });
            });

            it('edit fires', function(done) {
                const claimed_user = 't1';

                let callback = function({added_entries, edited_entries, deleted_usernames}) {
                    user.stop_recv('edit', callback);

                    assert.lengthOf(added_entries, 0);
                    assert.lengthOf(edited_entries, 1);
                    assert.lengthOf(deleted_usernames, 0);

                    let entry = edited_entries[0];
                    assert.equal(entry.data.state, 'unclaimed');
                    assert.equal(entry.data.claimant, null);

                    done();
                }

                user.recv('edit', callback);
                user.send('action', {action: 'disclaim', username: claimed_user});
            });

            it('action with remove causes delete', function(done) {
                const claimed_user = 't2';

                let callback = function({added_entries, edited_entries, deleted_usernames}) {
                    user.stop_recv('edit', callback);

                    assert.lengthOf(added_entries, 0);
                    assert.lengthOf(edited_entries, 0);
                    assert.lengthOf(deleted_usernames, 1);

                    assert.equal(deleted_usernames[0], claimed_user);

                    done();
                }

                user.send('action', {action: 'claim', username: claimed_user})
                    .then(() => {
                        user.recv('edit', callback);
                        user.send('action', {action: 'remove', username: claimed_user});
                    });
            });

            it('should not be able to claim two entries at once', function(done) {
                const claimed_user = 't1'
                let callback = function({added_entries, edited_entries, deleted_usernames}) {
                    user.stop_recv('edit', callback);

                    assert.lengthOf(added_entries, 0);
                    assert.lengthOf(edited_entries, 1);
                    assert.lengthOf(deleted_usernames, 0);

                    done();
                }

                user.recv('edit', callback);

                user.send('action', {action: 'claim', username: claimed_user})
                    .then(() => user.send('action', {action: 'claim', username: claimed_user}))
                    .then(() => user.send('action', {action: 'claim', username: 't3'}))
                    .then(() => user.send('get_all'))
                    .then(entries => {
                        let matched_entries = entries.filter(r => r.username === 't3');
                        assert.lengthOf(matched_entries, 1);
                        let entry = matched_entries[0];
                        assert.notEqual(entry.data.state, 'claimed');
                        assert.notEqual(entry.data.claimant, 'testuser');

                        let claims = entries.filter(r => r.data.claimant === 'testuser')
                        assert.isAtMost(claims.length, 1);
                    });
            });
        });

        describe('permissions', function() {
            const users = {};

            beforeEach(function() {
                users.admin = new User({
                    username: 'testuser-admin',
                    role: 'Admin',
                    room: room_name,
                });

                users.student = new User({
                    username: 'testuser-student',
                    role: 'Student',
                    room: room_name,
                });

                return Promise.all(Object.values(users).map(user => user.connect()));
            });


            afterEach(function() {
                Object.values(users).map(user => user.socket.disconnect());
            });

            it('should not sanitize data for admins', function(done) {
                users.admin.send('get_all')
                     .then(entries => {
                         assert.lengthOf(entries, 3);
                         entries.forEach(entry => {
                             assert.notDeepEqual(entry.data, {});
                         });
                         done();
                     });
            });

            it('should sanitize data for students', function(done) {
                const allowed_fields = ['state'];
                users.student.send('get_all')
                     .then(entries => {
                         assert.lengthOf(entries, 3);
                         entries.forEach(entry => {
                             allowed_fields.forEach(field => delete entry.data[field]);
                             assert.deepEqual(entry.data, {});
                         });
                         done();
                     });
            });

            it('should not allow students to claim', function(done) {
                var claimEntry;
                users.admin.send('get_all')
                     .then(entries => {
                         claimEntry = entries.find(entry => !entry.data.claimed)
                         assert.isDefined(claimEntry);
                     })
                     .then(() => users.student.send('action', {action: 'claim', username: claimEntry.username}))
                     .then(() => users.admin.send('get_all'))
                     .then(entries => {
                         let entry = entries.find(entry => entry.username === claimEntry.username)
                         assert.isDefined(entry);
                         assert.isUndefined(entry.data.claimed)
                         done();
                     });
            });
        });

        describe('checkoff entry', function() {
            const users = {};

            const entry_user = 'u1';

            before(function(done) {
                db.table('queue').insert({
                    type: 'checkoff',
                    username: entry_user,
                    room: 'single-room',
                    data: {
                        state: 'unclaimed',
                        assignment: {
                            page: params.CATSOOP.API_ROOT + '/assignments/0',
                            name: 'chk1',
                        },
                    },
                }).then(() => done());
            });

            beforeEach(function() {
                users.admin = new User({
                    username: 'testuser-admin',
                    role: 'Admin',
                    room: room_name,
                });

                users.student = new User({
                    username: 'testuser-student',
                    role: 'Student',
                    room: room_name,
                });

                return Promise.all(Object.values(users).map(user => user.connect()));
            });

            afterEach(function() {
                Object.values(users).map(user => user.socket.disconnect());
            });

            it('admin unclaimed actions', function(done) {
                users.admin.send('get_all')
                     .then(entries => {
                         const claimEntry = entries.find(entry => entry.username === 'u1');
                         assert.isDefined(claimEntry);
                         assert.sameMembers(claimEntry.actions, ['claim']);

                         done();
                     });
            });

            it('student unclaimed actions', function(done) {
                users.student.send('get_all')
                     .then(entries => {
                         entries.forEach(entry => {
                             assert.isDefined(entry);
                             assert.sameMembers(entry.actions, []);
                         });
                         done();
                     });
            });

            it('admin claimed actions', function(done) {
                users.admin.send('action', {action: 'claim', username: entry_user})
                     .then(() => users.admin.send('get_all'))
                     .then(entries => {
                         let entry = entries.find(entry => entry.username === entry_user);
                         assert.isDefined(entry);
                         assert.sameMembers(entry.actions, [
                             'group_checkoff',
                             'single_checkoff',
                             'disclaim',
                             'remove',
                         ]);

                         done();
                     });
            });

            it('student claimed actions', function(done) {
                users.student.send('get_all')
                     .then(entries => {
                         entries.forEach(entry => {
                             assert.isDefined(entry);
                             assert.sameMembers(entry.actions, []);
                         });
                         done();
                     });
            });

            it('single checkoff', function(done) {
                users.admin.send('action', {action: 'single_checkoff', username: entry_user})
                     .then(() => users.admin.send('get_all'))
                     .then(entries => {
                         var entry = entries.find(entry => entry.username === entry_user);
                         assert.isUndefined(entry);

                         done();
                     });
            });
        });

        describe('issue #13:', function() {
            const users = {};
            const admin_username = 'testuser-admin';
            const student_username = 'testuser-student';

            beforeEach(function() {
                users.admin = new User({
                    username: 'testuser-admin',
                    role: 'Admin',
                    room: room_name,
                });

                users.student = new User({
                    username: 'testuser-student',
                    role: 'Student',
                    room: room_name,
                });

                return Promise.all(Object.values(users).map(user => user.connect()));
            });

            afterEach(function() {
                Object.values(users).map(user => user.socket.disconnect());
            });

            it('should retain claimant if entry type changes', function(done) {
                users.student.send('add', {type: 'help', data: {}})
                     .then(() => users.admin.send('action', {action: 'claim', username: student_username}))
                     .then(() => users.admin.send('get_all'))
                     .then(entries => {
                         const entries_ = entries.filter(r => r.username === student_username);
                         assert.lengthOf(entries_, 1);

                         const entry = entries_[0];
                         assert.isDefined(entry);
                         assert.equal(entry.type, 'help');
                         assert.isDefined(entry.data);
                         assert.equal(entry.data.claimant, admin_username);
                         assert.equal(entry.data.state, 'claimed');
                     })
                     .then(() => users.student.send('add', {
                         type: 'checkoff',
                         data: {
                             assignment: {path: 'assignments/0'},
                         },
                     }))
                     .then(() => users.admin.send('get_all'))
                     .then(entries => {
                         const entries_ = entries.filter(r => r.username === student_username);
                         assert.lengthOf(entries_, 1);

                         const entry = entries_[0];
                         assert.isDefined(entry);
                         assert.equal(entry.type, 'checkoff');
                         assert.isDefined(entry.data);
                         assert.equal(entry.data.claimant, admin_username);
                         assert.equal(entry.data.state, 'claimed');
                         done();
                     });
            });
        });

        describe('locking', function() {
            const users = {};

            beforeEach(function() {
                users.admin = new User({
                    username: 'testuser-admin',
                    role: 'Admin',
                    room: room_name,
                });

                users.student = new User({
                    username: 'testuser-student',
                    role: 'Student',
                    room: room_name,
                });

                return Promise.all(Object.values(users).map(user => user.connect()));
            });

            afterEach(function() {
                Object.values(users).map(user => user.socket.disconnect());
            });

            it('should allow new entries by default', function(done) {
                let original_entry_count;
                users.student.send('action', {
                    action: 'remove',
                    username: 'testuser-student'
                })
                     .then(() => users.admin.send('get_all'))
                     .then(entries => {
                         assert.isFalse(entries.some(r => r.username === 'testuser-student'));
                         original_entry_count = entries.length;
                     })
                     .then(() => users.student.send('add', {type: 'help', data: {}}))
                     .then(() => users.admin.send('get_all'))
                     .then(entries => {
                         assert.lengthOf(entries, original_entry_count + 1);
                     })
                     .then(() => users.student.send('action', {
                         action: 'remove',
                         username: 'testuser-student'
                     }))
                     .then(() => done());
            });

            it('should not allow new entries when locked', function(done) {
                let original_entry_count;
                users.admin.send('get_all')
                     .then(entries => {
                         assert.isFalse(entries.some(r => r.username === 'testuser-student'));
                         original_entry_count = entries.length;
                     })
                     .then(() => users.admin.send('lock'))
                     .then(() => users.student.send('add', {type: 'help', data: {}}))
                     .then(() => users.admin.send('get_all'))
                     .then(entries =>  {
                         assert.lengthOf(entries, original_entry_count);
                         done();
                     });
            });

            it('should not allow student to unlock queue', function(done) {
                let original_entry_count;
                users.admin.send('get_all')
                     .then(entries => {
                         assert.isFalse(entries.some(r => r.username === 'testuser-student'));
                         original_entry_count = entries.length;
                     })
                     .then(() => users.student.send('unlock'))
                     .then(() => users.student.send('add', {type: 'help', data: {}}))
                     .then(() => users.admin.send('get_all'))
                     .then(entries => {
                         assert.lengthOf(entries, original_entry_count + 1);
                         done();
                     });
            });
        });

        describe('clearing', function() {
            const users = {};

            beforeEach(function() {
                users.admin = new User({
                    username: 'testuser-admin',
                    role: 'Admin',
                    room: room_name,
                });

                users.student = new User({
                    username: 'testuser-student',
                    role: 'Student',
                    room: room_name,
                });

                return Promise.all(Object.values(users).map(user => user.connect()));
            });

            afterEach(function() {
                Object.values(users).map(user => user.socket.disconnect());
            });

            it('should not allow students to clear the queue', function(done) {
                var original_length;
                users.admin.send('get_all')
                     .then(entries => {
                         original_length = entries.length;
                         assert.isAbove(original_length, 0);
                     })
                     .then(() => users.student.send('clear'))
                     .then(() => users.admin.send('get_all'))
                     .then(entries => {
                         assert.lengthOf(entries, original_length);
                         done();
                     });
            });

            it('should allow staff to clear the queue', function(done) {
                users.admin.send('get_all')
                     .then(entries => {
                         assert.isAbove(entries.length, 0);
                     })
                     .then(() => users.admin.send('clear'))
                     .then(() => users.admin.send('get_all'))
                     .then(entries => {
                         assert.lengthOf(entries, 0);
                         done();
                     });
            });
        });
    });

    describe('multi-room tests', function() {
        const room_names = ['room1', 'room2'];
        let server;
        let port;

        let old_rooms;
        before(function() {
            old_rooms = params.ROOMS;
            params.ROOMS = room_names;
        });

        after(function() {
            params.ROOMS = old_rooms;
        });

        beforeEach(function(done) {
            const make_queue = require('../server/queue');
            server = http.Server();
            queue = make_queue(server, options);
            PORT = 3001;

            server.listen(PORT, done);
        });

        afterEach(function() {
            server.close();
        });

        describe('room separation', function() {
            const room1 = {};
            const room2 = {};
            var users;

            beforeEach(function() {
                room1.admin = new User({
                    username: 'testuser-admin1',
                    role: 'Admin',
                    room: 'room1',
                });

                room1.student = new User({
                    username: 'testuser-student1',
                    role: 'Student',
                    room: 'room1',
                });

                room2.admin = new User({
                    username: 'testuser-admin2',
                    role: 'Admin',
                    room: 'room2',
                });

                room2.student = new User({
                    username: 'testuser-student2',
                    role: 'Student',
                    room: 'room2',
                });

                users = Object.values(room1).concat(Object.values(room2));

                return Promise.all(users.map(user => user.connect()));
            });

            afterEach(function() {
                users.forEach(user => user.socket.disconnect());
            });

            it('should not show entries in other rooms', function(done) {
                Promise.all([
                    room1.student.send('add', {type: 'help', data: {}}),
                    room2.student.send('add', {type: 'help', data: {}}),
                ])
                       .then(() => room1.admin.send('get_all'))
                       .then(entries => {
                           assert.lengthOf(entries, 1);
                           assert.equal(entries[0].username, 'testuser-student1');
                       })
                       .then(() => room2.admin.send('get_all'))
                       .then(entries => {
                           assert.lengthOf(entries, 1);
                           assert.equal(entries[0].username, 'testuser-student2');
                       })
                       .then(() => done());
            });

            it('should not allow claims in other rooms', function(done) {
                room1.student.send('add', {type: 'help', data: {}})
                     .then(() => room2.admin.send('action', {action: 'claim', username: room1.student.username}))
                     .then(() => room1.admin.send('get_all'))
                     .then(entries => {
                         entries.forEach(entry => {
                             assert.notEqual(entry.data.claimant, room2.admin.username);
                         });
                     })
                     .then(() => done())
                     .catch(done);
            });

            it('should not show changes to entries in other rooms', function(done) {
                const allowed_usernames = new Set(Object.values(room2).map(user => user.username));
                let callback = function({added_entries, edited_entries, deleted_usernames}) {
                    added_entries.concat(edited_entries).forEach(entry => {
                        if (!allowed_usernames.has(entry.username)) {
                            done(assert(false, 'This callback should not see changes to other rooms'));
                        }
                    });
                    deleted_usernames.forEach(username => {
                        if (!allowed_usernames.has(username)) {
                            done(assert(false, 'This callback should not see changes to other rooms'));
                        }
                    })
                }

                room2.admin.recv('edit', callback);
                room1.admin.send('action', {action: 'claim', username: room1.student.username})
                     .then(() => setTimeout(done, 1000));
            });
        });

        describe('room-switching', function() {
            const room1 = {};
            const room2 = {};
            var users;

            beforeEach(function() {
                room1.admin = new User({
                    username: 'testuser-admin1',
                    role: 'Admin',
                    room: 'room1',
                });

                room1.switcher = new User({
                    username: 'testuser-student3',
                    role: 'Student',
                    room: 'room1',
                });

                room2.admin = new User({
                    username: 'testuser-admin2',
                    role: 'Admin',
                    room: 'room2',
                });

                room2.switcher = new User({
                    username: 'testuser-student3',
                    role: 'Student',
                    room: 'room2',
                });

                users = Object.values(room1).concat(Object.values(room2));

                return Promise.all(users.map(user => user.connect()));
            });

            afterEach(function() {
                users.forEach(user => user.socket.disconnect());
            });

            it('should not preserve the claimant when an entry switches rooms', function(done) {
                room1.switcher.client.add('help', {})
                     .then(() => room1.admin.send('action', {action: 'claim', username: room1.switcher.username}))
                     .then(() => room2.switcher.client.add('help', {}))
                     .then(() => room2.admin.client.get_entries())
                     .then(entries => {
                         const entry = entries.find(entry => entry.username === room1.switcher.username);
                         assert.isOk(entry);
                         assert.notEqual(entry.data.claimant, room1.admin.username);
                     })
                     .then(() => done())
                     .catch(err => done(err));
            });
        });
    });
});
