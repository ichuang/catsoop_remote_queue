const passwords = require('./passwords');

const params = {
    EXPRESS: {
        // The port you'd like the queue server to bind to
        PORT: 3100,
    },

    RETHINKDB: {
        // The name of the database to use
        DATABASE: 'queue',

        // RethinkDB's startup command expects a --port-offset flag in case
        // you're running multiple instances of it.  This causes it to bind to
        // the port 28015 + PORT_OFFSET.
        PORT_OFFSET: 100,
    },

    CATSOOP: {
        // The API token for the admin user that will be submitting requests to
        // CAT-SOOP, but don't set it here.  Set it in the passwords file,
        // because that's ignored by git.
        TOKEN: passwords.catsoop,

        // The publicly accessible URL for the API root of your CAT-SOOP
        // instance.  It's probably the URL of the course listing for your
        // CAT-SOOP instance with '/cs_util/api' appended to it.
        API_ROOT: 'https://YOUR_SERVER/_util/api',

        // The name of the queue plugin in your __PLUGINS__ directory.
        PLUGIN_NAME: 'queue',

        // These directories will be run through Python's string.Template and formatted by
        // `scripts/make_catsoop.py`.
        PLUGIN_TEMPLATE: 'catsoop/plugin-template',
        ROOM_TEMPLATE: 'catsoop/room-template',
        ROOM_SELECTION_TEMPLATE: 'catsoop/room-selection-template',
    },

    // Set this to true to enable the staff check-in feature.  Make sure to enable SHOW_STAFF_LIST
    // in www_params.js after you enable this.
    STAFF_CHECK_IN_REQUIRED: false,

    // The publicly accessible URL of the queue.  This is the route you set up in NGINX.
    URL_ROOT: 'YOUR_QUEUE_URL',

    // An array containing the names of each room this queue should cover.  If
    // you're not using multiple rooms, this should be an array containing one string.
    // A room name can't start with a '.' or '_' character or contain '/'.
    ROOMS: ['default'],

    // Set this to true if you'd like the logs printed to the console
    PRINT_LOGS: false,

    // The location you'd like your logs saved to.  Make sure that you have
    // write access there!
    // LOG_DIR: 'logs',
    LOG_DIR: 'YOUR_QUEUE_LOGS_DIR',
};

// Merge in dev_params.js if it exists

function isRealObject(obj) {
    return obj instanceof Object && !(obj instanceof Array)
}

function merge(base, extras) {
   Object.keys(extras).forEach(key => {
        if (isRealObject(base[key]) && isRealObject(extras[key])) {
            merge(base[key], extras[key]);
        }
        else {
            base[key] = extras[key];
        }
    });
}

try {
    delete require.cache[require.resolve('./dev_params')];
    const dev_params = require('./dev_params');
    merge(params, dev_params);
}
catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
        throw err;
    }
}

module.exports = params;
