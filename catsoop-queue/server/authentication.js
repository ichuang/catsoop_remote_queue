const rp = require('request-promise');

const params = require('../config/params');
const db = require('./rethinkdb');
const log = require('./log');
const catsoop = require('./catsoop');
const util = require('./util');

function queue_permissions(user) {
    let permissions = new Set();

    switch (user.role) {
        case 'Admin':
        case 'Instructor':
        case 'TA':
            permissions.add('clear');
            /* falls through */
        case 'UTA':
            permissions.add('lock');
            permissions.add('show_claimed');
            permissions.add('check_in');
            permissions.add('auto_check_in');
            /* falls through */
        case 'LA':
            permissions.add('notifications');
        case 'SLA':
            permissions.add('queue_view_all');
            permissions.add('claim');
            permissions.add('checkoff');
    }

    return permissions;
}

const STAFF_ROLES = new Set([
    'Admin',
    'Instructor',
    'TA',
    'UTA',
]);

function is_staff(user) {
    return STAFF_ROLES.has(user.role);
}

function validate_auth(auth) {
    log.debug('validate_auth', {auth});
    return catsoop
        .post('get_user_information', auth)
        .then(({user_info}) => {
            const user = user_info;
            user.permissions = util.union(new Set(user.permissions), queue_permissions(user));
            return user;
        });
}

module.exports = {
    is_staff,
    validate_auth,
};
