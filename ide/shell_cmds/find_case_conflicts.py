import json

result = {}

with open('output.json') as f:
    for user in json.load(f):
        lowerKey = user['keyID'].lower()
        if lowerKey in result:
            print("conflict found: {0} {1}".format(result[lowerKey],user['keyID']))
        else:
            result[lowerKey] = user['keyID']







    
