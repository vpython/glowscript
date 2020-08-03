
from ide import app, models, routes
from google.cloud import ndb

@app.shell_context_processor
def make_shell_context():
    client = ndb.Client()

    def wc(func, **args):
        with client.context():
            func(**args)
            
    return {'app': app, 'User': models.User, 'Folder':models.Folder, 'Program':models.Program, 'ndb':ndb, 'wc':wc}


