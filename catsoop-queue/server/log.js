const fs = require('fs');
const path = require('path');

const winston = require('winston');

const params = require('../config/params');

function socket_rewriter(level, msg, meta) {
    if (!meta.socket) return meta;
    meta.socket = {
        ip: meta.socket.request.headers['x-real-ip'],
    };
    return meta;
}

function user_rewriter(level, msg, meta) {
    if (!meta.user) return meta;
    meta.user = {
        username: meta.user.username,
        role: meta.user.role,
        permissions: Array.from(meta.user.permissions),
    };
    return meta;
}

// replicating the behavior of the err serializer in bunyan
// https://github.com/trentm/node-bunyan/blob/master/lib/bunyan.js
function getFullErrorStack(ex) {
    var ret = ex.stack || ex.toString();
    if (ex.cause && typeof (ex.cause) === 'function') {
        var cex = ex.cause();
        if (cex) {
            ret += '\nCaused by: ' + getFullErrorStack(cex);
        }
    }
    return (ret);
}

// Serialize an Error object
// (Core error properties are enumerable in node 0.4, not in 0.6).
function err_rewriter(level, msg, meta) {
    if (!(meta.err instanceof Object)) return meta;
    if (!meta.err || !meta.err.stack) return meta;
    meta.err = {
        message: meta.err.message,
        name: meta.err.name,
        stack: getFullErrorStack(meta.err),
        code: meta.err.code,
        signal: meta.err.signal
    }
    return meta;
};

try {
    if (!fs.statSync(params.LOG_DIR).isDirectory()) {
        /* TODO: this won't actually mkdir, it'll try to kill a file
         * Warn the user instead
         */
        fs.mkdirSync(params.LOG_DIR);
    }
}
catch (err) {
    if (err.code === 'ENOENT') {
        fs.mkdirSync(params.LOG_DIR);
    }
}

const log = new winston.Logger({
    rewriters: [
        socket_rewriter,
        user_rewriter,
        err_rewriter,
    ],
    transports: (params.PRINT_LOGS ? [new winston.transports.Console()] : []).concat([
        new winston.transports.File({
            name: 'error',
            filename: path.join(params.LOG_DIR, 'error.log'),
            level: 'error',
        }),
        new winston.transports.File({
            name: 'warn',
            filename: path.join(params.LOG_DIR, 'warn.log'),
            level: 'warn',
        }),
        new winston.transports.File({
            name: 'info',
            filename: path.join(params.LOG_DIR, 'info.log'),
            level: 'info',
        }),
    ])
});

module.exports = log;
