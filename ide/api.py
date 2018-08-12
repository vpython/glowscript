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

import webapp2 as web
import json
import StringIO
import zipfile

from google.appengine.ext import ndb
from google.appengine.api import users
import os, re, base64, logging # logging.info(....) prints to GAE launcher log, for debugging
from datetime import datetime

# URI encoding (percent-escaping of all characters other than [A-Za-z0-9-_.~]) is used for names
# of users, folders and programs in the model and in URIs and in JSON, so no (un)escaping is required.  
# At the moment all of these identifiers are case sensitive.
def chrange(b,e): return set(chr(x) for x in range(ord(b), ord(e)+1))
unreserved = chrange('A','Z') | chrange('a','z') | chrange('0','9') | set("-_.~")

# See documentation of db.Model at https://cloud.google.com/appengine/docs/python/datastore/modelclass
# Newer ndb:                       https://cloud.google.com/appengine/docs/standard/python/ndb/db_to_ndb

class AppSecrets (ndb.Model):
    """A singleton containing secrets that shouldn't be exposed at GitHub"""
    sso_secret = ndb.StringProperty(indexed=False)
# Loading this once at startup means the app needs to be restarted after changing secrets in the datastore!
secrets = ndb.Key("AppSecrets","instance").get()
if not secrets:
    #logging.error("No secrets")
    secrets = AppSecrets(id = "instance", sso_secret="?")
    secrets.put()

class User (ndb.Model):
    """A single user of the IDE"""
    # No parent
    # key is the user's unique name
    joinDate = ndb.DateTimeProperty(auto_now_add=True)
    gaeUser = ndb.UserProperty()
    secret = ndb.StringProperty(indexed=False)

class Folder (ndb.Model):
    """A collection of programs created by a user"""
    # Parent is a User
    # key is the folder's name (unique for a user)
    isPublic = ndb.BooleanProperty()

class Program (ndb.Model):
    """A single program"""
    # Parent is a Folder
    # key is the program's name (unique for a folder)
    description = ndb.StringProperty()
    source = ndb.TextProperty()
    screenshot = ndb.BlobProperty()
    datetime = ndb.DateTimeProperty() # this is UTC date and time

class ApiRequest(web.RequestHandler):
    allowJSONP=None

    def validate(self, *names):
        # TODO: check that the encoding is 'normalized' (e.g. that unreserved characters are NOT percent-escaped).
        for name in names:
            for c in name:
                if c not in unreserved and c != "%":
                    self.error(400)
                    return False
        return True

    def authorize(self):
        if self.request.headers['Host'] not in ("www.glowscript.org","localhost:8080"): 
            self.error(403)
            return False
        return True

    def authorize_user(self, username):
        """Make sure the current request is an authorized request by the given username"""

        if not self.authorize(): return

        gaeUser = users.get_current_user()
        if not gaeUser:
            self.error(403)
            return False

        ndb_user = ndb.Key("User",username).get()
        if not ndb_user or ndb_user.gaeUser != gaeUser or self.request.headers.get('X-CSRF-Token') != ndb_user.secret:
            self.error(403)
            return False

        return True

    def respond( self, data ):
        jsonpCallback = self.allowJSONP and self.request.get("callback")
        if jsonpCallback:
            if not re.match("^[A-Za-z0-9_]+$", jsonpCallback):
                self.error(403)
                return False
            self.response.headers['Content-Type'] = 'text/javascript'
            self.response.out.write( self.allowJSONP[0] + jsonpCallback + "(" + json.dumps( data ) + ")" + self.allowJSONP[1] )
        else:
            self.response.headers["Content-Type"] = "application/json"
            self.response.out.write( json.dumps(data) )

class ApiLogin(ApiRequest):
    allowJSONP = None

    def get(self):
        if not self.authorize(): return
        user = users.get_current_user()
        if not user:
            self.respond( { 'state':'not_logged_in', 'login_url':users.create_login_url("/#/action/loggedin") } )
            return
        ndb_user = User.gql("WHERE gaeUser = :user", user=user).get()
        if ndb_user:
            self.respond( { 'state':'logged_in', 'username':ndb_user.key.id(), 'secret':ndb_user.secret, 'logout_url':users.create_logout_url("/#/action/loggedout") } )
        else:
            # TODO: CSRF protection for subsequent PUT /user/{name}
            # Not super critical, because normally accounts are not in this state for long, and by definition don't
            # have any sensitive data yet
            nickname = user.nickname()
            if "@" in nickname: nickname = nickname.split("@",2)[0]
            self.respond( { 'state':'new_user', 'suggested_name':nickname } )

class ApiUsers(ApiRequest):
    def get(self):
        if not self.authorize(): return
        #if not self.authorize_user("Bruce_Sherwood"): return
        N = User.query().count()
        self.respond("Nusers = "+str(N))

class ApiUser(ApiRequest):
    def get(self, username):
        m = re.search(r'/user/([^/]+)', self.request.path)
        username = m.group(1)
        if not self.authorize(): return
        if not self.validate(username): return

        # This is just used to validate that a user does/doesn't exist
        ndb_user = ndb.Key("User",username).get()
        if not ndb_user:
            return self.error(404)
        self.respond({})

    def put(self, username):
        m = re.search(r'/user/([^/]+)', self.request.path)
        username = m.group(1)
        if not self.authorize(): return
        if not self.validate(username): return

        # The caller must be logged in
        gaeUser = users.get_current_user()
        if not gaeUser: return self.error(403)

        # TODO: CSRF protection (see ApiLogin)
        # The caller mustn't already have a user account
        ndb_user = User.gql("WHERE gaeUser = :gaeUser", gaeUser=gaeUser).get()
        if ndb_user: return self.error(403)

        # The username mustn't already exist - that's stealing!
        ndb_user = ndb.Key("User",username).get()
        if ndb_user: return self.error(403)

        # TODO: Make sure *nothing* exists in the database with an ancestor of this user, just to be sure

        ndb_user = User( id=username, gaeUser=gaeUser, secret=base64.urlsafe_b64encode(os.urandom(16)) )
        ndb_user.put()

        ndb_my_programs = Folder( parent=ndb_user.key, id="MyPrograms", isPublic=True )
        ndb_my_programs.put()
        ndb_my_programs = Folder( parent=ndb_user.key, id="Private", isPublic=False )
        ndb_my_programs.put()

class ApiUserFolders(ApiRequest):
    def get(self, user):                                                        ##### display all public or owned folders                                           
        m = re.search(r'/user/([^/]+)', self.request.path)
        user = m.group(1)
        if not self.authorize(): return
        if not self.validate(user): return
        gaeUser = users.get_current_user()
        ndb_user = ndb.Key("User",user).get()
        folders = []
        publics = []
        for k in Folder.query(ancestor=ndb.Key("User",user)):
        	if k.isPublic != None and not k.isPublic and gaeUser != ndb_user.gaeUser: continue
        	folders.append(k.key.id())
        	publics.append(k.isPublic)
        self.respond( {"user":user, "folders":folders, "publics":publics} )

class ApiUserFolder(ApiRequest):
    def put(self, user, folder):                                                ##### create a new folder
        m = re.search(r'/user/([^/]+)/folder/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        if not self.authorize_user(user): return
        if not self.validate(user, folder): return
        ndb_user = ndb.Key("User",user).get()
        if not ndb_user:
            return self.error(404)
        import cgi
        params = cgi.parse_qs(self.request.body)
        req_program = params['program'][0]
        changes = json.loads( req_program )
        folder = Folder( parent=ndb_user.key, id=folder, isPublic=changes['public'] )
        ### Also change public=True in My Programs, above
        folder.put()
        
    def delete(self, user, folder):                                             ##### delete an existing folder
        m = re.search(r'/user/([^/]+)/folder/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        if not self.validate(user, folder): return
        if not self.authorize_user(user): return
        ndb_folder = ndb.Key("User", user, "Folder", folder).get()
        if not ndb_folder:
            return self.error(404)
        # Make sure the folder is empty
        program_count = 0
        for p in Program.query(ancestor=ndb.Key("User",user,"Folder",folder)):
            program_count += 1
        
        if program_count > 0:
            return self.error(409)
        ndb_folder.key.delete()

class ApiUserFolderPrograms(ApiRequest):
    def get(self, user, folder):                                                ##### display all programs in a public or owned folder
        m = re.search(r'/user/([^/]+)/folder/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        if not self.authorize(): return
        if not self.validate(user, folder): return
        ndb_folder = ndb.Key("User",user,"Folder",folder).get()
        gaeUser = users.get_current_user()
        ndb_user = ndb.Key("User",user).get()
        try:
        	pub = ndb_folder.isPublic is None or ndb_folder.isPublic or gaeUser == ndb_user.gaeUser # before March 2015, isPublic wasn't set
        except:
        	pub = True
        if not pub:
            return self.error(405)
        programs = [
            { "name": p.key.id(),
              #"description": unicode(p.description or unicode()), # description not currently used
              "screenshot": str(p.screenshot or ""),
              "datetime": str(p.datetime)
            } for p in Program.query(ancestor=ndb.Key("User",user,"Folder",folder)) ]
        self.respond( {"user":user, "folder":folder, "programs":programs} )

class ApiUserFolderProgram(ApiRequest):
    def get(self, user, folder, name):                                          ##### access a public or owned program
        m = re.search(r'/user/([^/]+)/folder/([^/]+)/program/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        name = m.group(3)
        if not self.authorize(): return
        if not self.validate(user, folder, name): return
        ndb_folder = ndb.Key("User",user,"Folder",folder).get()
        gaeUser = users.get_current_user()
        ndb_user = ndb.Key("User",user).get()
        try:
        	pub = ndb_folder.isPublic is None or ndb_folder.isPublic or gaeUser == ndb_user.gaeUser # before March 2015, isPublic wasn't set
        except:
        	pub = True
        if not pub:
            return self.error(405)
        ndb_program = ndb.Key("User",user,"Folder",folder,"Program",name).get()
        if not ndb_program:
            return self.error(404)
        self.respond( {"user":user,"folder":folder,"name":name,
            #"description": unicode(ndb_program.description or unicode()), # description not currently used
            "screenshot": str(ndb_program.screenshot or ""),
        	"datetime": str(ndb_program.datetime),
            "source": unicode(ndb_program.source or unicode())} )
            
    def put(self, user, folder, name):                                          ##### create or write an owned program
        m = re.search(r'/user/([^/]+)/folder/([^/]+)/program/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        name = m.group(3)
        if not self.validate(user, folder, name): return
        if not self.authorize_user(user): return
        # TODO: Check content type of request
        import cgi
        params = cgi.parse_qs(self.request.body)
        req_program = params['program'][0]
        changes = json.loads( req_program )

        # This is a slight abuse of the PUT verb, since attributes not specified are left unchanged
        ndb_program = ndb.Key("User",user,"Folder",folder,"Program",name).get()
        if not ndb_program: # if not ndb_program already, this is a request to create a new program
            ndb_folder = ndb.Key("User",user,"Folder",folder).get()
            if not ndb_folder:
                return self.error(404)
            ndb_program = Program( parent=ndb_folder.key, id=name )

        if "oldfolder" in changes:
            ndb_program_old = ndb.Key("User",user,"Folder",changes["oldfolder"],
                                      "Program",changes["oldprogram"]).get()
            ndb_program.source = ndb_program_old.source
            ndb_program.screenshot = ndb_program_old.screenshot
            ndb_program.datetime = ndb_program_old.datetime
        else:
            if "source" in changes: ndb_program.source = changes["source"]
            if "screenshot" in changes:  ndb_program.screenshot = str(changes["screenshot"])
            ndb_program.datetime = datetime.now()
        ndb_program.description = "" # description currently not used
        ndb_program.put()
        
    def delete(self, user, folder, name):                                       ##### delete an owned program
        m = re.search(r'/user/([^/]+)/folder/([^/]+)/program/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        name = m.group(3)
        if not self.validate(user, folder, name): return
        if not self.authorize_user(user): return
        ndb_program = ndb.Key("User",user,"Folder",folder,"Program",name).get()
        if ndb_program:
            ndb_program.key.delete()

class ApiUserFolderProgramDownload(ApiRequest):
	# route = /api/user/username/folder/foldername/program/programname/options/downloadProgram or ...../downloadFolder
    def get(self, user, folder, name, op):                                   ##### download a public or owned program or folder
        m = re.search(r'/user/([^/]+)/folder/([^/]+)/program/([^/]+)/option/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        name = m.group(3)   # If option is downloadFolder, name is meaningless
        option = m.group(4) # Currently downloadProgram or downloadFolder
    	if not self.authorize(): return
        gaeUser = users.get_current_user()
        ndb_user = ndb.Key("User",user).get()
        if option == 'downloadProgram':
        	if not self.validate(user, folder, name): return
	        ndb_folder = ndb.Key("User",user,"Folder",folder).get()
	        try:
	        	pub = ndb_folder.isPublic is None or ndb_folder.isPublic or gaeUser == ndb_user.gaeUser # before March 2015, isPublic wasn't set
	        except:
	        	pub = True
	        if not pub:
	            return self.error(405)
	        ndb_program = ndb.Key("User",user,"Folder",folder,"Program",name).get()
	        if not ndb_program:
	            return self.error(404)
	        source = unicode(ndb_program.source or unicode())
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
	        self.response.headers['Content-Disposition'] = 'attachment; filename='+user+'_'+name+extension
	        self.response.write(source)
        elif option == 'downloadFolder':
	        if not self.validate(user, folder): return
	        ndb_folder = ndb.Key("User",user,"Folder",folder).get()
	        try:
	        	pub = ndb_folder.isPublic is None or ndb_folder.isPublic or gaeUser == ndb_user.gaeUser # before March 2015, isPublic wasn't set
	        except:
	        	pub = True
	        if not pub:
	            return self.error(405)
	        # https://newseasandbeyond.wordpress.com/2014/01/27/creating-in-memory-zip-file-with-python/
	        buff = StringIO.StringIO()
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
		        out = StringIO.StringIO()
		        out.write(unicode(source))
		        za.writestr(p['name']+extension, out.getvalue().encode('utf-8'))
	        za.close()
	        self.response.headers['Content-Disposition'] = 'attachment; filename='+user+'_'+folder+'.zip'
	        self.response.write(buff.getvalue())
        else:
	        self.error(404)

class ApiAdminUpgrade(ApiRequest):
    allowJSONP = None
    def post(self):
        if not self.authorize_user("David"): return
        programs = list( Program.query() )
        changeCount = 0
        for p in programs:
            if self.upgradeProgram(p):
                changeCount += 1
                p.put()
        self.respond( {"processed":len(programs), "changed":changeCount} )

    def upgradeProgram(self, p):
        if not p.source.startswith("GlowScript 2.7\n"):
            p.source = "GlowScript 2.7 VPython\n" + p.source
            return True

app = web.WSGIApplication(
    [
        (r'/api/user/([^/]+)/folder/([^/]+)/program/([^/]+)/option/([^/]+)', ApiUserFolderProgramDownload),
        (r'/api/user/([^/]+)/folder/([^/]+)/program/([^/]+)', ApiUserFolderProgram),
        (r'/api/user/([^/]+)/folder/([^/]+)/program/', ApiUserFolderPrograms),
        (r'/api/user/([^/]+)/folder/([^/]+)', ApiUserFolder),
        (r'/api/user/([^/]+)/folder/', ApiUserFolders),
        (r'/api/user/([^/]+)', ApiUser),
        (r'/api/user/', ApiUsers),

        (r'/api/login', ApiLogin),

        (r'/api/admin/upgrade', ApiAdminUpgrade),
    ],
    debug=True)

