The CAT-SOOP Queue
==================

The Queue is a web application that provides a better way for students in a laboratory setting to
request help or assessment in an orderly fashion without interrupting the flow of their work.  This
queue is intended to be run alongside a [CAT-SOOP](https://cat-soop.org/) instance, but it can
probably be tweaked to run without one.

You can follow the development of this application at <https://notabug.org/jdkaplan/catsoop-queue>.


Installation Instructions
=========================

1. Install the following dependencies:
   * [CAT-SOOP](https://cat-soop.org/) (Make sure to create at least one course)
   * [RethinkDB](https://rethinkdb.com/) (No extra setup required)
   * [Node.js](https://rethinkdb.com/) (Only versions >=6.2 have been tried so far)
   * [NGINX](https://www.nginx.com/) (Or any other reverse proxy)

2. Clone this repository somewhere (I'll call that location `$QUEUE` in these instructions)

3. Edit `$QUEUE/config/params.js` and `$QUEUE/config/www_params.js` to fit your use case.

4. Configure the queue user
   1. The following script will initialize the API token for a user.  Replace `/path/to/cat-soop`
      and `COURSE_ID` with the relevant strings for your setup.  The username `__queue__user__` can
      be replaced with anything that won't be a valid username for anyone in your system:

      ```
    import sys
    sys.path.append('/path/to/cat-soop')

    import catsoop.api as api
    import catsoop.loader as loader

    ctx = loader.spoof_early_load(['COURSE_ID'])

    tok = api.initialize_api_token(ctx, {
        'username': '__queue_user__',
        'name': 'Fake Queue User',
        'email': "doesn't matter",
    })

    print(tok)
      ```

   2. Run the script, save the token it prints out, and create the file `$QUEUE/config/passwords.js`
      with the following contents:

      ```
    module.exports = {
        catsoop: 'YOUR_QUEUE_USER_CATSOOP_API_TOKEN',
    };
      ```

   3. If your queue needs to be able to submit questions or otherwise interact with your course,
      make sure the queue user has the necessary permissions in the course.  To be able to perform
      checkoffs, for example, the queue user needs the "impersonate" permission.

5. Configure NGINX

     Add the following snippet to your config (probably `/etc/nginx/sites-avaliable/foo.conf` or
     `/etc/nginx.conf`, depending on your setup).  Replace `COURSE_NAME` and `PORT` with the name of
     your CAT-SOOP course and the port from the previous step.  Make sure to leave the trailing
     slashes!

     ```
	location /queue/COURSE_NAME/ {
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://localhost:PORT/;
	}
     ```

6. In `$QUEUE`, run `npm install` to install all of the node dependencies.

7. Set up the CAT-SOOP plugin and queue pages

    Some of the queue's functionality is in the form of a CAT-SOOP plugin and a CAT-SOOP page (or
    multiple pages, if you have multiple rooms).  The build system will generate these from your
    `params.js` file, and it will generate new ones each time your configuration changes.  To use
    the new versions each time they generate, make the following symlinks:

      * symlink `$QUEUE/dist/catsoop/plugin` to `$COURSE_ROOT/__PLUGINS__/queue` (or whatever you'd
        like to name the plugin)

      * symlink `$QUEUE/dist/catsoop/pages` to `$COURSE_ROOT/queue` (or wherever you'd like your
        queue to be)

    You may prefer not to use these auto-generated files.  In that case, you can build them manually
    by running `npm run gulp build-catsoop`.  The files will be created in `$QUEUE/dist/catsoop`,
    and you can copy or move them to the locations listed above.

8. In `$QUEUE`, run `npm start` to start the queue.


Common Issues
=============

* `npm start` quits after printing "Finished 'build'" without starting.

   Sometimes RethinkDB doesn't like to quit when asked to, so it needs to be manually SIGKILLed.  I
   usually accomplish this by running `ps` to get a list of processes, and running `kill -9` to stop
   them all simultaneously.

* CAT-SOOP errors with "csq_display_name not defined"

   The queue depends on a question's `csq_display_name` in order to show something meaningful to
   students and staff members.  It also depends on `csq_name` to submit checkoffs, but CAT-SOOP can
   auto-generate that for you.  I recommend setting both variables yourself in each question.


Hacking on the Queue
====================

Here's a general layout of how the queue's modules are broken up and what you need to know to start
tweaking things to fit your use case.

`server` has everything that runs on the server side of the application.  The entry point is
`server/index.js`, which starts an [Express](https://expressjs.com/) server and
a [socket.io](https://socket.io/) server to listen for client connections.  `server/queue.js` is
where all the socket.io handlers get added.  `server/entry_types.js` is where all the entry
operations are specified.  The `db` object that each of these import comes from
`server/rethinkdb.js`, which is a tiny wrapper around the configuration
for [rethinkdbdash](https://github.com/neumino/rethinkdbdash).  `server/authentication.js` has all
the auth flow that sets queue permissions.

The web frontend lives in `www`.  The entry point is `www/js/queue.js`, which contains everything
related to setting up hooks and handlers for queue data operations.  `www/js/view.js` contains
everything related to the display of the queue as a table view, claim view, and student views.  It
mainly works using the [Ractive](https://www.ractivejs.org/) templating and component framework.  The
template HTML files all live in `www/templates/`.  `www/scss` contains all the SCSS files that get
built into flat CSS, and `www/audio` gets included without modification.

The client that the web frontend imports is in `imports/client.js`.

Tests live in `test` and use the [Mocha](https://mochajs.org/) test framework
with [Chai](https://chaijs.com/) for assertions.

Building and running is configured using [Gulp](https://gulpjs.com/).
