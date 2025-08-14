
from ide import app, models, routes, modDBFunctions
from google.cloud import ndb


@app.shell_context_processor
def make_shell_context():
    """
    In the flask shell use the `wc` function to call ndb methods like so:

    `wc(modDBFunction.DumpUsers, User=user)`

    This will create an ndb context and then invoke the requested function with kwargs provided.
    
    """

    project = routes.emulator and 'glowscript-dev' or None # use a fake project for local dev.
    
    client = ndb.Client(project=project) # for user data, folders, and programs

    def wc(func, **args):
        with client.context():
            func(**args)
            
    return {'app': app, 'User': models.User, 'Folder':models.Folder, 'Program':models.Program, 'Setting':models.Setting,
            'ndb':ndb, 'wc':wc, 'models':models, 'routes':routes,
            'project':project, 'client':client, 'modDBFunctions':modDBFunctions}


