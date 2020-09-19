
from google.cloud import ndb

class User (ndb.Model):
    """A single user of the IDE"""
    # No parent
    # key is the user's unique name
    joinDate = ndb.DateTimeProperty(auto_now_add=True)
    email = ndb.StringProperty()
    gaeUser = ndb.UserProperty()
    secret = ndb.StringProperty()

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

class Setting(ndb.Model):
    """A setting value"""
    # No parent
    # Key is the setting name
    # we're going to cache values since these will be
    # static configuration values
    #

    value = ndb.StringProperty()
    cache = {}

    @staticmethod
    def get(name):
        NOT_SET_VALUE = "NOT SET"
        ndb_setting = Setting.cache.get(name)

        if not ndb_setting:
            ndb_setting = ndb.Key("Setting",name).get()
            if ndb_setting:
                Setting.cache[name] = ndb_setting
            else:
                ndb_setting = Setting(id=name, value=NOT_SET_VALUE)
                ndb_setting.put()

        return ndb_setting
