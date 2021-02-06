#def copyUserPrograms(oldUser, oldFolder, newUser, newFolder, public=True, **kwargs):

result = wc(modDBFunctions.copyUserPrograms, 
    oldUser='localuser', 
    oldFolder='MyPrograms', 
    newUser='localuser',
    newFolder='TestDestination2',
    public=True,
    ndb=ndb, Folder=Folder, Program=Program, User=User )

print(result)
