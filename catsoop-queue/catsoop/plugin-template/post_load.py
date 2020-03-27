# Add the queue script and stylesheet to the page

def urljoin(*parts):
    return '/'.join(parts).replace('//', '/')

if queue_enable:
    if queue_page:
        if queue_is_staff:
            load_staff_queue = cs_form.get('queue_view', 'staff') != 'student'
        elif queue_is_student_staff:
            load_staff_queue = cs_form.get('queue_view', 'student') == 'staff'
        else:
            load_staff_queue = False

        view = 'staff_view' if load_staff_queue else 'student_static'
    else:
        load_staff_queue = False
        view = 'student_popup'

    stylesheets = [
        'queue.css',
    ]

    scripts = [
        'queue.js',
    ]

    css = '\n'.join(
        '<link href="{}" rel="stylesheet">'.format(urljoin(${queue_url_root}, 'css', sheet))
        for sheet in stylesheets
    )

    js = '\n'.join(
        '<script src="{}"></script>'.format(urljoin(${queue_url_root}, 'js', script))
        for script in scripts
    )

    js += '''
    <script>
    catsoop.plugins.queue = {{
        url_root: '{url_root}',
        is_staff: {is_staff},
        container: {container},
        view: '{view}',
        room: '{room}',
    }};
    </script>
    '''.format(
        url_root = ${queue_url_root},
        is_staff = 'true' if queue_is_staff or queue_is_student_staff else 'false',
        container = '"body"' if view == 'student_popup' else '"#queue-container"',
        view = view,
        room = queue_room or '',
    )

    cs_scripts += css
    cs_content += js
