const params = require('../config/params');

const r = require('rethinkdbdash')({
    db: params.RETHINKDB.DATABASE,
    servers: [
        {host: 'localhost', port: 28015 + (params.RETHINKDB.PORT_OFFSET || 0)}
    ]
    // user: params.RETHINKDB.USERNAME,
    // password: params.RETHINKDB.PASSWORD,
});

module.exports = r;
