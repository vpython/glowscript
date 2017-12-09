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

# python_version 2.5 works and can be deployed with Google App Engine Launcher 1.7.2
# python_version 2.7 works and can be deployed with Google App Engine Launcher 1.7.6

python_version = '2.7'

if python_version == '2.7':
    import webapp2 as web
    import json
else:
    from google.appengine.ext import webapp as web
    from google.appengine.ext.webapp.util import run_wsgi_app
    from django.utils import simplejson as json

from google.appengine.ext import db
from google.appengine.api import users
import os, re, base64, logging

# URI encoding (percent-escaping of all characters other than [A-Za-z0-9-_.~]) is used for names
# of users, folders and programs in the model and in URIs and in JSON, so no (un)escaping is required.  
# At the moment all of these identifiers are case sensitive.
def chrange(b,e): return set(chr(x) for x in range(ord(b), ord(e)+1))
unreserved = chrange('A','Z') | chrange('a','z') | chrange('0','9') | set("-_.~")

# See documentation of db.Model at https://cloud.google.com/appengine/docs/python/datastore/modelclass
# Newer ndb:                       https://cloud.google.com/appengine/docs/standard/python/ndb/db_to_ndb

class AppSecrets (db.Model):
    """A singleton containing secrets that shouldn't be exposed at GitHub"""
    sso_secret = db.StringProperty(indexed=False)
# Loading this once at startup means the app needs to be restarted after changing secrets in the datastore!
secrets = AppSecrets.get( db.Key.from_path("AppSecrets","instance") )
if not secrets:
    #logging.error("No secrets")
    secrets = AppSecrets(key_name = "instance", sso_secret="?")
    secrets.put()

class User (db.Model):
    """A single user of the IDE"""
    # No parent
    # Key is the user's unique name
    joinDate = db.DateTimeProperty(auto_now_add=True)
    gaeUser = db.UserProperty()
    secret = db.StringProperty(indexed=False)

class Folder (db.Model):
    """A collection of programs created by a user"""
    # Parent is a User
    # key is the folder's name (unique for a user)
    isPublic = db.BooleanProperty()

class Program (db.Model):
    """A single program"""
    # Parent is a Folder
    # key is the program's name (unique for a folder)
    description = db.StringProperty(multiline=True)
    source = db.TextProperty()
    screenshot = db.BlobProperty()

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

        db_user = User.get( db.Key.from_path("User",username) )
        if not db_user or db_user.gaeUser != gaeUser or self.request.headers.get('X-CSRF-Token') != db_user.secret:
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
        db_user = User.gql("WHERE gaeUser = :user", user=user).get()
        if db_user:
            self.respond( { 'state':'logged_in', 'username':db_user.key().name(), 'secret':db_user.secret, 'logout_url':users.create_logout_url("/#/action/loggedout") } )
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
        users = [ k.name() for k in User.all(keys_only=True) ]
        #self.respond( {"users" : users} )
        self.respond("Nusers = "+str(len(users)))

class ApiUser(ApiRequest):
    def get(self, username):
        m = re.search(r'/user/([^/]+)', self.request.path)
        username = m.group(1)
        if not self.authorize(): return
        if not self.validate(username): return

        # This is just used to validate that a user does/doesn't exist
        db_user = User.get( db.Key.from_path("User",username) )
        if not db_user:
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
        db_user = User.gql("WHERE gaeUser = :gaeUser", gaeUser=gaeUser).get()
        if db_user: return self.error(403)

        # The username mustn't already exist - that's stealing!
        db_user = User.get( db.Key.from_path("User",username) )
        if db_user: return self.error(403)

        # TODO: Make sure *nothing* exists in the database with an ancestor of this user, just to be sure

        db_user = User( key_name = username, gaeUser = gaeUser, secret = base64.urlsafe_b64encode(os.urandom(16)) )
        db_user.put()

        db_my_programs = Folder( parent = db_user, key_name = "Public", isPublic=True )
        db_my_programs.put()
        db_my_programs = Folder( parent = db_user, key_name = "Private", isPublic=False )
        db_my_programs.put()

        #self.redirect( "/api/login" ) # routing now done in ide.js

class ApiUserFolders(ApiRequest):
    def get(self, user):                                                        ##### display all public or owned folders                                           
        m = re.search(r'/user/([^/]+)', self.request.path)
        user = m.group(1)
        if not self.authorize(): return
        if not self.validate(user): return
        gaeUser = users.get_current_user()
        db_user = User.get( db.Key.from_path("User",user) )
        folders = []
        for k in Folder.all().ancestor(db.Key.from_path("User",user)):
        	if k.isPublic != None and not k.isPublic and gaeUser != db_user.gaeUser: continue
        	folders.append(k.key().name())
        #folders = [ k.name() for k in Folder.all(keys_only=True).ancestor(db.Key.from_path("User",user)) ]
        self.respond( {"user" : user, "folders" : folders} )

class ApiUserFolder(ApiRequest):
    def put(self, user, folder):                                                ##### create a new folder
        m = re.search(r'/user/([^/]+)/folder/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        if not self.authorize_user(user): return
        if not self.validate(user, folder): return
        db_user = User.get( db.Key.from_path("User",user) )
        if not db_user:
            return self.error(404)
        import cgi
        params = cgi.parse_qs(self.request.body)
        req_program = params['program'][0]
        changes = json.loads( req_program )
        folder = Folder( parent = db_user, key_name = folder, isPublic = changes['public'] )
        ### Also change public=True in My Programs, above
        #folder = Folder( parent = db_user, key_name = folder, public=True )
        folder.put()
        
    def delete(self, user, folder):                                             ##### delete an existing folder
        m = re.search(r'/user/([^/]+)/folder/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        if not self.validate(user, folder): return
        if not self.authorize_user(user): return
        db_folder = Folder.get( db.Key.from_path("User", user, "Folder", folder) )
        if not db_folder:
            return self.error(404)
        # Make sure the folder is empty (alternatively: delete all contents?)
        any_program = Program.all().ancestor(db_folder.key()).get()
        if any_program:
            return self.error(409)
        db_folder.delete()

class ApiUserFolderPrograms(ApiRequest):
    def get(self, user, folder):                                                ##### display all programs in a public or owned folder
        m = re.search(r'/user/([^/]+)/folder/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        if not self.authorize(): return
        if not self.validate(user, folder): return
        db_folder = Folder.get(db.Key.from_path("User",user,"Folder",folder))
        gaeUser = users.get_current_user()
        db_user = User.get( db.Key.from_path("User",user) )
        try:
        	pub = db_folder.isPublic is None or db_folder.isPublic or gaeUser == db_user.gaeUser # before March 2015, isPublic wasn't set
        except:
        	pub = True
        if not pub:
            return self.error(405)
        programs = [
            { "name": p.key().name(),
              "description": unicode(p.description or unicode()),
              "screenshot": str(p.screenshot or ""),
            } for p in Program.all().ancestor(db.Key.from_path("User",user,"Folder",folder)) ]
        self.respond( {"user":user, "folder" : folder, "programs":programs} )

class ApiUserFolderProgram(ApiRequest):
    def get(self, user, folder, name):                                          ##### access a public or owned program
        m = re.search(r'/user/([^/]+)/folder/([^/]+)/program/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        name = m.group(3)
        if not self.authorize(): return
        if not self.validate(user, folder, name): return
        db_folder = Folder.get(db.Key.from_path("User",user,"Folder",folder))
        gaeUser = users.get_current_user()
        db_user = User.get( db.Key.from_path("User",user) )
        try:
        	pub = db_folder.isPublic is None or db_folder.isPublic or gaeUser == db_user.gaeUser # before March 2015, isPublic wasn't set
        except:
        	pub = True
        if not pub:
            return self.error(405)
        db_program = Program.get( db.Key.from_path("User",user,"Folder",folder,"Program",name) )
        if not db_program:
            return self.error(404)
        self.respond( {"user":user,"folder":folder,"name":name,
            "description": unicode(db_program.description or unicode()),
            "screenshot": str(db_program.screenshot or ""),
            "source": unicode(db_program.source or unicode())} )
            
    def put(self, user, folder, name):                                          ##### write an owned program
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
        db_program = Program.get( db.Key.from_path("User",user,"Folder",folder,"Program",name) )
        if not db_program:
            db_folder = Folder.get( db.Key.from_path("User",user,"Folder",folder) )
            if not db_folder:
                return self.error(404)
            db_program = Program( parent = db_folder, key_name = name )

        if "description" in changes: db_program.description = changes["description"]
        if "screenshot" in changes:  db_program.screenshot = db.Blob(str(changes["screenshot"]))
        if "source" in changes: db_program.source = changes["source"]
        db_program.put()
        
    def delete(self, user, folder, name):                                       ##### delete an owned program
        m = re.search(r'/user/([^/]+)/folder/([^/]+)/program/([^/]+)', self.request.path)
        user = m.group(1)
        folder = m.group(2)
        name = m.group(3)
        if not self.validate(user, folder, name): return
        if not self.authorize_user(user): return
        db_program = Program.get( db.Key.from_path("User",user,"Folder",folder,"Program",name) )
        if db_program:
            db_program.delete()

class ApiAdminUpgrade(ApiRequest):
    allowJSONP = None
    def post(self):
        if not self.authorize_user("David"): return
        programs = list( Program.all() )
        changeCount = 0
        for p in programs:
            if self.upgradeProgram(p):
                changeCount += 1
                p.put()
        self.respond( {"processed":len(programs), "changed":changeCount} )

    def upgradeProgram(self, p):
        if not p.source.startswith("GlowScript 2.6\n"):
            p.source = "GlowScript 2.6 VPython\n" + p.source
            return True

app = web.WSGIApplication(
    [
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

if python_version == '2.7':
    pass
else:
    def main():
        run_wsgi_app(app)

