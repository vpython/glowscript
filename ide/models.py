
from google.cloud import ndb

class User (ndb.Model):
    """A single user of the IDE"""
    # No parent
    # key is the user's unique name
    joinDate = ndb.DateTimeProperty(auto_now_add=True)
    email = ndb.StringProperty() # gaeUser = ndb.UserProperty() cannot seem to search by entity on cloud.ndb?
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

