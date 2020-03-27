const fs = require('fs');
const path = require('path');
const http = require('http');

const express = require('express');

const params = require('../config/params');
const make_queue = require('./queue');
const log = require('./log');

const app = express();
app.set('trust proxy', 'loopback');
app.use('/', express.static(path.join(__dirname, '../www')));

const server = http.Server(app);

const queue = make_queue(server, {
    url_root: '/',
});

server.listen(params.EXPRESS.PORT, () => {
    log.info(`listening on port ${params.EXPRESS.PORT}`, {port: params.EXPRESS.PORT, url_root: '/'}, 'listening');
});
