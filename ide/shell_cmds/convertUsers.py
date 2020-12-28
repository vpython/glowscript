# pipe this into "flask shell" to update all users in the datastore
import ide.modDBFunctions
wc(ide.modDBFunctions.UpdateUsers, User=User)
