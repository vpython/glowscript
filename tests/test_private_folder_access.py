from unittest.mock import patch, MagicMock

# The superuser override lets an administrator recover another user's private
# programs. It must depend on who is LOOKING, not on who owns the folder.
ADMIN = 'basherwo@ncsu.edu'

def list_private_folder(client, owner_email, viewer_email):
    with patch('ide.routes.parseUrlPath') as mock_parse, \
         patch('ide.routes.ndb.Key') as mock_key, \
         patch('ide.routes.Program.query') as mock_program_query:
        mock_parse.return_value = (['owner', 'Private'], MagicMock(), viewer_email)
        folder = MagicMock()
        folder.isPublic = False
        owner = MagicMock()
        owner.email = owner_email
        mock_key.return_value.get.side_effect = [folder, owner]
        program = MagicMock()
        program.key.id.return_value = 'secret_program'
        program.screenshot = b''
        program.datetime = '2025-07-10'
        mock_program_query.return_value = [program]
        return client.get('/api/user/owner/folder/Private/program/')

def test_admin_can_list_another_users_private_folder(client):
    response = list_private_folder(client, owner_email='student@example.com', viewer_email=ADMIN)
    assert response.json['programs'][0]['name'] == 'secret_program'

def test_owner_can_list_own_private_folder(client):
    response = list_private_folder(client, owner_email='student@example.com', viewer_email='student@example.com')
    assert response.json['programs'][0]['name'] == 'secret_program'

def test_stranger_cannot_list_a_users_private_folder(client):
    response = list_private_folder(client, owner_email='student@example.com', viewer_email='stranger@example.com')
    assert 'error' in response.json
