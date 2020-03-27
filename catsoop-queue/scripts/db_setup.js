#!/usr/bin/env node

const params = require('../config/params');
const r = require('../server/rethinkdb');

if (!Object.entries) {
    const reduce = Function.call.bind(Array.prototype.reduce)
    const isEnumerable = Function.call.bind(Object.prototype.propertyIsEnumerable);
    const concat = Function.call.bind(Array.prototype.concat);
    const keys = Object.keys;

    // https://github.com/tc39/proposal-object-values-entries
    Object.entries = function entries(O) {
        return reduce(keys(O), (e, k) =>
            concat(e, typeof k === 'string' && isEnumerable(O, k) ? [[k, O[k]]] : []), []);
    };
}

const DB = params.RETHINKDB.DATABASE;
const TABLES = [
    ['queue', {primaryKey: 'username'}],
];
const INDICES = {};

r.dbList()
 .then(dbs => {
     if (dbs.indexOf(DB) === -1) {
         console.log(`Create DB: ${DB}`);
         return r.dbCreate(DB);
     }
 })
 .then(() => r.db(DB).tableList())
 .then((tables=[]) => {
     const missing_tables = TABLES.filter(([t, _]) => tables.indexOf(t) === -1);
     return Promise.all(missing_tables.map(([table, options]) => {
         console.log(`Create table: ${table}`);
         return r.db(DB).tableCreate(table, options);
     }));
 })
 .then(() =>
     Promise.all(Object.entries(INDICES).map(([table, index_params]) =>
         r.db(DB).table(table).indexList()
          .then(indices =>
              Promise.all(Object.entries(index_params).map(([name, value]) => {
                  if (indices.indexOf(name) !== -1) return Promise.resolve();

                  console.log(`Create index on ${table}: ${name}`);
                  return r.db(DB).table(table).indexCreate(name, value);
              }))
          )
     ))
 )
 .then(() => {
     r.getPoolMaster().drain();
 })
