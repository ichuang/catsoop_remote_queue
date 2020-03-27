#!/usr/bin/env node

const passwords = require('../server/passwords');

const key = process.argv[2];

const password = passwords[key];

if (password) {
    process.stdout.write(passwords[key]);
    if (process.stdout.isTTY) {
        process.stdout.write('\n');
    }
}
else {
    process.stderr.write(`Cannot find password for ${key}`);
    if (process.stderr.isTTY) {
        process.stderr.write('\n');
    }
}
