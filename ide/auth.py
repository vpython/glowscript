#
# Code for OAuth2 support for flask
#

import flask
import functools
import google.oauth2.credentials
import googleapiclient.discovery
import os

from flask import request
from authlib.client import OAuth2Session

from . import secret
from . import app

ACCESS_TOKEN_URI = 'https://www.googleapis.com/oauth2/v4/token'
AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&prompt=consent'

AUTHORIZATION_SCOPE ='openid email profile'

AUTH_REDIRECT_URI = os.environ.get("FN_AUTH_REDIRECT_URI", default=False)
BASE_URI = os.environ.get("FN_BASE_URI", default=False)
CLIENT_ID = os.environ.get("FN_CLIENT_ID", default=secret.FN_CLIENT_ID)
CLIENT_SECRET = os.environ.get("FN_CLIENT_SECRET", default=secret.FN_CLIENT_SECRET)

AUTH_TOKEN_KEY = 'auth_token'
AUTH_STATE_KEY = 'auth_state'

def is_logged_in():
    return AUTH_TOKEN_KEY in flask.session

def build_credentials():
    if not is_logged_in():
        raise Exception('User must be logged in')

    oauth2_tokens = flask.session.get(AUTH_TOKEN_KEY)
    
    return google.oauth2.credentials.Credentials(
                oauth2_tokens['access_token'],
                refresh_token=oauth2_tokens['refresh_token'],
                client_id=CLIENT_ID,
                client_secret=CLIENT_SECRET,
                token_uri=ACCESS_TOKEN_URI)

def get_user_info():
    
    print("In get_user_info:" + str(is_logged_in()))
    credentials = build_credentials()

    oauth2_client = googleapiclient.discovery.build(
                        'oauth2', 'v2',
                        credentials=credentials)
    return oauth2_client.userinfo().get().execute()


def no_cache(view):
    @functools.wraps(view)
    def no_cache_impl(*args, **kwargs):
        response = flask.make_response(view(*args, **kwargs))
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
        return response

    return functools.update_wrapper(no_cache_impl, view)


@app.route('/google/login')
@no_cache
def google_login():

    session = OAuth2Session(CLIENT_ID, CLIENT_SECRET,
                            scope=AUTHORIZATION_SCOPE,
                            redirect_uri=AUTH_REDIRECT_URI)
  
    uri, state = session.create_authorization_url(AUTHORIZATION_URL)

    flask.session[AUTH_STATE_KEY] = state
    print("saving auth state:", state, flask.session.get(AUTH_STATE_KEY))
    flask.session.permanent = True

    return flask.redirect(uri, code=302)

@app.route('/google/auth')
@no_cache
def google_auth_redirect():
    req_state = flask.request.args.get('state', default=None, type=None)

    print("checking auth state:", req_state)
    print("Current session state:", flask.session.get(AUTH_STATE_KEY))

    if req_state != flask.session.get(AUTH_STATE_KEY):
        """
        Sometimes the browser just gets confused. Go home and try again.
        """
        response = flask.redirect(flask.url_for('index'))
        return response
    
    session = OAuth2Session(CLIENT_ID, CLIENT_SECRET,
        scope=AUTHORIZATION_SCOPE,
        state=flask.session.get(AUTH_STATE_KEY),
        redirect_uri=AUTH_REDIRECT_URI)

    oauth2_tokens = session.fetch_access_token(
                        ACCESS_TOKEN_URI,            
                        authorization_response=flask.request.url)

    flask.session[AUTH_TOKEN_KEY] = oauth2_tokens

    return flask.redirect(BASE_URI, code=302)

@app.route('/google/logout')
@no_cache
def google_logout():
    print("in logout")
    flask.session.pop(AUTH_TOKEN_KEY, None)
    flask.session.pop(AUTH_STATE_KEY, None)

    return flask.redirect(BASE_URI, code=302)

