"""
These are filesytem based utilities to help with housekeeping.
"""

import os

def LoadPrograms(**kwargs):
    """
    Iterate through the python programs in a folder.
    """
    path = kwargs['path']
    for file in os.listdir(path):
        if file.endswith(".py"):
            with open(os.path.join(path, file)) as f:
                code = f.read()
                yield file, code

def LoadProgramVisitor(path, func):
    for pname, code in LoadPrograms(path=path):
        func(pname, code)

def buildLoader(client, Program, ndb, user_id, folder_id, modDBFunctions):

    def loader(pname, code):
        code = code.replace('from vpython import *', 'Web VPython 3.2\n')
        modDBFunctions.SetProgramSource(ndb, Program, user_id, folder_id, pname, code)

    wrapped_loader = modDBFunctions.with_context(client)(loader)

    return wrapped_loader

if __name__ == '__main__':
    LoadProgramVisitor(path='/Users/steve/Development/instructormi/assets/lecture-demo-programs/PUBLIC', func=lambda pname, code: print(pname))
