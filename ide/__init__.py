#
# import some things so they are availabel to main.py
#

from flask import Flask

app = Flask(__name__, static_folder='../static', static_url_path='/')

from . import routes, models, auth
