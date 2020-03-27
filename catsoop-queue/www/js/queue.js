require('./polyfills');
const $ = require('jquery');

const Client = require('../../imports/client.js');
const View = require('./view.js');
const params = require('../../config/www_params.js');

function path_join(...args) {
    return args.join('/').replace(/\/+/g, '/');
}

function make_array_sort(f) {
    return (x, y) => {
        let a = f(x);
        let b = f(y);

        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            if (a[i] < b[i]) return -1;
            if (a[i] > b[i]) return +1;
        }

        if (a.length < b.length) return -1;
        if (a.length > b.length) return +1;

        return 0;
    };
}

let queue_sort_order = make_array_sort(entry => [Boolean(entry.data.claimant), entry.date_added]);

class Queue {
    constructor(options) {
        this.client = new Client({
            socket_path: path_join(options.url_root, '/socket.io/'),
            room: options.room,
        });

        this.client.socket.on('connect', () => {
            this.view.set('disconnected', false);
        });

        this.client.socket.on('disconnect', () => {
            setTimeout(() => this.view.set('disconnected', true), 1e3);
        });

        this.view = new View(this.client, {
            container: options.container,
            view: options.view,
            is_staff: options.is_staff,
            page: catsoop.this_path,
            path: catsoop.path_info,
            PHOTOS_ENABLED: Boolean(options.get_photo_url),
            get_photo_url: options.get_photo_url,
            AUDIO_ENABLED: Boolean(options.get_audio_url),
            get_audio_url: options.get_audio_url,
            SHOW_STAFF_LIST: options.SHOW_STAFF_LIST,
        });

        if (options.view === 'staff_view') {
            this.view.observe('fraction_unclaimed', ([unclaimed,total]=[0,0], old) => {
                window.document.title = `(${unclaimed}/${total}) Queue`;
            });
        }

        this.client.recv('edit', ({added_entries, edited_entries, deleted_usernames}) => {
            if (added_entries.length && options.view === 'staff_view') this.notify(added_entries);

            let dirty_usernames = edited_entries.map(entry => entry.username).concat(deleted_usernames);
            let clean_entries = this.view.get('entries').filter(entry => !dirty_usernames.includes(entry.username));
            let entries = clean_entries.concat(edited_entries).concat(added_entries);
            entries.sort(queue_sort_order)
            this.view.set('entries', entries);
        });

        this.client.recv('locked', locked => {
            this.set('locked', locked);
        });

        this.client.recv('staff_list', ({checked_in, logged_in, removed}) => {
            checked_in = new Set(checked_in);
            logged_in = new Set(logged_in);
            removed = new Set(removed);
            const confirmed = new Set(this.get('confirmed_staff'))
                .difference(removed)
                .union(checked_in);
            const unconfirmed = new Set(this.get('unconfirmed_staff'))
                .difference(removed)
                .difference(checked_in)
                .union(logged_in);
            this.set('confirmed_staff', Array.from(confirmed).sort());
            this.set('unconfirmed_staff', Array.from(unconfirmed).sort());
        });


        this.get = this.view.get.bind(this.view);
        this.set = this.view.set.bind(this.view);
        this.observe = this.view.observe.bind(this.view);
    }

    login() {
        const auth_msg = {
            api_token: catsoop.api_token,
            course: catsoop.course,
        };

        this.client.login(auth_msg, auth => {
            this.setup(auth.permissions);
        });
    }

    setup(permissions) {
        this.client.is_locked()
            .then(locked => {
                this.set('locked', locked);
            });

        this.client.get_entries()
            .then(entries => {
                entries.sort(queue_sort_order);
                this.view.set('entries', entries);
            });

        this.client.get_staff_list()
            .then(({confirmed, unconfirmed}) => {
                this.set('confirmed_staff', Array.from(confirmed));
                this.set('unconfirmed_staff', Array.from(unconfirmed));
            });

        const perms = {};
        for (let p of permissions) {
            perms[p] = true;
        }
        this.set('permissions', perms);

        for (let setting of [
            'notify_sound',
            'notify_toast',
            'show_claimed',
        ]) {
            this.set(setting, JSON.parse(localStorage.getItem(setting)));
        }
    }

    add(type, data) {
        this.client.add(type, data)
            .then(({success}) => {
                if (!success) {
                    catsoop.modal(
                        'The queue is locked',
                        'The queue is not accepting new entries at this time.',
                        false,
                        false
                    );
                }
            })
    }

    remove() {
        if (this.view.get('my_entry')) {
            this.client.remove();
        }
    }

    lock() {
        return this.client.lock();
    }

    unlock() {
        return this.client.unlock();
    }

    clear() {
        return this.client.clear();
    }

    notify(new_entries) {
        if (this.get('notify_sound')) {
            const beep = this.view.nodes['queue-notification-sound'];
            if (beep) beep.play();
        }

        if (this.get('notify_toast')) {
            const title = "There's a queue!";
            const options = {
                body: new_entries
                    .map(entry =>
                        `${entry.username} @ ${entry.data.location} : ${entry.data.assignment.display_name}`
                    )
                    .join('\n'),
            };

            if (window.Notification.permission === 'granted') {
                new Notification(title, options);
            }
            else {
                window.Notification.requestPermission((permission) => {
                    if (permission === 'granted') {
                        new Notification(title, options);
                    }
                });
            }
        }
    }
}

$(() => {
    if (catsoop.api_token == null) {
	console.log("queue has no catsoop api token ... exiting");
        return;
    }
    console.log("have catsoop API token!");

    window.queue = new Queue(Object.assign({}, catsoop.plugins.queue, params));

    window.queue.observe('current_claim', (cur, old) => {
        console.log('Status of current claim:', cur);
    });

    window.queue.observe('my_entry', function(cur, old) {
        if (!old && cur) { // my entry was added
            this.set('_visible', true);
        }
        if(cur) {
            console.log(cur.data)
            try{
                if (cur.data.claimant) {
                    if (this.get('notify_sound')) {
                       console.log(cur.data);
                        const beep = document.getElementById('queue-notification-sound');
                        if (beep) beep.play();
                        console.log("beep boop");
                    }
		   console.log(this.get('notify_toast'), 'toast')
                   if (this.get('notify_toast')) {
                        const title = "Help is ready!";
                        const options = {
                            body: `${cur.data.claimant} is ready to help with ${cur.data.assignment.display_name}`
                        };
     
			console.log(window.Notification.permission);
                        if (window.Notification.permission === 'granted') {
                            new Notification(title, options);
                        }
                        else {
                            window.Notification.requestPermission((permission) => {
                                if (permission === 'granted') {
                                    new Notification(title, options);
                                }
                            });
                        }
     
                   }
                }
            }
            catch(err) {
                console.log("some error")
            }
        }
        if (old && !cur) { // my entry was removed
            const name = old.data.assignment.name
            $.post(catsoop.this_page, {
                action: 'get_state',
                api_token: catsoop.api_token,
            })
             .done(({scores}) => {
                 if (!scores) return;

                 if (scores[old.data.assignment.name] === 1) {
                     $.post(catsoop.this_page, {
                         api_token: catsoop.api_token,
                         action: 'render_single_question',
                         name,
                     })
                      .done(qdiv_html => {
                          $(`#cs_qdiv_${name}`).html(qdiv_html)
                      });
                 }
             });
        }
    });

    window.queue.handle_scroll_div = (function(){
	var qd = function(){
	    var qd = $('#queue_div');
	    return qd;
	}
	
	var irr = function(x){	// receive parent page position info, including scrollTop
	    var st = x.scrollTop;
	    var ch = x.clientHeight;
	    var qd = $('#queue_div');
	    var height = window.innerHeight;
	    var newbot = height - st - ch + 600;
	    if (x.iframeHeight < (x.clientHeight + 500)){
		newbot += 70;
	    }
	    // console.log(x);
	    if (newbot < 0){ newbot = 0; }
	    qd.css({bottom: String(newbot) + "px"});
	}

	var setup = function(){  // iframe resize receiver
	    if ('parentIFrame' in window) {
		window.parentIFrame.getPageInfo(irr);
	    }else{
		setTimeout(setup, 500);
	    }
	}

	var st = function(){
	    var st = $(window).scrollTop;
	    return st;
	}

	var get = function(cmd){ return eval(cmd); }
	
	return {get: get,
		jq: $,
		qd: qd,
		setup: setup,
	       }
    })();

    window.queue.login();
    window.queue.handle_scroll_div.setup();
});

