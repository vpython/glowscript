#
# These are some functions that could be usefult to fiddle with the Datastore entities moving from python2 to python3

def NewUser(**kwargs):
    """
    Create a fake user with a gaeUser entity but no email address
    """
    u = kwargs['ndb'].model.User(email='foo@bar.net', _auth_domain='bar.net')
    mU = kwargs['User'](id='newID', gaeUser=u, secret='my little secret')
    mU.put()


def UpdateUsers(**kwargs):
    """
    Find users like the one created in "NewUser" and add an email at the User level.
    """

    count = 0
    modCount = 0
    for c in kwargs['User'].query():
        count += 1
        if (count % 100) == 0:
            print("Checking user: ", c.key.id(), " count = ", count)
            
        if not c.email:
            if c.gaeUser:
                modCount += 1
                c.email = c.gaeUser.email().lower()
                c.put()
                if (modCount % 100) == 0:
                    print("Modified 100 more users: ", c.key.id(), " modCount = ", modCount, "email=", c.email)
        elif c.gaeUser:
            if c.email != c.email.lower():
                modCount += 1
                c.email = c.email.lower()
                c.put()
                if (modCount % 100) == 0:
                    print("Modified 100 more users: ", c.key.id(), " modCount = ", modCount, "email=", c.email)


def DumpSettings(**kwargs):
    for s in kwargs['Setting'].query():
        print (s)

def DumpUsers(**kwargs):
    for s in kwargs['User'].query():
        print (s)


def SetSetting(name, value, **kwargs):
    Setting = kwargs['Setting']
    s = Setting(id=name, value=value)
    s.put()


def getUserPrograms(user, folder, **kwargs):
    User = kwargs['User']
    ndb = kwargs['ndb']
    Program = kwargs['Program']
    print("Checking user:", user, "Folder:", folder)
    programs = [{ "name": p.key.id(), "datetime": str(p.datetime)} 
        for p in Program.query(ancestor=ndb.Key("User",user,"Folder",folder))]
    return programs

def copyUserPrograms(oldUser, oldFolder, newUser, newFolder, public=True, **kwargs):
    ndb = kwargs['ndb']
    User = kwargs['User']
    Folder = kwargs['Folder']
    Program = kwargs['Program']

    copiedPrograms = [] # keep track of copied programs

    oldPrograms = [p.key.id() for p in Program.query(ancestor=ndb.Key("User",oldUser,"Folder",oldFolder))]

    ndbNewFolder = ndb.Key("User", newUser, "Folder", newFolder).get()
    if ndbNewFolder:
        #
        # Folder already exists. 
        # Check to make sure the are no programs in the new folder that
        # conflict with the programs from the old folder
        #

        newPrograms = [p.key.id() for p in Program.query(ancestor=ndb.Key("User",newUser,"Folder",newFolder))]
        foundConflict = False
        conflictingProgram = None
        for o in oldPrograms:
            if o in newPrograms:
                foundConflict = True
                break

        if foundConflict:
            return f"Yikes! {conflictingProgram} is already in the new folder"
    else:
        newFolderOwner = ndb.Key("User",newUser).get()
        if newFolderOwner:
            ndbNewFolder = Folder( parent=newFolderOwner.key, id=newFolder, isPublic=public)
            ndbNewFolder.put() # create new folder
        else:
            return "Yikes! Can't find newUser" + newUser

    for pid in oldPrograms:
        ndbOldProgram = ndb.Key("User",oldUser,"Folder",oldFolder,"Program",pid).get()
        if not ndbOldProgram:
            return "Ack! Cannot load program:" + pid
        else:
            newNDBProg = Program(parent=ndbNewFolder.key, id=pid)
            newNDBProg.source =  ndbOldProgram.source
            newNDBProg.datetime = ndbOldProgram.datetime
            newNDBProg.description = ndbOldProgram.description
            newNDBProg.screenshot = ndbOldProgram.screenshot
            newNDBProg.put()
            copiedPrograms.append(pid)
    
    return copiedPrograms
