'''
remote queue

Main catsoop entry point
'''
import os
import re
import sys
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
class RemoteQueue:

    db_name = "remote_queue"

    def __init__(self, verbose=True):
        self.verbose = verbose
        #below line is getting info from the .py files in __USERS__ folder
        user_role = cs_user_info.get('role', None)
        self.is_authorized = user_role in {'LA', 'TA', 'UTA', 'Admin', 'Instructor'}

        #might want a more robust way to check this in future!
        # self.is_remote = 'NON-INSTITUTE' in cs_user_info.get('stellar_affiliation','')
        self.is_remote = True
        self.my_url = "/".join([cs_url_root] + cs_path_info)

        # current_user = cs_user_info['username']

    def dispatch(self, form_data=None):
        '''
        main entry point to generate html responses
        '''
        if form_data is None:
            return ""
        if not len(form_data) and self.is_authorized:
            return self.show_form()
        if 'save' in form_data and self.is_authorized:
            return self.process_form_save(form_data)
        if 'get' in form_data:
            return self.ajax_get_url(form_data)
        if 'go' in form_data:
            return self.ajax_go_url(form_data)
        if self.is_authorized:
            return self.show_form()
        return ""
        #return "<pre>%s</pre>" % form_data   # for debugging

    def ajax_get_url(self, form_data):
        '''
        If staff claimant is active, and has remote url, then return a link to this service, but with "go=<staffuser>"
        This will let us log actual number of clicks to start video sessions.
        '''
        global cs_handler, content_type, response
        staffuser = form_data.get('get')
        data = self.get_current_url_data(staffuser)
        #if the staff member has toggled the "You are active" to True and for now, person is not affiliated with institute
        if data.get("active") and self.is_remote:
            html = "<button><font color='blue' size='+2'>Please <a href='%s' target='_blank'>click here to start your remote queue session</a></font></button>" % data.get("url")
            #go_url = "%s?go=%s" % (self.my_url, staffuser)
            #html = "<font color='blue'>Please <a href='%s' target='_blank'>click here to start your remote queue session</a></font>" % go_url
            LOGGER.warn("[RemoteQueue] for user=%s, staff=%s, returning remote queue html=%s!" % (cs_username, staffuser, html))
        else:
            html = ""
        cs_handler = 'raw_response'
        content_type = "text/html"
        response = html
        return ""

    def ajax_go_url(self, form_data):
        '''
        If staff claimant is active, and has remote url, then return that as a HTML redirect
        Log action
        '''
        global cs_handler, content_type, response
        staffuser = form_data.get('get')
        data = self.get_current_url_data(staffuser)
        #if the staff member has toggled the "You are active" to True and for now, person is not affiliated with institute
        if data.get("active") and self.is_remote:
            html = """<meta http-equiv="Refresh" content="0; url=%s" />""" % data.get("url")
            LOGGER.warn("[RemoteQueue] GO url clicked for user=%s, staff=%s!" % (cs_username, staffuser))
        else:
            html = ""
        cs_handler = 'raw_response'
        content_type = "text/html"
        response = html
        return ""

    def get_current_url_data(self, username=None):
        '''
        Get user's current remote queue URL setting
        '''
        username = username or cs_username
        data = csm_cslog.most_recent(self.db_name, [], username)
        if not data:
            LOGGER.info("[RemoteQueue] no existing url for username=%s!" % (username))
            return {}
        return data

    def save_url_data(self, url=None, active=False):
        '''
        Save URL data (url and active or not)
        '''
        data = {'url': url, 'active': active}
        csm_cslog.update_log(self.db_name, [], cs_username, data)
        LOGGER.info("[RemoteQueue] saved data=%s for username=%s!" % (data, cs_username))

    def process_form_save(self, form_data):
        '''
        Save data from form
        '''
        url = form_data.get("url")
        active = form_data.get("active", False)
        self.save_url_data(url, active)
        html = "<font color='green'>saved</font>"
        return self.show_form(extra_html=html)

    def show_form(self, extra_html=""):
        '''
        Show input form asking for staff member's remote URL
        '''
        data = self.get_current_url_data()
        active = data.get("active", "off")
        checked = ""
        if active in ['on']:
            checked = " checked "
        html = "<form method='POST'>"
        html += '''<p>Your video url: <input type="text" size=100 value="%s" name="url"></input></p>''' % data.get("url", "")
        html += """<p>You are active?  No <label class="switch">
                    <input type="checkbox" name="active" %s>
                      <span class="slider round"></span>
                   </label> Yes</p>
                """ % checked
        html += '''<p><input type="submit" name="save"></input></p>'''
        html += "</form>"
        html += extra_html
        return html

#-----------------------------------------------------------------------------
# this tells catsoop to use the dispatch function for all processing

RQ = RemoteQueue()
cs_problem_spec = RQ.dispatch(cs_form)
