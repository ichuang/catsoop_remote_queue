# catsoop_remote_queue

This repository provides files to enable catsoop to provide "remote help queue" functionality.

This assumes you're using a `catsoop_queue` node.js server that has been suitably modified.

A copy of a working `catsoop_queue` is included in this repo for reference; this content is released under the same license as in that copy.

## Remote queue

The remote queue allows student tickets to be processed by multiple staff, who interact with students via individual staff video meeting rooms (e.g. zoom).

### Installation

1. Put the `remote_queue` directory and its files, into the top level of your catsoop installation
1. Edit your `catsoop-queue/www/templates/student_view.html` file and make sure it has the same content as [student_view.html](catsoop-queue/www/templates/student_view.html) (the relevant part is in the first `<div>`)
1. Add a link for your staff to access the `remote_queue` staff page; this is where they go to set their video meeting room URL

### Usage

Staff should:

1. Set their video meeting URL, and mark themselves active
2. When a queue ticket is claimed by the staff member, the student will see the staff member's video meeting URL in the popup

Students should:

1. Enter a queue ticket as usual
2. When the your-ticket-has-been-claimed popup appears, click on the URL displayed

## Broadcast message

The broadcast system allows staff to broadcast a message to all catsoop users (or just to all staff users).

### Installation

1. Copy the `broadcast` and `__STATIC__` directories of files into your catsoop setup
2. Copy the python procedures in `preload.py` into your catsoop's top level `preload.py` (modifying any existing `cs_post_load` as appropriate)
3. Modify your `nginx/sites_available/catsoop` (or similar) server configuration to include a section like this, where `/home/catsoop` should be replaced with the full path to the home directory of the user running catsoop:
```
    # special single file for catsoop broadcast messages
    location /msg/broadcast {
        alias /home/catsoop/cs_broadcast.json;
    }
```

