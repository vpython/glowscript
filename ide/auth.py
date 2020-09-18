#
# Code for OAuth2 support for flask
#

import flask
import functools
import google.oauth2.credentials
import googleapiclient.discovery
from google.cloud import secretmanager

import os
import json

from flask import request
from authlib.client import OAuth2Session

from . import app
from . import routes
from . import models

try:
    from . import secret
except ImportError:
    from . import default_secret as secret  # if there is no "new" secret, just use the default

app.secret_key = secret.FN_SECRET_KEY # set up encryption key for flask

ACCESS_TOKEN_URI = 'https://www.googleapis.com/oauth2/v4/token'
AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&prompt=consent'

AUTHORIZATION_SCOPE ='openid email profile'

AUTH_REDIRECT_URI = os.environ.get("FN_AUTH_REDIRECT_URI", default=False)
BASE_URI = os.environ.get("FN_BASE_URI", default=False)

def get_project_name():
    web_setting = models.Setting.get('google_project_name')
    return web_setting.value

#
# Robust way to check for running locally. Also easy to modify.
#
GRL = os.environ.get("GLOWSCRIPT_RUNNING_LOCALLY")
GRL = GRL and GRL.lower()        # let's keep it case insenstive
GRL = GRL not in (None, 'false') # Anything but None or 'false'

class ModuleCache:

    def __init__(self):
        self.cache = {}

    def fillCache(self):
        if (not GRL):
            #
            # If we're not running locally, we should get the secrets from the secret manager.
            #
            # this got much more complicated by storing the project id in the datastore.
            # we cannot accesss the datastore unless we are in application context but that
            # means it's got to be cached somehow if we don't want to have to keep pulling 
            # it from the datastore on every request. Bleah.
            #

            GOOGLE_PROJECT_ID=get_project_name()
            CLIENT_SECRET_VERSION=os.environ.get('CLIENT_SECRET_VERSION') or '1'
            from google.cloud import secretmanager
            secrets = secretmanager.SecretManagerServiceClient()
            secret_path = f"projects/{GOOGLE_PROJECT_ID}/secrets/OAUTH_CLIENT_SECRETS/versions/{CLIENT_SECRET_VERSION}"
            theSecret = secrets.access_secret_version(secret_path).payload.data.decode("utf-8")
            client_secrets = json.loads(theSecret)
            CLIENT_ID = client_secrets.get("FN_CLIENT_ID")
            CLIENT_SECRET = client_secrets.get("FN_CLIENT_SECRET")
            if CLIENT_ID is None:
                raise RuntimeError("We are not running locally, but CLIENT_ID is not set. Dang. Did you mean to set GLOWSCRIPT_RUNNING_LOCALLY?")
        else:
            CLIENT_ID = ''
            CLIENT_SECRET = ''

        self.cache['CLIENT_ID'] = CLIENT_ID
        self.cache['CLINET_SECRET'] = CLIENT_SECRET

    def getID(self):
        theID = self.cache.get('CLIENT_ID')
        if theID is None:
            self.fillCache()
            theID = self.cache.get('CLIENT_ID')
        return theID

    def getSecret(self):
        theSecret = self.cache.get('CLINET_SECRET')
        if theSecret is None:
            self.fillCache()
            theSecret = self.cache.get('CLINET_SECRET')
        return theSecret

module_cache = ModuleCache()

AUTH_TOKEN_KEY = 'auth_token'
AUTH_STATE_KEY = 'auth_state'

def is_logged_in():
    return (AUTH_TOKEN_KEY in flask.session) or (routes.is_running_locally())

def build_credentials():
    if not is_logged_in():
        raise Exception('User must be logged in')

    oauth2_tokens = flask.session.get(AUTH_TOKEN_KEY)
    
    return google.oauth2.credentials.Credentials(
                oauth2_tokens['access_token'],
                refresh_token=oauth2_tokens['refresh_token'],
                client_id=module_cache.getID(),
                client_secret=module_cache.getSecret(),
                token_uri=ACCESS_TOKEN_URI)

def get_user_info():
    
    if routes.is_running_locally():
        return {'email':'localuser@local.host'}

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

    session = OAuth2Session(module_cache.getID(), module_cache.getSecret(),
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
        return flask.redirect('/index')
    
    session = OAuth2Session(module_cache.getID(), module_cache.getSecret(),
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

