const moment = require('moment');
const Mousetrap = require('mousetrap');
const Ractive = require('ractive');
const $ = require('jquery');

Ractive.DEBUG = false;

const entry_types = require('./entry_types');

module.exports = function(client, options={}) {
    Ractive.defaults.data.page_basename = str => str ? str.split('/').slice(-1) : null;
    Ractive.defaults.data.otherMemberNames = (group, primary) => {
        return group
            .map(({username, real_name}) => username !== primary ? `, ${real_name}` : '')
            .join('');
    };
    Ractive.defaults.data.Math = Math;
    Ractive.defaults.data.entry_types = entry_types;

    Ractive.decorators.kbs = function(node, view, current_claim) {
        if (view === 'claim') {
            current_claim.actions.forEach((action, idx) => {
                const button = $('.action-button')
                    .filter((idx, btn) => $(btn).data('action') == action);
                Mousetrap.bind(entry_types[current_claim.type].buttons[action].shortcuts, () => {
                    button.click();
                });
            });
        }
        else if (view === 'table') {
            Mousetrap.bind('c', () => {
                $('#claim_first').click();
            });
        }

        return {
            teardown: function() {
                Mousetrap.reset();
            },
        };
    };

    Object.assign(Ractive.partials, {
        claim: require('../templates/claim.html'),
        table: require('../templates/table.html'),
        student_view: require('../templates/student_view.html'),
    });

    const Entry = Ractive.extend({
        template: require('../templates/entry.html'),
        init: function() {
            this._intervals = [];
            const format_time = () => {
                this.set('timeFromNow', moment(this.get('last_modified')).fromNow(true));
            };
            format_time();
            this._intervals.push(setInterval(format_time, 1e3));
        },
        teardown: function() {
            this._intervals.forEach(clearInterval);
        },
    });

    const ActMixin = Ractive.extend({
        act() {
            this.set('disabled', true);
            client.action(this.get('action'), {
                username: this.get('entry_id'),
            })
                  .then(() => {
                      this.set('disabled', false);
                  });
        },
    });

    const ActionButton = ActMixin.extend({
        template: require('../templates/action_button.html'),
    });

    const ActionButtonClaimed = ActMixin.extend({
        template: require('../templates/action_button_claimed.html'),
    });

    const ClaimFirst = Ractive.extend({
        template: require('../templates/claim_first.html'),

        claim_first() {
            this.set('disabled', true);
            client.action('claim', {
                username: this.get('entry').username,
            })
                  .then(() => {
                      this.set('disabled', false);
                  });
        },
    });

    const StaffList = Ractive.extend({
        template: require('../templates/staff_list.html'),

        check_in(username) {
            this.event.original.preventDefault();
            client.check_in(username);
        },

        check_out(username) {
            this.event.original.preventDefault();
            client.check_out(username);
        },

        check_out_all() {
            this.event.original.preventDefault();
            this.get('confirmed_staff').forEach(username => client.check_out(username));
        }
    })

    Ractive.components['Entry'] = Entry;
    Ractive.components['ActionButton'] = ActionButton;
    Ractive.components['ActionButtonClaimed'] = ActionButtonClaimed;
    Ractive.components['ClaimFirst'] = ClaimFirst;
    Ractive.components['StaffList'] = StaffList;

    const views = {
        staff_view: require('../templates/queue.html'),
        student_popup: require('../templates/student_popup.html'),
        student_static: require('../templates/student_static.html'),
    }

    return new Ractive({
        el: options.container,
        append: options.view === 'student_popup',
        template: views[options.view],
        data: {
            entries: [],
            PHOTOS_ENABLED: options.PHOTOS_ENABLED,
            get_photo_url: options.get_photo_url,
            AUDIO_ENABLED: options.AUDIO_ENABLED,
            get_audio_url: options.get_audio_url,
            SHOW_STAFF_LIST: options.SHOW_STAFF_LIST,
            is_staff: options.is_staff,
        },

        init: function() {
            this._intervals = [];
            const update_time = () => {
                const claim = this.get('current_claim');
                if (claim) {
                    const difference = Math.max(0, moment().diff(claim.last_modified, 'seconds'));
                    const minutes = difference / 60 | 0;
                    const seconds = difference % 60 | 0;
                    const padding = seconds < 10 ? '0' : '';
                    this.set('claimTime', `${minutes}:${padding}${seconds}`);
                }
            }
            update_time();
            this._intervals.push(setInterval(update_time, 1e3));
        },

        teardown: function() {
            this._intervals.forEach(clearInterval);
        },

        computed: {
            current_claim: function() {
                return this.get('entries').find(entry => entry.data.claimant === client.username);
            },
            my_entry: function() {
                return this.get('entries').find(entry => entry.username === client.username);
            },
            position: function() {
                return this.get('entries').filter(entry => entry.data.state === 'unclaimed').findIndex(entry => entry.username === client.username) + 1;
            },
            display_entries: function() {
                return this.get('entries').filter(entry => this.get('show_claimed') || !entry.data.claimant);
            },
            num_claimed: function() {
                return this.get('entries').filter(entry => entry.data.claimant).length;
            },
            fraction_unclaimed: function() {
                const N = this.get('entries').length;
                const n = N - this.get('num_claimed');
                return [n, N];
            },
            first_unclaimed: function() {
                const unclaimed_entries = this.get('entries').filter(entry => entry.data.state === 'unclaimed');
                return unclaimed_entries.length > 0 ? unclaimed_entries[0] : null;
            }
        },

        askForHelp() {
            this.event.original.preventDefault();
            client.add('help', {
                location: this.get('location'),
                assignment: {
                    display_name: this.get('name'),
                    name: this.get('name'),
                    page: options.page,
                    path: options.path,
                },
            })
        },

        remove() {
            client.remove();
        },

        clear() {
            catsoop.modal(
                'Are you sure you want to clear the queue?',
                'This will remove everyone from the queue.',
                false,
                true,
                )
                .then((res) => {
                    if(res){
                        client.clear();
                    }
                });
        },

        lock() {
            catsoop.modal(
                'Are you sure you want to lock the queue?',
                'This will prevent anyone from adding themselves to the queue.',
                false,
                true,
            )
                .then((res) => {
                    if(res){
                        client.lock();
                    }
                });
        },

        unlock() {
            client.unlock();
        },

        toggle_setting(setting) {
            this.toggle(setting).then(() => {
                var newval = this.get(setting);
                    localStorage.setItem(setting, newval);
                // if we just turned sound on, beep.
                if (setting === "notify_sound" && newval) {
                    const beep = this.nodes['queue-notification-sound'];
                    if (beep) beep.play();
                }

                // if we just turned notifications on, ask for permission to
                // send notifications.
                if (setting === "notify_toast" && newval) {
                    window.Notification.requestPermission((permission) => {});
                }
            });
        },
    });
}
