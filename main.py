
from ide import app, models, routes
from google.cloud import ndb

@app.shell_context_processor
def make_shell_context():
    return {'app': app, 'User': models.User, 'Folder':models.Folder, 'Program':models.Program, 'ndb':ndb}

