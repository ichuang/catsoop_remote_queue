
def cs_post_load(context):

    user_role = context.get("cs_user_info", {}).get("role", None)
    is_authorized = user_role in {"Student", "LA", "TA", "UTA", "Admin", "Instructor"}

    # load js for broadcast messaging
    if is_authorized:
        cs_add_broadcast_messaging_js(context)

#-----------------------------------------------------------------------------

def cs_add_broadcast_messaging_js(context):
    '''
    Add js which enables receipt of broadcast messages
    '''
    user_role = context.get('cs_user_info', {}).get('role', None)
    is_staff = user_role in {'LA', 'TA', 'UTA', 'Admin', 'Instructor'}
    py2js = {True: 'true', False: 'false'}
    is_staff = py2js[is_staff]
    context['cs_scripts'] += '<script type="text/javascript"">CS_USER_IS_STAFF=%s</script>' % is_staff
    context['cs_scripts'] += '<script type="text/javascript"">CS_COURSE_URL="%s/msg"</script>' % context.get("cs_url_root") # special nginx url to lower load on catsoop
    context['cs_scripts'] += '<script type="text/javascript" src="COURSE/broadcast.js"></script>'
    context['cs_scripts'] += """<link rel="stylesheet" href="COURSE/broadcast.css">"""

