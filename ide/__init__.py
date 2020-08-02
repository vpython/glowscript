#
# import some things so they are availabel to main.py
#
import flask
import os
import uuid

app = Flask(__name__, static_folder='../static', static_url_path='/')
app.secret_key = str(uuid.uuid4())

from . import routes, models

