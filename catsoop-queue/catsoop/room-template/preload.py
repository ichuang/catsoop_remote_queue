cs_title = "${queue_room_name}"
cs_long_name = "${queue_room_name}"

queue_enable = True
queue_page = True
queue_room = '${queue_room_name}'

import os
cs_template = os.path.join(
    cs_data_root,
    'courses',
    cs_course,
    '__PLUGINS__',
    '${queue_plugin_name}',
    '__MEDIA__',
    'templates/queue.template',
)
