# pipe this into "flask shell" to update all users in the datastore
import json

f = open('output.json','w')
result = wc(modDBFunctions.DumpUsers, User=User)
json.dump(result,f)
f.close()
print("complete")

