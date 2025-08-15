
from ide import app, models, routes, modDBFunctions
from google.cloud import ndb

@app.shell_context_processor
def make_shell_context():
    """
    In the flask shell use the `wc` decorator to call ndb methods like so:

    @wc
    def doSomething(foo, bar):
        modDBFunctions.DumpUsers(User=foo, Bar=bar)

    doSomething()

    This will create an ndb context and then invoke the requested function with kwargs provided.
    
    """

    project = routes.emulator and 'glowscript-dev' or None # use a fake project for local dev.
    
    client = ndb.Client(project=project) # for user data, folders, and programs

    import fs_utils as fsu

    def doLoadPrograms(path):
        loader = fsu.buildLoader(client, models.Program, ndb, 'localuser', 'testupdate', modDBFunctions)
        fsu.LoadProgramVisitor(path, loader)

    return {'app': app, 'User': models.User, 'Folder':models.Folder, 'Program':models.Program,
            'Setting':models.Setting,'ndb':ndb, 'models':models, 'routes':routes, 'project':project,
            'client':client, 'modDBFunctions':modDBFunctions, 'doLoadPrograms':doLoadPrograms}
