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
website = 'glowscript' # normally glowscript
weblocs = ["www."+website+".org", website+".org", "localhost:"+localport,"127.0.0.1:"+localport, "glowscript-py38.uc.r.appspot.com"]

import json
from io import StringIO
import zipfile
import cgi
import datetime
import uuid
import flask

from google.cloud import ndb
from google.auth.transport import requests
from google.cloud import ndb
import google.oauth2.id_token

from .models import User, Program, Folder

import os, re, base64, logging # logging.info(string variable) prints to GAE launcher log, for debugging
from datetime import datetime

# URI encoding (percent-escaping of all characters other than [A-Za-z0-9-_.~]) is used for names
# of users, folders and programs in the model and in URIs and in JSON, so no (un)escaping is required.  
# At the moment all of these identifiers are case sensitive.
def chrange(b,e): return set(chr(x) for x in range(ord(b), ord(e)+1))
unreserved = chrange('A','Z') | chrange('a','z') | chrange('0','9') | set("-_.~")

# See documentation of db.Model at https://cloud.google.com/appengine/docs/python/datastore/modelclass
# Newer ndb:                       https://cloud.google.com/appengine/docs/standard/python/ndb/db_to_n

client = ndb.Client()                          # for user data, folders, and programs

def ndb_wsgi_middleware(wsgi_app):
    """
    This is helpful for Flask and DNB to play nice together.
    
    https://cloud.google.com/appengine/docs/standard/python3/migrating-to-cloud-ndb
    
    """
    def middleware(environ, start_response):
        with client.context():
            return wsgi_app(environ, start_response)

    return middleware

from . import app, auth

app.wsgi_app = ndb_wsgi_middleware(app.wsgi_app)  # Wrap the app in middleware.

#
# These next few routes are to serve static files in dev mode. GAE will handle these
# in production
#

@app.route('/css/<path:filename>')
def css_static(filename):
    return flask.send_from_directory('../css', filename)
    
@app.route('/ide.js')
def idejs_static():
    return flask.send_from_directory('.', 'ide.js')

@app.route('/lib/<path:filename>')
def lib_static(filename):
    return flask.send_from_directory('../lib', filename)

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
def untrusted_static(filename):
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

def authorize_host():
    return flask.request.headers.get('Host') in weblocs
    
def authorize_user(username):
    if not authorize_host():
        return False
        
    if auth.is_logged_in():
        logged_in_email = auth.get_user_info().get('email')
        ndb_user = ndb.Key("User", username).get()
        if not ndb_user or ndb_user.email != logged_in_email or flask.request.headers.get('X-CSRF-Token') != ndb_user.secret:
            return False
        return True
    else:
        return False

def override(user):
    # return True if superuser, to permit the recovery of private programs for a user who can no longer log in
    return str(user) == 'basherwo@ncsu.edu'

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

    try:
        m = re.search(theRegexp, flask.request.path)
        names = list(map(lambda i: m.group(i+1), range(numGroups)))
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
            nickname = logged_in_username
            if "@" in nickname: nickname = nickname.split("@",2)[0]
            return  { 'state':'new_user', 'suggested_name':nickname } 
    else:
        return { 'state':'not_logged_in', 'login_url':'/google/login' }


@app.route('/api/user')
def ApiUsers():
    N = User.query().count()
    return "Nusers = " + str(N)

@app.route('/api/user/<user>', methods=['GET','PUT'])
def ApiUser(username):
    """
    ndb_user is the existing user object for 'user'
    email is the email address of the logged in user
    """    

    try:
        names, ndb_user, email = parseUrlPath(r'/api/user/([^/]+)', 1)
    except ParseUrlPathException as pup:
        errorMsg, code = pup.args
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
                return flask.make_request("user already exists", 403)

            # TODO: Make sure *nothing* exists in the database with an ancestor of this user, just to be sure

            ndb_user = User( id=user, email=email, secret=base64.urlsafe_b64encode(os.urandom(16)) )
            ndb_user.put()

            ndb_my_programs = Folder( parent=ndb_user.key, id="MyPrograms", isPublic=True )
            ndb_my_programs.put()
            
            ndb_my_programs = Folder( parent=ndb_user.key, id="Private", isPublic=False )
            ndb_my_programs.put()
            
            return {}

@app.route('/api/user/<username>/folder/')
def ApiUserFolders(username):

    """
    ndb_user is the existing user object for 'user'
    email is the email address of the logged in user
    """    

    try:
        names, folder_owner, logged_in_email = parseUrlPath(r'/api/user/([^/]+)/folder/', 1)
    except ParseUrlPathException as pup:
        errorMsg, code = pup.args
        return flask.make_response(errorMsg, code)
    
    user = names and names[0] or ''
    
    print("folder_owner = ", folder_owner)
    print("logged_in_email = ", logged_in_email)

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
def ApiUserFolder():

    try:
        names, ndb_user, email = parseUrlPath(r'/api/user/([^/]+)/folder/([^/]+)', 2)
    except ParseUrlPathException as pup:
        errorMsg, code = pup.args
        return flask.make_response(errorMsg, code)
    
    user = names and names[0] or ''
    folder = names and names[1] or ''
    
    if flask.request.method == 'PUT':
        pass
#        import pdb
#        pdb.set_trace()
    
    return {}

#         return self.error(404)
#         import cgi
#         params = cgi.parse_qs(self.request.body)
#         req_program = params['program'][0]
#         changes = json.loads( req_program )
#         folder = Folder( parent=ndb_user.key, id=folder, isPublic=changes['public'] )
#         ### Also change public=True in My Programs, above
#         folder.put()
#         
#     def delete(self, user, folder):                                             ##### delete an existing folder
#         m = re.search(r'/user/([^/]+)/folder/([^/]+)', self.request.path)
#         user = m.group(1)
#         folder = m.group(2)
#         if not self.validate(user, folder): return
#         if not self.authorize_user(user): return
#         ndb_folder = ndb.Key("User", user, "Folder", folder).get()
#         if not ndb_folder:
#             return self.error(404)
#         # Make sure the folder is empty
#         program_count = 0
#         for p in Program.query(ancestor=ndb.Key("User",user,"Folder",folder)):
#             program_count += 1
#         
#         if program_count > 0:
#             return self.error(409)
#         ndb_folder.key.delete()


# r'/api/user/([^/]+)/folder/([^/]+)/program/', ApiUserFolderPrograms),

@app.route('/api/user/<username>/folder/<foldername>/program/')
def ApiUserFolderPrograms(username, foldername):
    try:
        names, ndb_user, email = parseUrlPath(r'/api/user/([^/]+)/folder/([^/]+)/program/', 2)
    except ParseUrlPathException as pup:
        errorMsg, code = pup.args
        return flask.make_response(errorMsg, code)
    
    user = names and names[0] or ''
    folder = names and names[1] or ''

    ndb_folder = ndb.Key("User",user,"Folder",folder).get()
    ndb_user = ndb.Key("User",user).get()
    try:
        pub = ndb_folder.isPublic is None or ndb_folder.isPublic or email == ndb_user.email # before March 2015, isPublic wasn't set
    except:
        pub = True
    if not pub and not override(gaeUser):
        return {"user":user,"folder":folder,
                "error": str('The folder "'+user+'/'+folder+'" is a private folder\nto which you do not have access.')}
    else:
        programs = [
                { "name": p.key.id(),
                  "screenshot": str(p.screenshot or ""),
                  "datetime": str(p.datetime)
                } for p in Program.query(ancestor=ndb.Key("User",user,"Folder",folder))]
        return  {"user":user, "folder":folder, "programs":programs}


@app.route('/api/user/<username>/folder/<foldername>/program/<programname>', methods=['GET','PUT','DELETE'])
def ApiUserFolderProgram(username, foldername, programname):

    try:
        names, ndb_user, email = parseUrlPath(r'/api/user/([^/]+)/folder/([^/]+)/program/([^/]+)', 3)
    except ParseUrlPathException as pup:
        errorMsg, code = pup.args
        return flask.make_response(errorMsg, code)

    user = names and names[0] or ''
    folder = names and names[1] or ''
    program = name = names and names[2] or ''

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
                         "screenshot": str(ndb_program.screenshot or ""),
                         "datetime": str(ndb_program.datetime),
                         "source": ndb_program.source or ''}

    elif flask.request.method == 'PUT':

        if not authorize_user(user):
            return flask.make_response("Unauthorized", 401)

        source = ''
        value = flask.request.values.get("program")

        if value:
            source = json.loads(value).get('source')

        ndb_program = ndb.Key("User",user,"Folder",folder,"Program",program).get()
        
        if not ndb_program: # if not ndb_program already, this is a request to create a new program
            ndb_folder = ndb.Key("User",user,"Folder",folder).get()
            if not ndb_folder:
                return flask.make_response("No such folder", 403)

            ndb_program = Program( parent=ndb_folder.key, id=program )
        if source: ndb_program.source = source
        ndb_program.datetime = datetime.now()
        ndb_program.description = "" # description currently not used
        ndb_program.put()
        return {}

    else:

        if not authorize_user(user):
            return flask.make_response("Unauthorized", 401)

        ndb_program = ndb.Key("User",user,"Folder",folder,"Program",name).get()
        if ndb_program:
            ndb_program.key.delete()

        return {}

# class ApiUserFolderProgramDownload(ApiRequest):
# 	# route = /api/user/username/folder/foldername/program/programname/option/downloadProgram or ...../downloadFolder
#     def get(self, user, folder, name, op):                                   ##### download a public or owned program or folder
#         m = re.search(r'/user/([^/]+)/folder/([^/]+)/program/([^/]+)/option/([^/]+)', self.request.path)
#         user = m.group(1)
#         folder = m.group(2)
#         name = m.group(3)   # If option is downloadFolder, name is meaningless
#         option = m.group(4) # Currently downloadProgram or downloadFolder
#     	if not self.authorize(): return
#         gaeUser = users.get_current_user()
#         ndb_user = ndb.Key("User",user).get()
#         if option == 'downloadProgram':
#         	if not self.validate(user, folder, name): return
# 	        ndb_folder = ndb.Key("User",user,"Folder",folder).get()
# 	        try:
# 	        	pub = ndb_folder.isPublic is None or ndb_folder.isPublic or gaeUser == ndb_user.gaeUser # before March 2015, isPublic wasn't set
# 	        except:
# 	        	pub = True
# 	        if not pub:
# 	            return self.error(405)
# 	        ndb_program = ndb.Key("User",user,"Folder",folder,"Program",name).get()
# 	        if not ndb_program:
# 	            return self.error(404)
# 	        source = unicode(ndb_program.source or unicode())
# 	        end = source.find('\n')
# 	        if source[0:end].find('ython') > -1: # VPython
# 	        	source = "from vpython import *\n#"+source
# 	        	extension = '.py'
# 	        elif source[0:end].find('apyd') > -1: # RapydScript
# 	        	extension = '.py'
# 	        elif source[0:end].find('ofee') > -1: # CofeeScript (1.1 is the only version)
# 	        	extension = '.cs'
# 	        else:                    # JavaScript
# 	        	extension = '.js'
# 	        self.response.headers['Content-Disposition'] = 'attachment; filename='+user+'_'+name+extension
# 	        self.response.write(source)
#         elif option == 'downloadFolder':
# 	        if not self.validate(user, folder): return
# 	        ndb_folder = ndb.Key("User",user,"Folder",folder).get()
# 	        try:
# 	        	pub = ndb_folder.isPublic is None or ndb_folder.isPublic or gaeUser == ndb_user.gaeUser # before March 2015, isPublic wasn't set
# 	        except:
# 	        	pub = True
# 	        if not pub:
# 	            return self.error(405)
# 	        # https://newseasandbeyond.wordpress.com/2014/01/27/creating-in-memory-zip-file-with-python/
# 	        buff = StringIO.StringIO()
# 	        za = zipfile.ZipFile(buff, mode='w', compression=zipfile.ZIP_DEFLATED)
# 	        programs = [
# 	            { "name": p.key.id(),
# 	              "source": p.source  # unicode(p.source or unicode())
# 	            } for p in Program.query(ancestor=ndb.Key("User",user,"Folder",folder)) ]
# 	        for p in programs:
# 	        	source = p['source']
# 		        end = source.find('\n')
# 		        if source[0:end].find('ython') > -1: # VPython
# 		        	source = "from vpython import *\n#"+source
# 		        	extension = '.py'
# 		        elif source[0:end].find('apyd') > -1: # RapydScript
# 		        	extension = '.py'
# 		        elif source[0:end].find('ofee') > -1: # CofeeScript (1.1 is the only version)
# 		        	extension = '.cs'
# 		        else:                    # JavaScript
# 	        		extension = '.js'
# 		        out = StringIO.StringIO()
# 		        out.write(unicode(source))
# 		        za.writestr(p['name']+extension, out.getvalue().encode('utf-8'))
# 	        za.close()
# 	        self.response.headers['Content-Disposition'] = 'attachment; filename='+user+'_'+folder+'.zip'
# 	        self.response.write(buff.getvalue())
#         else:
# 	        self.error(404)
# 
# class ApiUserProgramCopy(ApiRequest):
# 	# route = /api/user/username/folder/foldername/program/programname/option/copy or rename/
# 	# oldfolder/oldfoldername/oldprogram/oldprogramname
#            
#     def put(self, user, folder, program, oldfolder, oldprogram, op):       ##### copy or rename a program
#         m = re.search(r'/user/([^/]+)/folder/([^/]+)/program/([^/]+)/option/([^/]+)/oldfolder/([^/]+)/oldprogram/([^/]+)', self.request.path)
#         user = m.group(1)
#         folder = m.group(2)
#         program = m.group(3)
#         option = m.group(4) # Currently copy or rename
#         oldfolder = m.group(5)
#         oldprogram = m.group(6)
#         # The following tests are in principle not needed, due to copy/rename options not being available 
#         if not self.validate(user, folder, program): return
#         if not self.validate(user, oldfolder, oldprogram): return
#         ndb_folder = ndb.Key("User",user,"Folder",folder).get()
#         if not ndb_folder:
#             return self.error(404) # should not occur; ide.js checks for existence
#         ndb_program = Program( parent=ndb_folder.key, id=program )
#         ndb_program_old = ndb.Key("User",user,"Folder",oldfolder,"Program",oldprogram).get()
#         if not ndb_program_old:
#             return self.error(404) # should not occur; ide.js checks for existence
#         ndb_program.source = ndb_program_old.source
#         ndb_program.screenshot = ndb_program_old.screenshot
#         ndb_program.datetime = ndb_program_old.datetime
#         ndb_program.description = "" # description currently not used
#         ndb_program.put()
#         if option == 'rename':
#             ndb_program_old.key.delete()
# 
# class ApiAdminUpgrade(ApiRequest):
#     allowJSONP = None
#     def post(self):
#         if not self.authorize_user("David"): return
#         programs = list( Program.query() )
#         changeCount = 0
#         for p in programs:
#             if self.upgradeProgram(p):
#                 changeCount += 1
#                 p.put()
#         self.respond( {"processed":len(programs), "changed":changeCount} )
# 
#     def upgradeProgram(self, p):
#         if not p.source.startswith("GlowScript 2.7\n"):
#             p.source = "GlowScript 3.0 VPython\n" + p.source
#             return True
#         #(r'/api/user/([^/]+)/folder/([^/]+)/program/([^/]+)/oldfolder/([^/]+)/oldprogram/([^/]+)/option/([^/]+)', ApiUserProgramCopy),
# 
# app = web.WSGIApplication(
#     [
#         (r'/api/user/([^/]+)/folder/([^/]+)/program/([^/]+)/option/([^/]+)/oldfolder/([^/]+)/oldprogram/([^/]+)', ApiUserProgramCopy),
#         (r'/api/user/([^/]+)/folder/([^/]+)/program/([^/]+)/option/([^/]+)', ApiUserFolderProgramDownload),
#         (r'/api/user/([^/]+)/folder/([^/]+)/program/([^/]+)', ApiUserFolderProgram),
#         (r'/api/user/([^/]+)/folder/([^/]+)/program/', ApiUserFolderPrograms),
#         (r'/api/user/([^/]+)/folder/([^/]+)', ApiUserFolder),
#         (r'/api/user/([^/]+)/folder/', ApiUserFolders),
#         (r'/api/user/([^/]+)', ApiUser),
#         (r'/api/user/', ApiUsers),
# 
#         (r'/api/login', ApiLogin),
# 
#         (r'/api/admin/upgrade', ApiAdminUpgrade),
#     ],
#     debug=True)
#

