
import pytest
from unittest.mock import patch, MagicMock

def test_api_login_not_logged_in(client):
    with patch('ide.auth.is_logged_in', return_value=False):
        response = client.get('/api/login')
        assert response.status_code == 200
        assert response.json == {'state': 'not_logged_in', 'login_url': '/google/login'}

def test_api_login_logged_in_existing_user(client):
    with patch('ide.models.User.query') as mock_query:
        mock_user = MagicMock()
        mock_user.key.id.return_value = 'testuser'
        mock_user.secret = 'secret'
        mock_query.return_value.filter.return_value.get.return_value = mock_user
        response = client.get('/api/login')
        assert response.status_code == 200
        assert response.json == {'state': 'logged_in', 'username': 'testuser', 'secret': 'secret', 'logout_url': '/google/logout'}

def test_api_login_logged_in_new_user(client):
    with patch('ide.models.User.query') as mock_query:
        mock_query.return_value.filter.return_value.get.return_value = None
        response = client.get('/api/login')
        assert response.status_code == 200
        assert response.json == {'state': 'new_user', 'suggested_name': 'test'}

def test_api_user_get_existing(client):
    with patch('ide.routes.parseUrlPath') as mock_parse:
        mock_parse.return_value = (['testuser'], MagicMock(), 'test@example.com')
        response = client.get('/api/user/testuser')
        assert response.status_code == 200
        assert response.json == {}

def test_api_user_get_non_existing(client):
    with patch('ide.routes.parseUrlPath') as mock_parse:
        mock_parse.return_value = (['testuser'], None, 'test@example.com')
        response = client.get('/api/user/testuser')
        assert response.status_code == 404

def test_api_user_put_new(client):
    with patch('ide.routes.parseUrlPath') as mock_parse, \
         patch('ide.routes.User') as mock_user_model, \
         patch('ide.routes.Folder') as mock_folder_model:
        mock_parse.return_value = (['testuser'], None, 'test@example.com')
        response = client.put('/api/user/testuser')
        assert response.status_code == 200
        mock_user_model.assert_called_once()
        assert mock_folder_model.call_count == 2


def test_api_user_put_existing(client):
    with patch('ide.routes.parseUrlPath') as mock_parse:
        mock_parse.return_value = (['testuser'], MagicMock(), 'test@example.com')
        response = client.put('/api/user/testuser')
        assert response.status_code == 403

def test_api_user_folders_get(client):
    with patch('ide.routes.parseUrlPath') as mock_parse, \
         patch('ide.routes.Folder.query') as mock_query:
        mock_parse.return_value = (['testuser'], MagicMock(), 'test@example.com')
        mock_folder = MagicMock()
        mock_folder.key.id.return_value = 'MyPrograms'
        mock_folder.isPublic = True
        mock_query.return_value = [mock_folder]
        response = client.get('/api/user/testuser/folder/')
        assert response.status_code == 200
        assert response.json == {'user': 'testuser', 'folders': ['MyPrograms'], 'publics': [True]}

def test_api_user_folder_put(client):
    with patch('ide.routes.parseUrlPath') as mock_parse, \
         patch('ide.routes.authorize_user', return_value=True), \
         patch('ide.routes.Folder') as mock_folder_model:
        mock_parse.return_value = (['testuser', 'MyNewFolder'], MagicMock(), 'test@example.com')
        response = client.put('/api/user/testuser/folder/MyNewFolder')
        assert response.status_code == 200
        mock_folder_model.assert_called_once()

def test_api_user_folder_delete_non_empty(client):
    with patch('ide.routes.parseUrlPath') as mock_parse, \
         patch('ide.routes.ndb.Key') as mock_key, \
         patch('ide.routes.Program.query') as mock_program_query:
        mock_parse.return_value = (['testuser', 'MyPrograms'], MagicMock(), 'test@example.com')
        mock_key.return_value.get.return_value = MagicMock()
        mock_program_query.return_value.__iter__.return_value = [MagicMock()]
        response = client.delete('/api/user/testuser/folder/MyPrograms')
        assert response.status_code == 409

def test_api_user_folder_delete_empty(client):
    with patch('ide.routes.parseUrlPath') as mock_parse, \
         patch('ide.routes.ndb.Key') as mock_key, \
         patch('ide.routes.Program.query') as mock_program_query:
        mock_parse.return_value = (['testuser', 'MyPrograms'], MagicMock(), 'test@example.com')
        mock_folder = MagicMock()
        mock_key.return_value.get.return_value = mock_folder
        mock_program_query.return_value.__iter__.return_value = []
        response = client.delete('/api/user/testuser/folder/MyPrograms')
        assert response.status_code == 200
        mock_folder.key.delete.assert_called_once()

def test_api_user_folder_programs_get(client):
    with patch('ide.routes.parseUrlPath') as mock_parse, \
         patch('ide.routes.ndb.Key') as mock_key, \
         patch('ide.routes.Program.query') as mock_program_query:
        mock_parse.return_value = (['testuser', 'MyPrograms'], MagicMock(), 'test@example.com')
        mock_folder = MagicMock()
        mock_folder.isPublic = True
        mock_key.return_value.get.return_value = mock_folder
        mock_program = MagicMock()
        mock_program.key.id.return_value = 'test_program'
        mock_program.screenshot = b''
        mock_program.datetime = '2025-07-10'
        mock_program_query.return_value = [mock_program]
        response = client.get('/api/user/testuser/folder/MyPrograms/program/')
        assert response.status_code == 200
        assert response.json['programs'][0]['name'] == 'test_program'

def test_api_user_folder_program_get(client):
    with patch('ide.routes.parseUrlPath') as mock_parse, \
         patch('ide.routes.ndb.Key') as mock_key:
        mock_parse.return_value = (['testuser', 'MyPrograms', 'test_program'], MagicMock(), 'test@example.com')
        mock_folder = MagicMock()
        mock_folder.isPublic = True
        mock_program = MagicMock()
        mock_program.source = 'print("Hello, World!")'
        mock_program.screenshot = b''
        mock_program.datetime = '2025-07-10'
        mock_key.return_value.get.side_effect = [mock_folder, mock_program]
        response = client.get('/api/user/testuser/folder/MyPrograms/program/test_program')
        assert response.status_code == 200
        assert response.json['source'] == 'print("Hello, World!")'

def test_api_user_folder_program_put(client):
    with patch('ide.routes.parseUrlPath') as mock_parse, \
         patch('ide.routes.authorize_user', return_value=True), \
         patch('ide.routes.ndb.Key') as mock_key, \
         patch('ide.routes.Program') as mock_program_model:
        mock_parse.return_value = (['testuser', 'MyPrograms', 'test_program'], MagicMock(), 'test@example.com')
        mock_key.return_value.get.side_effect = [None, MagicMock()]
        response = client.put('/api/user/testuser/folder/MyPrograms/program/test_program', data={'program': '{}'})
        assert response.status_code == 200
        mock_program_model.assert_called_once()

def test_api_user_folder_program_delete(client):
    with patch('ide.routes.parseUrlPath') as mock_parse, \
         patch('ide.routes.authorize_user', return_value=True), \
         patch('ide.routes.ndb.Key') as mock_key:
        mock_parse.return_value = (['testuser', 'MyPrograms', 'test_program'], MagicMock(), 'test@example.com')
        mock_program = MagicMock()
        mock_key.return_value.get.return_value = mock_program
        response = client.delete('/api/user/testuser/folder/MyPrograms/program/test_program')
        assert response.status_code == 200
        mock_program.key.delete.assert_called_once()
