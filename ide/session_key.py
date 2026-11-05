#
# The key that signs Flask session cookies.
#
# Anyone who knows this key can mint a session for any user, so a deployed app
# must have a real one. Deployed, it comes from Secret Manager (the same way
# OAUTH_CLIENT_SECRETS does), or else from ide/flask_secret.py; if neither has a
# real key the app refuses to start rather than falling back to the public
# placeholder in ide/default_secret.py. Running locally, the placeholder is fine.
#
import importlib

from . import default_secret

PLACEHOLDER = default_secret.FN_SECRET_KEY
SECRET_NAME = 'glowscript-flask-secret'


def read_secret_manager(project, name):
    """The latest version of a Secret Manager secret, as bytes, or None."""
    try:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        path = f"projects/{project}/secrets/{name}/versions/latest"
        return client.access_secret_version(name=path).payload.data.strip()
    except Exception as e:
        print(f"Could not read the session key from Secret Manager ({type(e).__name__})")
        return None


def read_key_file():
    """FN_SECRET_KEY from ide/flask_secret.py (never checked in), or None."""
    try:
        return importlib.import_module('.flask_secret', __package__).FN_SECRET_KEY
    except ImportError:
        return None


def choose_key(running_locally, from_secret_manager, from_file):
    if running_locally:
        return from_file() or PLACEHOLDER
    key = from_secret_manager() or from_file()
    if not key or key == PLACEHOLDER:
        raise RuntimeError(
            "No session key: set Secret Manager secret %r (or deploy ide/flask_secret.py). "
            "Refusing to sign sessions with the public placeholder." % SECRET_NAME)
    return key
