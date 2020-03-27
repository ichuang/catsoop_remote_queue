const crypto = require('crypto');

module.exports = {
    NOT_ALLOWED: Symbol('NOT_ALLOWED'),
    NOT_AUTHORIZED: Symbol('NOT_AUTHORIZED'),
    DELETE: Symbol('DELETE'),
    EDIT: Symbol('EDIT'),

    spliceOut(arr, elt) {
        let idx = arr.indexOf(elt);
        if (idx !== -1) {
            arr.splice(idx, 1);
        }
    },

    getOrSet(obj, key, val) {
        if (obj.hasOwnProperty(key)) {
            return obj[key];
        }
        else {
            obj[key] = val;
            return val;
        }
    },

    union(...sets) {
        let result = new Set();
        for (s of sets) {
            for (entry of s) {
                result.add(entry);
            }
        }
        return result;
    },

    hash_username(uname) {
        return crypto.createHash('sha512').update(uname).digest('hex');
    },
};
