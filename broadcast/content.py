'''broadcast: real-time announcements to all catsoop users of this site

Staff: access this page to enter a message and submit it to be
broadcast.  The message is stored on the server as a json dict, with
timestamp and author.  All messages are also archived in a catsoop log
file.

Students: javascript code (automatically loaded) polls the server for
a broadcast message, and displays it if unexpired (e.g. within 5
minutes of creation).  Once marked as having been seen, it is not
redisplayed.

'''
import os
import re
import sys
import json
import time
import logging
import datetime
import traceback

LOGGER = logging.getLogger("cs")

#-----------------------------------------------------------------------------
# main dispatch function
'''
How this works:

At the bottom of this file, following lines are executed:
    RQ = RemoteQueue()
    cs_problem_spec = RQ.dispatch(cs_form)

This tells catsoop to use the dispatch function of the RemoteQueue for all processing

RemoteQueue.dispatch
    Given the form data for the page and the person viewing the page, it determines what the person should see.
    If staff and form_data is empty: show the form for inputting video URL
    If staff and person has saved info/pressed submit: show 'saved' and save data and update remotequeue database:
            data = {'url': url, 'active': active}
            csm_cslog.update_log(self.db_name, [], cs_username, data)
    If person is not staff: run ajax_get_url
'''
class BroadcastMessage:

    db_name = "broadcast_message"
    MSG_FILE = "~/cs_broadcast.json"

    def __init__(self, verbose=True):
        self.verbose = verbose
        user_role = cs_user_info.get('role', None)
        self.is_staff = user_role in {'LA', 'TA', 'UTA', 'Admin', 'Instructor'}
        self.is_authorized = user_role in {'TA','Admin', 'Instructor'}
        self.my_url = "/".join([cs_url_root] + cs_path_info)
        self.course = _course_number

    def dispatch(self, form_data=None):
        '''
        main entry point to generate html responses
        '''
        if form_data is None:
            return ""
        if not len(form_data) and self.is_authorized:
            return self.show_form()
        if 'Broadcast' in form_data and self.is_authorized:
            return self.process_form_save(form_data)
        if 'get' in form_data:
            return self.ajax_get_msg(form_data)
        if self.is_authorized:
            return self.show_form()
        return ""
        #return "<pre>%s</pre>" % form_data   # for debugging

    def ajax_get_msg(self, form_data):
        '''
        If staff claimant is active, and has remote url, then return a link to this service, but with "go=<staffuser>"
        This will let us log actual number of clicks to start video sessions.
        '''
        global cs_handler, content_type, response
        data = self.get_message()
        html = json.dumps(data)
        cs_handler = 'raw_response'
        content_type = "application/json"
        response = html
        return ""

    def get_message(self, get_all=False):
        '''
        Get current message (if all==False); else return all messages, sorted from recent to oldest
        '''
        loginfo = (self.course, [self.db_name], "all")
        if get_all:
            data = csm_cslog.read_log(*loginfo)
            return data
        data = csm_cslog.most_recent(*loginfo, lock=False)
        if not data:
            return {}
        if data.get("audience")=="staff":
            if self.is_staff:
                return data
            return {}
        return data

    def save_message(self, msg=None, audience=None, write_to_file=True):
        '''
        Save URL data (url and active or not)
        
        if write_to_file then also write JSON to self.MSG_FILE (accessed directly by nginx, to reduce catsoop load)
        '''
        data = {'msg': msg, 'creator': cs_username, 'audience': audience, 'datetime': str(datetime.datetime.now())}
        csm_cslog.update_log(self.course, [self.db_name], "all", data)
        LOGGER.info("[BroadcastMessage] saved data=%s for username=%s!" % (data, cs_username))
        fn = os.path.expanduser(self.MSG_FILE)
        with open(fn, 'w') as ofp:
            ofp.write(json.dumps(data))

    def process_form_save(self, form_data):
        '''
        Save data from form
        '''
        msg = form_data.get("msg")
        everyone = form_data.get("everyone", "staff")
        audience = everyone
        if audience=="on":
            audience = "all"
        if msg:
            self.save_message(msg, audience)
            html = "<font color='green'>Message broadcast!</font>"
        else:
            html = "<font color='red'>Empty message: nothing done</font>"
        return self.show_form(extra_html=html)

    def show_form(self, extra_html=""):
        '''
        Show input form asking for message
        Also show list of old messages
        '''
        data = self.get_message(get_all=True)
        html = "<p>Fill in this form to immediately broadcast a message to users currently connected to the course's sytem.  "
        html += "Select 'staff only' to limit the message to just staff, or 'everyone' to send to all users</p>"
        html += "<form method='POST'>"
        html += '''<p>New (short) message to broadcast: <input type="text" size=120 value="" name="msg"></input></p>'''
        html += """<p>Send to staff only <label class="switch">
                    <input type="checkbox" name="everyone">
                      <span class="slider round"></span>
                   </label> Broadcast to everyone: students and staff</p>
                """
        html += '''<p><input type="submit" name="Broadcast"></input></p>'''
        html += "</form>"
        html += extra_html

        html += "<div>"
        html += "<table><tr><th>Date</th><th>Author</th><th>Audience</th><th>Message</th></tr>"
        for msginfo in data[::-1]:
            html += "<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>" % (msginfo.get("datetime"),
                                                                               msginfo.get("creator"),
                                                                               msginfo.get("audience"),
                                                                               msginfo.get("msg"))
        html += "</table>"
        html += "</div>"

        return html

#-----------------------------------------------------------------------------
# this tells catsoop to use the dispatch function for all processing

BM = BroadcastMessage()
cs_problem_spec = BM.dispatch(cs_form)
