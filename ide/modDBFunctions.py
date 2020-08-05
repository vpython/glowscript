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
    for c in kwargs['User'].query():
        if not c.email:
            if c.gaeUser:
                c.email = c.gaeUser.email()
                c.put()
                print("Updated user: ", c.key.id(), ":", c.email, " count = ", count)
                count += 1


