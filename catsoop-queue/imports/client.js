const io = require('socket.io-client');

function path_join(...args) {
    return args.join('/').replace(/\/+/g, '/');
}

class Client {
    constructor(options) {
        if (options.socket_url) {
            this.socket = io(options.socket_url, {path: options.socket_path});
        }
        else {
            this.socket = io({path: options.socket_path});
        }
        this.username = null;
        this.room = options.room;
    }

    send(name, msg={}) {
        return new Promise((resolve, reject) => {
            this.socket.emit(name, msg, resolve);
        });
    }

    recv(name, callback) {
        this.socket.on(name, callback);
    }

    stop_recv(name, callback) {
        this.socket.removeListener(name, callback);
    }

    login(auth_data, callback=() => {}) {
        const auth_msg = Object.assign({room: this.room}, auth_data);
        this.socket.emit('authenticate', auth_msg, (function auth_handler(auth) {
            if (auth.error) {
                console.log('Auth error', auth.error);
            }

            this.username = auth.username;

            this.socket.once('connect', () => {
                this.socket.emit('authenticate', auth_msg, auth_handler.bind(this));
            });

            callback(auth);
        }).bind(this));
    }

    is_locked() {
        return this.send('get_locked');
    }

    lock() {
        return this.send('lock');
    }

    unlock() {
        return this.send('unlock');
    }

    get_entries(filter={}) {
        return this.send('get_all', filter);
    }

    add(type, data) {
        return this.send('add', {type, data});
    }

    remove() {
        return this.send('action', {
            action: 'remove',
            username: this.username,
        });
    }

    clear() {
        return this.send('clear');
    }

    action(type, data) {
        return this.send('action', Object.assign({action: type}, data));
    }

    get_staff_list() {
        console.log('get_staff_list');
        return this.send('get_staff_list');
    }

    check_in(username) {
        return this.send('check_in', {username});
    }

    check_out(username) {
        return this.send('check_out', {username});
    }
}

module.exports = Client;
