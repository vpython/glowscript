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
    
