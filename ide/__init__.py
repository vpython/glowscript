#
# import some things so they are availabel to main.py
#

import os
import uuid

from flask import Flask

app = Flask(__name__, static_folder='../static', static_url_path='/')
app.secret_key = str(uuid.uuid4())

from . import routes, models, auth

