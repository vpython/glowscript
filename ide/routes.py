# -*- coding: utf-8 -*-

# READ THIS CAREFULLY:

# With the earlier Google App Engine based on Python 2.5, encoded url's sent
# to api.py from ide.js that contained escaped characters, such as %20 for space,
# were not modified before being routed to handlers such as ApiUserFolder.
# However, the Python 2.7 version decodes escaped characters (e.g. %20 -> space)
# before sending the url to a handler. Because the datastore at glowscript.org
# already contains entities tied to keys that contain escaped characters, it
# was necessary in upgrading to using Python 2.7 to use self.request.path here
# because self.request.path is the unmodified version of the url sent to api.py.
# Note that in ide.js all work with folders and programs is done with decoded
# forms (e.g. space, not %20), but urls are encoded at the time of sending to api.py.

# Consider the following code, which is similar in all request handlers.
# webapp2 delivers user, folder, and name, so why do we then re-parse self.request.path
# to re-acquire these variables? When we tried eliminating the re.search machinery,
# users whose user name contained a space could no longer reach their files.
# For the reasons noted above, this duplication of effort is necessary.
# class ApiUserFolderProgram(ApiRequest):
#     def get(self, user, folder, name):
#         m = re.search(r'/user/([^/]+)/folder/([^/]+)/program/([^/]+)', self.request.path)
#         user = m.group(1)
#         folder = m.group(2)
#         name = m.group(3)

# python_version 2.7 works and can be deployed with Google App Engine Launcher 1.7.6

localport = '8080'     # normally 8080
weblocs_safe = ["glowscript.org", "localhost:"+localport, "127.0.0.1:"+localport, 
                "spvi.net","appspot.com", "devbasherwo.org"] # safe for now

import json
from io import BytesIO
import zipfile
import cgi
import datetime
import uuid
import flask
import traceback
import functools

from google.cloud import ndb
from google.auth.transport import requests
from google.cloud import ndb

from .models import User, Program, Folder, Setting

import os, re, base64, logging # logging.info(string variable) prints to GAE launcher log, for debugging
from datetime import datetime

# URI encoding (percent-escaping of all characters other than [A-Za-z0-9-_.~]) is used for names
# of users, folders and programs in the model and in URIs and in JSON, so no (un)escaping is required.  
# At the moment all of these identifiers are case sensitive.
def chrange(b,e): return set(chr(x) for x in range(ord(b), ord(e)+1))
unreserved = chrange('A','Z') | chrange('a','z') | chrange('0','9') | set("-_.~")

# See documentation of db.Model at https://cloud.google.com/appengine/docs/python/datastore/modelclass
# Newer ndb:                       https://cloud.google.com/appengine/docs/standard/python/ndb/db_to_n

emulator = os.environ.get('DATASTORE_EMULATOR_HOST')

def ndb_wsgi_middleware(wsgi_app):
    """
    This is helpful for Flask and NDB to play nice together.
    
    https://cloud.google.com/appengine/docs/standard/python3/migrating-to-cloud-ndb

    We need to be able to access NDB in the application context.
    If we're running a local datastore, make up a dummy project name.
    """

    project = emulator and 'glowscript-dev' or None
    
    client = ndb.Client(project=project) # for user data, folders, and programs
    
    def middleware(environ, start_response):
    
        if False and environ.get('REQUEST_METHOD') == 'PUT':
            #
            # this can be useful for debugging late exceptions in PUT operations
            # just remove 'False' above.
            #
            
            import pdb
            pdb.set_trace()
        
        with client.context():
            return wsgi_app(environ, start_response)

    return middleware

#
# Now let's deal with the app
#

from . import app, auth

app.wsgi_app = ndb_wsgi_middleware(app.wsgi_app)  # Wrap the app in middleware.

#
# set up logging
#

import logging
import google.cloud.logging # Don't conflict with standard logging
from google.cloud.logging.handlers import CloudLoggingHandler

client = google.cloud.logging.Client()
handler = CloudLoggingHandler(client)
handler.setLevel(logging.INFO)
app.logger.addHandler(handler)

def get_weblocs():
    return auth.getSetting('weblocs', weblocs_safe)

#
# These next few routes are to serve static files in dev mode. GAE will handle these
# in production
#

module_cache = {}  # cache some things, like ide.js, so we don't need to keep reloading them

#
# we need to replace WEBSERVER_NAME_TEMPLATE in ide.js with the correct
# webserver name from the datastore.
#

def load_idejs():
    try:
        ide_js = open('ide/ide.js').read()
        module_cache['ide.js'] = ide_js
    except:
        ide_js='Ack! Cannot load ide.js'
        traceback.print_exc()

    return ide_js

def load_runjs():
    try:
        with open('untrusted/run.js') as f:
            run_js = f.read()
            module_cache['run.js'] = run_js
    except:
        run_js='Ack! Cannot load ide.js'
        traceback.print_exc()

    return run_js

@app.route('/css/<path:filename>')
def css_static(filename):
    return flask.send_from_directory('../css', filename)

def no_cache(view):
    @functools.wraps(view)
    def no_cache_impl(*args, **kwargs):
        response = flask.make_response(view(*args, **kwargs))
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '-1'
        return response

    return functools.update_wrapper(no_cache_impl, view)

@app.route('/ide.js')
@no_cache
def idejs_static():
    """
    ide.js is a special file in that it has the `approved` webserver name embedded in it.
    (e.g., "glowscript.org"). Since we're deploying on development/test servers as well
    we need to be able to swap out the approved name at runtime. This scheme let's us
    swap it out the first time it's requested, and cache the result in memory so
    we can deliver it again without having to re-read the file from disk each time.
    """
    ide_js = module_cache.get('ide.js')
    
    if not ide_js:
        ide_js = load_idejs()

    host_name = get_auth_host_name()
    if auth.check_auth_host_for_preview(host_name): # are we running in a preview?
        ide_js = ide_js.replace('WEBSERVER_NAME_TEMPLATE',host_name) 
        ide_js = ide_js.replace('SANDBOX_PREFIX_TEMPLATE','https://') # no sandbox
    elif host_name.startswith('www.'):
        ide_js = ide_js.replace('WEBSERVER_NAME_TEMPLATE',host_name[4:])
        ide_js = ide_js.replace('SANDBOX_PREFIX_TEMPLATE','https://sandbox.')
    else:
        ide_js = ide_js.replace('WEBSERVER_NAME_TEMPLATE',host_name)
        ide_js = ide_js.replace('SANDBOX_PREFIX_TEMPLATE','https://sandbox.')

    return ide_js,200

@app.route('/lib/<path:filename>')
def lib_static(filename):
    cache_timeout = None
    if is_running_locally():
        cache_timeout=0
    return flask.send_from_directory('../lib', filename, cache_timeout=cache_timeout)

@app.route('/package/<path:filename>')
def package_static(filename):
    return flask.send_from_directory('../package', filename)

@app.route('/docs/<path:filename>')
def docs_static(filename):
    return flask.send_from_directory('../docs', filename)

@app.route(r'/favicon.ico')
def favicon_static():
    return flask.send_from_directory('../static/images', r'favicon.ico')
    
@app.route('/untrusted/<path:filename>')
@no_cache
def untrusted_static(filename):
    if filename == 'run.js':
        run_js = module_cache.get('run.js')
        if not run_js:
            run_js = load_runjs()

        host_name = get_auth_host_name()
        if host_name.startswith('sandbox.'):
            host_name = '.'.join(host_name.split('.')[1:]) # take off the sandbox.
        run_js = run_js.replace('HOST_NAME_TEMPLATE',host_name)
        return run_js, 200, {'content_type':'text/plain'}

    return flask.send_from_directory('../untrusted', filename)

#
# The root route
#

@app.route('/')
@app.route('/index')
def root():
    return flask.render_template('index.html')

#
# Here are some utilities for validating names, hosts, and usernames
#

def validate_names(*names):
    # TODO: check that the encoding is 'normalized' (e.g. that unreserved characters are NOT percent-escaped).
    for name in names:
        for c in name:
            if c not in unreserved and c != "%":
                return False
    return True

def get_auth_host_name():
    return flask.request.headers.get('Host')

def trim_auth_host_name():
    #
    # if the host name has more than two parts, return the last two parts only.
    # This allows appspot version to be tested that are not in production 
    # e.g., 20201227t175543-dot-glowscript.appspot.com
    #

    host_header = get_auth_host_name()
    parts = host_header.split('.')
    host_header = '.'.join(parts[-2:]) if len(parts)>2 else host_header
    return host_header

def authorize_host():
    host_header = trim_auth_host_name()
    result =  host_header in get_weblocs()

    if not result:
        app.logger.info("Host failed to authorize:" + host_header + ":" + str(get_weblocs()))

    return result
    
def authorize_user(username):
    if not authorize_host():
        return False
        
    if auth.is_logged_in():
        logged_in_email = auth.get_user_info().get('email')
        ndb_user = ndb.Key("User", username).get()
        if not ndb_user or ndb_user.email != logged_in_email or flask.request.headers.get('X-CSRF-Token') != ndb_user.secret:
            print("user not authorized username:%s logged_in_email: %s ndb_user.email %s" % (str(username), str(logged_in_email), str(ndb_user.email)))
            return False
        return True
    else:
        print("in authorize_user, but user not logged in.")
        return False

def override(user):
    # return True if superuser, to permit the recovery of private programs for a user who can no longer log in
    return str(user) in ['basherwo@ncsu.edu','spicklemire@uindy.edu']

class ParseUrlPathException( Exception ):
    pass

def parseUrlPath(theRegexp, numGroups):
    """
    This is boiler plate code for a lot of the route handlers.
    
    All these handlers require a user, but there's also the authenticated user.
    
    Inputs:
        theRegExp: A regular expression to evaluate the path
        numGroups: How many groups are in the regexp.
        
    It is assumed that the 'user' (typically the owner of the folder) is group 1.
    
    It is further assumed that all the names need to be checked for escaped values.

    returns:
        numGroups strings
        folderOwnerUser (from ndb) or None
        logged_in_email (if the someone is currently logged in)
        
    throws:
        ParseUrlPathException which has an error message + HTTP return code
    """
    folder_owner = None
    
    if not authorize_host():
        raise ParseUrlPathException('Unauthorized Host',403)

    names = ['']*numGroups

    #
    # Monkey business to get the raw URL. It turns out flask.request.path is
    # already escaped, but flask.request.base_url is the original unadulterated URL
    # from the API call. Split on '/', get rid of the protocol, host, port and
    # restore the unescaped path.
    #
    # Another approach might be to escape the unescaped names before using 
    # them as keys in ndb? That might actually be simpler.
    #
    
    rawPath = '/' + '/'.join(flask.request.base_url.split('/')[3:])
    
    try:
        """
        Easy way to guarantee numGroups valid strings regardless.
        """
        m = re.search(theRegexp, rawPath)
        for i in range(numGroups):
            value = m.group(i+1)
            if value:
                names[i] = value
    except:
        raise ParseUrlPathException('Parsing URL failed', 400)
        
    if names and not validate_names(*names):
        raise ParseUrlPathException('Invalid string in URL', 400)

    if auth.is_logged_in():
        logged_in_email = auth.get_user_info().get('email')
    else:
        logged_in_email = '' # anonymous user

    if names:
        folder_owner = ndb.Key("User",names[0]).get()

    return names, folder_owner, logged_in_email

def is_running_locally():
    #
    # Just use the environment. Simpler!
    #
    return auth.GRL
#
# The rest are the api routes and the main page route
#

@app.route('/api/login')
def api_login():
    if auth.is_logged_in():
        email = auth.get_user_info().get('email')
        ndb_user = User.query().filter(User.email == email).get()
        if ndb_user:
            return { 'state':'logged_in', 'username':ndb_user.key.id(), 'secret':ndb_user.secret, 'logout_url':'/google/logout'}
        else:
            nickname = email
            if "@" in nickname: nickname = nickname.split("@",2)[0]
            return  { 'state':'new_user', 'suggested_name':nickname } 
    else:
        return { 'state':'not_logged_in', 'login_url':'/google/login' }


@app.route('/api/user')
def ApiUsers():
    N = User.query().count()
    return "Nusers = " + str(N)

@app.route('/api/user/<username>', methods=['GET','PUT'])
def ApiUser(username):
    """
    ndb_user is the existing user object for 'user'
    email is the email address of the logged in user
    """    

    try:
        names, ndb_user, email = parseUrlPath(r'/api/user/([^/]+)', 1)
    except ParseUrlPathException as pup:
        errorMsg = pup.args[0]
        code = pup.args[1]
        return flask.make_response(errorMsg, code)
    
    user = names and names[0] or ''
    
    if flask.request.method == 'GET':

        # This is just used to validate that a user does/doesn't exist

        if not ndb_user:
            return flask.make_response('Unknown username', 404)

        return {}

    elif flask.request.method == 'PUT':
    
        if email:
            if ndb_user: 
                return flask.make_response("user already exists", 403)

            # TODO: Make sure *nothing* exists in the database with an ancestor of this user, just to be sure

            ndb_user = User( id=user, email=email, secret=base64.urlsafe_b64encode(os.urandom(16)) )
            ndb_user.put()

            ndb_my_programs = Folder( parent=ndb_user.key, id="MyPrograms", isPublic=True )
            ndb_my_programs.put()
            
            ndb_my_programs = Folder( parent=ndb_user.key, id="Private", isPublic=False )
            ndb_my_programs.put()
            
            return {}

    else:
        return flask.make_response('Invalid API operation', 400)


@app.route('/api/user/<username>/folder/')
def ApiUserFolders(username):

    """
    ndb_user is the existing user object for 'user'
    email is the email address of the logged in user
    """    

    try:
        names, folder_owner, logged_in_email = parseUrlPath(r'/api/user/([^/]+)/folder/', 1)
    except ParseUrlPathException as pup:
        errorMsg = pup.args[0]
        code = pup.args[1]
        return flask.make_response(errorMsg, code)
    
    user = names and names[0] or ''
    
    folders = []
    publics = []
    for k in Folder.query(ancestor=ndb.Key("User",user)):
        #if k.isPublic != None and not k.isPublic and gaeUser != ndb_user.gaeUser: continue
        if k.isPublic != None and not k.isPublic: # private folder
            if override(logged_in_email):
                pass
            elif logged_in_email != folder_owner.email:
                continue
        folders.append(k.key.id())
        publics.append(k.isPublic)
    return {"user":user, "folders":folders, "publics":publics}
    
@app.route(r'/api/user/<username>/folder/<foldername>', methods=['PUT','DELETE'])
def ApiUserFolder(username, foldername):

    try:
        names, ndb_user, _ = parseUrlPath(r'/api/user/([^/]+)/folder/([^/]+)', 2)
    except ParseUrlPathException as pup:
        errorMsg = pup.args[0]
        code = pup.args[1]
        return flask.make_response(errorMsg, code)
    
    user = names and names[0] or ''
    folder = names and names[1] or ''
    
    if flask.request.method == 'PUT':
    
        if not authorize_user(user):
            return flask.make_response("Unauthorized", 401)

        public = True
        value = flask.request.values.get("program")

        if value:
            public = json.loads(value).get('public')

        folder = Folder( parent=ndb_user.key, id=folder, isPublic=public)
        folder.put()
        
        return {}
        
    elif flask.request.method == 'DELETE':

        ndb_folder = ndb.Key("User", user, "Folder", folder).get()
        if not ndb_folder:
            return flask.make_response("Not found", 403)
        program_count = 0
        for _ in Program.query(ancestor=ndb.Key("User",user,"Folder",folder)):
            program_count += 1

        if program_count > 0:
            return flask.make_response("There are programs here", 409)
        ndb_folder.key.delete()
        return {}
        
    else:
        return flask.make_response('Invalid API operation', 400)
        
@app.route('/api/user/<username>/folder/<foldername>/program/')
def ApiUserFolderPrograms(username, foldername):
    try:
        names, ndb_user, email = parseUrlPath(r'/api/user/([^/]+)/folder/([^/]+)/program/', 2)
    except ParseUrlPathException as pup:
        errorMsg = pup.args[0]
        code = pup.args[1]
        return flask.make_response(errorMsg, code)
    
    user, folder = names

    ndb_folder = ndb.Key("User",user,"Folder",folder).get()
    ndb_user = ndb.Key("User",user).get()
    try:
        pub = ndb_folder.isPublic is None or ndb_folder.isPublic or email == ndb_user.email # before March 2015, isPublic wasn't set
    except:
        pub = True
    if not pub and not override(ndb_user.email):
        return {"user":user,"folder":folder,
                "error": str('The folder "'+user+'/'+folder+'" is a private folder\nto which you do not have access.')}
    else:
        programs = [
                { "name": p.key.id(),
                  "screenshot": str(p.screenshot and p.screenshot.decode('utf-8') or ""),
                  "datetime": str(p.datetime)
                } for p in Program.query(ancestor=ndb.Key("User",user,"Folder",folder))]
        return  {"user":user, "folder":folder, "programs":programs}


@app.route('/api/user/<username>/folder/<foldername>/program/<programname>', methods=['GET','PUT','DELETE'])
def ApiUserFolderProgram(username, foldername, programname):

    try:
        names, ndb_user, email = parseUrlPath(r'/api/user/([^/]+)/folder/([^/]+)/program/([^/]+)', 3)
    except ParseUrlPathException as pup:
        errorMsg = pup.args[0]
        code = pup.args[1]
        return flask.make_response(errorMsg, code)

    user, folder, program = names
    name = program # for PUT clause

    if flask.request.method == 'GET':
        ndb_folder = ndb.Key("User",user,"Folder",folder).get()
        try:
            pub = ndb_folder.isPublic is None or ndb_folder.isPublic or email == ndb_user.email # before March 2015, isPublic wasn't set
        except:
            pub = True
        if not pub and not override(email):
            return {"user":user,"folder":folder,"name":name,
                    "error": str('The program "'+name+'" is in a private folder\nto which you do not have access.')}
        else:
             ndb_program = ndb.Key("User",user,"Folder",folder,"Program",name).get()
             if not ndb_program:
                return {"user":user,"folder":folder,"name":name,
                        "error": str(user+'/'+folder+'/'+name+' does not exist.')}
             else:
                 return {"user":user,"folder":folder,"name":name,
                         "screenshot": str(ndb_program.screenshot and ndb_program.screenshot.decode('utf-8') or ""),
                         "datetime": str(ndb_program.datetime),
                         "source": ndb_program.source or ''}

    elif flask.request.method == 'PUT':

        if not authorize_user(user):
            return flask.make_response("Unauthorized", 401)

        value = flask.request.values.get("program")

        if value:
            changes = json.loads(value)
        else:
            changes = {}



        ndb_program = ndb.Key("User",user,"Folder",folder,"Program",program).get()
        
        if not ndb_program: # if not ndb_program already, this is a request to create a new program
            ndb_folder = ndb.Key("User",user,"Folder",folder).get()
            if not ndb_folder:
                return flask.make_response("No such folder", 403)

            ndb_program = Program( parent=ndb_folder.key, id=program )

        if "source" in changes: ndb_program.source = changes["source"]
        if "screenshot" in changes: ndb_program.screenshot = changes["screenshot"].encode('utf-8')

        ndb_program.datetime = datetime.now()
        ndb_program.description = "" # description currently not used
        ndb_program.put()
        return {}

    elif flask.request.method == 'DELETE':

        if not authorize_user(user):
            return flask.make_response("Unauthorized", 401)

        ndb_program = ndb.Key("User",user,"Folder",folder,"Program",name).get()
        if ndb_program:
            ndb_program.key.delete()

        return {}
        
    else:
        return flask.make_response('Invalid API operation', 400)

@app.route('/api/user/<username>/folder/<foldername>/program/<programname>/option/<optionname>')
def ApiUserFolderProgramDownload(username, foldername, programname, optionname):

    try:
        names, ndb_user, email = parseUrlPath(r'/api/user/([^/]+)/folder/([^/]+)/program/([^/]+)/option/([^/]+)', 4)
    except ParseUrlPathException as pup:
        errorMsg = pup.args[0]
        code = pup.args[1]
        return flask.make_response(errorMsg, code)
        
    user, folder, name, option = names

    if option == 'downloadProgram':
        ndb_folder = ndb.Key("User",user,"Folder",folder).get()
        try:
            pub = ndb_folder.isPublic is None or ndb_folder.isPublic or ndb_user.email == email # before March 2015, isPublic wasn't set
        except:
            pub = True
        if not pub:
            return flask.make_response('Unauthorized', 405)
        ndb_program = ndb.Key("User",user,"Folder",folder,"Program",name).get()
        if not ndb_program:
            return flask.make_response('Not found', 404)
        source = ndb_program.source
        end = source.find('\n')
        if source[0:end].find('ython') > -1: # VPython
            source = "from vpython import *\n#"+source
            extension = '.py'
        elif source[0:end].find('apyd') > -1: # RapydScript
            extension = '.py'
        elif source[0:end].find('ofee') > -1: # CofeeScript (1.1 is the only version)
            extension = '.cs'
        else:                    # JavaScript
            extension = '.js'

        response = flask.make_response(source, 200)
        response.headers['Content-Disposition'] = 'attachment; filename=' + user + '_'+name+extension
        
        return response

    elif option == 'downloadFolder':

        ndb_folder = ndb.Key("User",user,"Folder",folder).get()
        try:
            pub = ndb_folder.isPublic is None or ndb_folder.isPublic or ndb_user.email == email # before March 2015, isPublic wasn't set
        except:
            pub = True
        if not pub:
            return flask.make_response('Unauthorized', 405)

        # https://newseasandbeyond.wordpress.com/2014/01/27/creating-in-memory-zip-file-with-python/
        buff = BytesIO()
        za = zipfile.ZipFile(buff, mode='w', compression=zipfile.ZIP_DEFLATED)
        programs = [
          { "name": p.key.id(),
            "source": p.source  # unicode(p.source or unicode())
          } for p in Program.query(ancestor=ndb.Key("User",user,"Folder",folder)) ]
        for p in programs:
            source = p['source']
            end = source.find('\n')
            if source[0:end].find('ython') > -1: # VPython
                source = "from vpython import *\n#"+source
                extension = '.py'
            elif source[0:end].find('apyd') > -1: # RapydScript
                extension = '.py'
            elif source[0:end].find('ofee') > -1: # CofeeScript (1.1 is the only version)
                extension = '.cs'
            else:                    # JavaScript
                extension = '.js'

            za.writestr(p['name']+extension, source)
        za.close()

        response = flask.make_response(buff.getvalue(), 200)
        response.headers['Content-Disposition'] = 'attachment; filename='+user+'_'+folder+'.zip'
        return response
    else:
        return flask.make_response('No such option', 404)

@app.route('/api/user/<username>/folder/<foldername>/program/<programname>/option/<optionname>/oldfolder/<oldfoldername>/oldprogram/<oldprogramname>', methods=['PUT'])
def ApiUserProgramCopy(username, foldername, programname, optionname, oldfoldername, oldprogramname):

    try:
        names, _, _ = parseUrlPath(r'/api/user/([^/]+)/folder/([^/]+)/program/([^/]+)/option/([^/]+)/oldfolder/([^/]+)/oldprogram/([^/]+)', 6)
    except ParseUrlPathException as pup:
        errorMsg = pup.args[0]
        code = pup.args[1]
        return flask.make_response(errorMsg, code)
        
    user, folder, program, option, oldfolder, oldprogram = names

    ndb_folder = ndb.Key("User",user,"Folder",folder).get()
    if not ndb_folder:
        return flask.make_response('Folder not found', 404)

    ndb_program = Program( parent=ndb_folder.key, id=program )
    
    ndb_program_old = ndb.Key("User",user,"Folder",oldfolder,"Program",oldprogram).get()
    if not ndb_program_old:
        return flask.make_response('Old program not found', 404)

    ndb_program.source = ndb_program_old.source
    ndb_program.screenshot = ndb_program_old.screenshot
    ndb_program.datetime = ndb_program_old.datetime
    ndb_program.description = "" # description currently not used
    ndb_program.put()
    if option == 'rename':
        ndb_program_old.key.delete()
    
    return {}
