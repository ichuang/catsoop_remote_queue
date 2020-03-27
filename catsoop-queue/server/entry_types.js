const params = require('../config/params');
const util = require('./util');
const spliceOut = util.spliceOut;
const db = require('./rethinkdb');
const catsoop = require('./catsoop');

class Entry {
    constructor(db_doc) {
        Object.assign(this, db_doc);
    }

    static data_skeleton(data, user) {
        return {
            location: data.location,
            assignment: data.assignment,
            state: 'unclaimed',
        };
    }

    render(user, users) {
        if (this.visible_to(user)) {
            const username = this.username;
            var real_name = users.hasOwnProperty(this.username) ? 
		  ( users[this.username].hasOwnProperty("full_name")
		    ? users[this.username].full_name
		    : users[this.username].name
		  )
		: '';
	    if (users.hasOwnProperty(this.username) && users[this.username].hasOwnProperty("subject")){
		real_name += " (" + users[this.username].subject + ")";
	    }
            return Promise.resolve({
                data: Object.assign(
                    {},
                    this.data,
                    {
                        group: [{username, real_name}]
                    }
                ),
                type: this.type,
                actions: this.actions(user),
                date_added: this.date_added,
                last_modified: this.last_modified,
                username: this.username,
                real_name,
            });
        }
        else {
            return Promise.resolve({
                data: {state: this.data.state},
                type: '',
                actions: [],
                date_added: this.date_added,
                last_modified: '',
                username: util.hash_username(this.username),
                real_name: '',
            })
        }
    }

    actions(user) {
        switch (this.data.state) {
        case 'claimed':
            if (this.data.claimant !== user.username) {
                return [];
            }

            return [
                'disclaim',
                'remove',
            ];
        case 'unclaimed':
            return ['claim'];
        }
    }

    'claim'(user) {
        if (!user.permissions.has('claim')) return Promise.resolve();
        if (params.STAFF_CHECK_IN_REQUIRED && !user.confirmed) return Promise.resolve();

        return db
            .table('queue')
            .get(this.username)
            .replace(doc => db.branch(
                user.claims.size || doc('data')('claimant').default(null),
                doc,
                doc.merge({
                    data: {
                        state: 'claimed',
                        claimant: user.username,
                        claimant_real_name: user.name,
                    },
                    last_modified: db.now(),
                })
            ));
    }

    'disclaim'(user) {
        if (!user.permissions.has('claim')) return Promise.resolve();

        return db
            .table('queue')
            .get(this.username)
            .replace(doc => db.branch(
                doc('data')('claimant').default(null).eq(user.username),
                doc.without({data: 'claimant'})
                   .without({data: 'claimant_real_name'})
                   .merge({
                       data: {
                           state: 'unclaimed',
                       },
                       last_modified: db.now(),
                   }),
                doc
            ));
    }

    'remove'(user) {
        return db
            .table('queue')
            .get(this.username)
            .replace(doc => db.branch(
                db.or(
                    doc('data')('claimant').default(null).eq(user.username),
                    doc('username').eq(user.username)
                ),
                null,
                doc
            ));
    }
}

class HelpEntry extends Entry {
    visible_to(user) {
        return user.username === this.username || !['Guest', 'Student'].includes(user.role);
    }
}

class CheckoffEntry extends Entry {
    constructor(db_doc) {
        super(db_doc);
        this._group = catsoop
            .post('/groups/get_my_group', {
                path: JSON.stringify(this.data.assignment.path),
                as: this.username,
            })
            .catch(err => ({
                members: [this.username],
            }));
    }

    render(user, users) {
        return this._group.then(({members}) => {
            return super.render(user, users).then(entry => {
                Object.assign(entry.data, {
                    group: members.map(m => ({
                        username: m,
                        real_name: users.hasOwnProperty(m) ? users[m].name : '',
                    })),
                });
                return entry;
            });
        });
    }

    actions(user) {
        let actions = super.actions(user);

        switch (this.data.state) {
        case 'claimed':
            if (this.data.claimant !== user.username) {
                return actions;
            }

            return actions.concat([
                'group_checkoff',
                'single_checkoff',
            ]);
        case 'unclaimed':
            return actions;
        }
    }

    visible_to(user) {
        return user.username === this.username || user.permissions.has('queue_view_all');
    }

    'single_checkoff'(user) {
        if (!user.permissions.has('checkoff')) return Promise.resolve();

        return catsoop
            .submit(this.data.assignment.page, {
                names: JSON.stringify([this.data.assignment.name]),
                as: this.username,
                data: JSON.stringify({[this.data.assignment.name]: params.CATSOOP.TOKEN+','+user.username}),
            })
            .then(() => db
                .table('queue')
                .get(this.username)
                .replace(doc => db.branch(
                    doc('data')('claimant').default(null).eq(user.username),
                    null,
                    doc
                ))
            );
    }

    'group_checkoff'(user) {
        if (!user.permissions.has('checkoff')) return Promise.resolve();

        return this._group.then(({members}) => {
            return Promise.all(members.map(member => {
                return catsoop
                    .submit(this.data.assignment.page, {
                        names: JSON.stringify([this.data.assignment.name]),
                        as: member,
                        data: JSON.stringify({[this.data.assignment.name]: params.CATSOOP.TOKEN+','+user.username}),
                    });
            }));
        }).then(() => db
            .table('queue')
            .get(this.username)
            .replace(doc => db.branch(
                doc('data')('claimant').default(null).eq(user.username),
                null,
                doc
            ))
        );
    }
}

module.exports = {
    'help': HelpEntry,
    'checkoff': CheckoffEntry,
};
