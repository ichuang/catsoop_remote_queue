#!/usr/bin/env python3

import json
import os
import re
import string
import sys

def exclude(filename):
    return filename.endswith('~') or filename.endswith('.swp') or re.match('^#.*#$', filename)

def error(msg):
    print('Error: {}'.format(msg))
    exit(1)

def mkdir(d):
    if not os.path.isdir(d):
        try:
            os.makedirs(d, exist_ok=True)
        except OSError:
            error('{} already exists and is not a directory'.format(d))

def build_templates(src, dest, context):
    mkdir(dest)
    for parent_dir, child_dirs, templates in os.walk(src):
        for template in templates:
            if exclude(template): continue
            template_src = os.path.join(parent_dir, template)
            with open(template_src) as f:
                template_content = string.Template(f.read())
            template_dest = os.path.join(dest, os.path.relpath(template_src, src))
            mkdir(os.path.dirname(template_dest))
            with open(template_dest, 'w') as f:
                f.write(template_content.substitute(**context))


params, destination = sys.argv[1:]
params = json.loads(params)

room_destination = os.path.join(destination, 'pages')
plugin_destination = os.path.join(destination, 'plugin')


# Make plugin
build_templates(params['CATSOOP']['PLUGIN_TEMPLATE'], plugin_destination, {
        'queue_room': repr(params['ROOMS'][0] if len(params['ROOMS']) == 1 else None),
        'queue_url_root': repr(params['URL_ROOT']),
})


if not params['ROOMS']:
    error('No room names specified')

# In the case of only one room, there's no need for a root page, so this just
# makes the one room page and exits
if len(params['ROOMS']) == 1:
    build_templates(params['CATSOOP']['ROOM_TEMPLATE'], room_destination, {
            'queue_room_name': params['ROOMS'][0],
            'queue_plugin_name': params['CATSOOP']['PLUGIN_NAME'],
    })
    exit(0)

# Make the root template
build_templates(params['CATSOOP']['ROOM_SELECTION_TEMPLATE'], room_destination, {
        'rooms': repr(params['ROOMS']),
})

# Make a room page for each room
for room in params['ROOMS']:
    build_templates(params['CATSOOP']['ROOM_TEMPLATE'], os.path.join(room_destination, room), {
            'queue_room_name': room,
            'queue_plugin_name': params['CATSOOP']['PLUGIN_NAME'],
    })
