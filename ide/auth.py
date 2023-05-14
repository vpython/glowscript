#
# Code for OAuth2 support for flask
#

from google.cloud import secretmanager

from flask import Flask, url_for, session, request, make_response, redirect
from flask import render_template, redirect
from authlib.integrations.flask_client import OAuth
from authlib.common.security import generate_token
import json, base64
import os
from urllib.parse import urlparse, urlunparse

from . import app
from . import routes
from . import models

#
# The 'flask_secret.py' file is not checked in to the git repository, but it's deployed with the application.
# 

try:
    from . import flask_secret as secret    # need to find a better way, but for now, this works
except ImportError:
    from . import default_secret as secret  # if there is no "new" secret, just use the default

app.secret_key = secret.FN_SECRET_KEY

CONF_URL = 'https://accounts.google.com/.well-known/openid-configuration'

authNamespace = {} # we need to create the oauth object lazily, this is a "cache" that let's us build the oauth object only when needed.

def getSetting(name, default=None, returnObject=False):
    """
    Grab some setting from the datastore. If it's not a string, it should be stored as a JSON representation.
    Set returnObject to True to force a JSON load. Otherwise use the type of the default to trigger JSON conversion
    """
    app.logger.info("Getting setting for:" + str(name))
    result = models.Setting.get(name).value
    if result == 'NOT SET':
        result = default
    elif ((default is not None) and (type(default) != type(''))) or returnObject:
        # assume it's a JSON representation of an object, decode it and return that.
        try:
            result = json.loads(result)
        except json.decoder.JSONDecodeError:
            pass # maybe not?

    app.logger.info("Got result:" + str(result))
    return result

def get_preview_users():
    """
    Get the email addresses of users who are permitted to authenticate with a preview version of the app.
    """
    return getSetting('preview_users', ['spicklemire@uindy.edu','basherwo@ncsu.edu'])

def get_preview_suffixes():
    """
    Get the last domain parts of domains permitted for testing.
    """
    return getSetting('preview_domain_suffixes',['appspot.com'])

def check_auth_host_for_preview(auth_host):
    """
    Check to see of the current auth_host has one of the preview domains as a "suffix".
    """

    parts = auth_host.split('.')
    auth_host = '.'.join(parts[-2:]) # just keep last two components

    for phost in get_preview_suffixes():
        if auth_host.endswith(phost):
            return True
    
    return False

def get_project_name():
    """
    Get the project name from the Datastore.
    """
    return getSetting('google_project_name','glowscript') 

def get_redirect_uri():
    return get_base_url() + '/google/auth'  # get the valid redirect URL from the datastore setting

def get_base_url():
    """
    Get the base_url from the datastore
    """
    return getSetting('auth_base_url', default='http://localhost:8080')
#
# Robust way to check for running locally. Also easy to modify.
#
GRL = os.environ.get("GLOWSCRIPT_RUNNING_LOCALLY")
GRL = GRL and GRL.lower()        # let's keep it case insenstive
GRL = GRL not in (None, 'false') # Anything but None or 'false'

class SecretCache:
    """
    We need to cache the client_id and the client_secret.
    """

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
            theSecret = secrets.access_secret_version(name=secret_path).payload.data.decode("utf-8")
            client_secrets = json.loads(theSecret)
            CLIENT_ID = client_secrets.get("FN_CLIENT_ID")
            CLIENT_SECRET = client_secrets.get("FN_CLIENT_SECRET")
            if CLIENT_ID is None:
                raise RuntimeError("We are not running locally, but CLIENT_ID is not set. Dang. Did you mean to set GLOWSCRIPT_RUNNING_LOCALLY?")
        else:
            CLIENT_ID = ''
            CLIENT_SECRET = ''

        self.cache['CLIENT_ID'] = CLIENT_ID
        self.cache['CLIENT_SECRET'] = CLIENT_SECRET

    def getID(self):
        theID = self.cache.get('CLIENT_ID')
        if theID is None:
            self.fillCache()
            theID = self.cache.get('CLIENT_ID')
        return theID

    def getSecret(self):
        theSecret = self.cache.get('CLIENT_SECRET')
        if theSecret is None:
            self.fillCache()
            theSecret = self.cache.get('CLIENT_SECRET')
        return theSecret

secret_cache = SecretCache()

def fillAuthNamespace():
    """
    We've got to get the oath object lazily since the client_id and client_secret are stored in the cloud.
    """
    app.config.update(GOOGLE_CLIENT_ID=secret_cache.getID(), GOOGLE_CLIENT_SECRET=secret_cache.getSecret())

    oauth = OAuth(app)
    oauth.register(
        name='google',
        server_metadata_url=CONF_URL,
        client_kwargs={
            'scope': 'openid email profile'
        }
    )
    authNamespace['oauth'] = oauth
    return oauth

def is_logged_in():
    return ('user' in session) or (routes.is_running_locally())

def get_user_info():
    if routes.is_running_locally():
        return {'email':'localuser@local.host'}

    return session.get('user') or {}

@app.route('/google/login')
def login():
    """
    This is a bit too tricky, but I couldn't find another way. Google only allows specific 
    redirect URLs to use OAuth2. We want to be able to test with alternative version specific servers
    (e.g., 20201227t175543-dot-py38-glowscript.uc.r.appspot.com). The solution here is to embed
    the real hostname in the state parameter and have the 'approved' server redirect back 
    to the host we're actually testing.
    """
    redirect_uri = get_redirect_uri()
    stateDict = {'dstHost':routes.get_auth_host_name(), 'salt':generate_token()}
    state = base64.b64encode(json.dumps(stateDict).encode()).decode()
    oauth = authNamespace.get('oauth') or fillAuthNamespace()
    return oauth.google.authorize_redirect(redirect_uri, state=state)

@app.route('/google/auth')
def auth():
    auth_host = routes.get_auth_host_name()
    stateEncoded = request.args.get('state')

    if stateEncoded:
        stateDict = json.loads(base64.b64decode(stateEncoded.encode()).decode())
        app.logger.info("got state:" + str(stateDict))
        dstHost = stateDict.get('dstHost')
        if dstHost != auth_host:                  # check to see if we are the final server
            oldURL = urlparse(request.url)        # we must be the Google Listed server, redirect
            if dstHost.startswith('localhost'):
                scheme = 'http'                   # no ssl for localhost
            else:
                scheme = oldURL[0]
            newURL = urlunparse((scheme,dstHost) + oldURL[2:])  # build the final URL
            return redirect(newURL)
    else:
        app.logger.info("Yikes! No state found. This shouldn't happen.")

    #
    # If we get to here it means we're the final server. Go ahead and process.
    #
        
    oauth = authNamespace.get('oauth') or fillAuthNamespace()
    token = oauth.google.authorize_access_token()
    user = token['userinfo']
    
    if check_auth_host_for_preview(auth_host): # are we in a preview version?
        if user.get('email') not in get_preview_users():  # only finish login for these guys
            return redirect('/')

    session['user'] = user
    return redirect('/')

@app.route('/google/logout')
def logout():
    session.pop('user', None)
    return redirect('/')
