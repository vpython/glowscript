
import pytest
from unittest.mock import MagicMock, patch
from main import app as flask_app

@pytest.fixture
def app():
    """Create and configure a new app instance for each test."""
    # Overwrite the GRL value to True so we can bypass some of the checks
    # that are not relevant for testing.
    with patch('ide.auth.GRL', True):
        flask_app.config.update({
            "TESTING": True,
        })
        yield flask_app

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture(autouse=True)
def mock_google_oauth(mocker):
    """Mock Google OAuth2."""
    mocker.patch('ide.auth.is_logged_in', return_value=True)
    mocker.patch('ide.auth.get_user_info', return_value={'email': 'test@example.com'})

@pytest.fixture(autouse=True)
def mock_datastore(mocker):
    """Mock Google Cloud Datastore."""
    mocker.patch('google.cloud.ndb.Client', return_value=MagicMock())
    mocker.patch('google.cloud.ndb.Key', return_value=MagicMock())
