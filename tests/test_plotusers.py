
import json
from unittest.mock import patch, MagicMock


def test_plotusers_no_history(client):
    """Returns 200 with a 'no data yet' message when Setting doesn't exist."""
    mock_key_instance = MagicMock()
    mock_key_instance.get.return_value = None
    with patch('google.cloud.ndb.Key', return_value=mock_key_instance):
        response = client.get('/plotusers')
    assert response.status_code == 200
    assert b'no data yet' in response.data.lower()


def test_plotusers_with_history(client):
    """Returns 200 and embeds the points JSON and updated date."""
    points = [
        {'month': '2012-09', 'count': 320},
        {'month': '2026-05', 'count': 314925},
    ]
    mock_setting = MagicMock()
    mock_setting.value = json.dumps({'updated': '2026-05-20', 'points': points})
    mock_key_instance = MagicMock()
    mock_key_instance.get.return_value = mock_setting
    with patch('google.cloud.ndb.Key', return_value=mock_key_instance):
        response = client.get('/plotusers')
    assert response.status_code == 200
    assert b'314925' in response.data
    assert b'2026-05-20' in response.data


def test_plotusers_loads_local_plotly(client):
    """Template references the local plotlyVP7.min.js, not a CDN."""
    mock_key_instance = MagicMock()
    mock_key_instance.get.return_value = None
    with patch('google.cloud.ndb.Key', return_value=mock_key_instance):
        response = client.get('/plotusers')
    assert b'plotlyVP7.min.js' in response.data


SCHEDULER_SA = 'glowscript@appspot.gserviceaccount.com'
BEARER = {'Authorization': 'Bearer test-token'}


def scheduler_token(email=SCHEDULER_SA):
    """Patch Cloud Scheduler OIDC verification to return a token for `email`."""
    return patch('ide.routes.id_token.verify_oauth2_token', return_value={'email': email})


def user_count(count):
    """Patch the datastore.Client read of __Stat_Kind__/User."""
    client = MagicMock()
    client.get.return_value = {'count': count}
    return patch('ide.routes.datastore.Client', return_value=client)


def test_update_user_count_no_bearer_token(client):
    """Returns 403 when the Authorization header is absent."""
    response = client.get('/admin/update-user-count')
    assert response.status_code == 403


def test_update_user_count_rejects_old_cron_header(client):
    """The pre-OIDC X-Appengine-Cron header alone is no longer enough."""
    response = client.get('/admin/update-user-count', headers={'X-Appengine-Cron': 'true'})
    assert response.status_code == 403


def test_update_user_count_rejects_invalid_token(client):
    """Returns 403 when the bearer token fails verification."""
    with patch('ide.routes.id_token.verify_oauth2_token', side_effect=ValueError('bad token')):
        response = client.get('/admin/update-user-count', headers=BEARER)
    assert response.status_code == 403


def test_update_user_count_rejects_other_service_account(client):
    """Returns 403 for a valid token issued to some other account."""
    with scheduler_token('someone@example.com'), user_count(1):
        response = client.get('/admin/update-user-count', headers=BEARER)
    assert response.status_code == 403


def test_update_user_count_appends_new_point(client):
    """Appends a new data point to existing history and returns 200."""
    existing = {
        'updated': '2026-04-01',
        'points': [{'month': '2012-09', 'count': 320}],
    }

    setting_mock = MagicMock()
    setting_mock.value = json.dumps(existing)

    def key_factory(*args, **kwargs):
        # The user count comes from datastore.Client; ndb.Key is only the Setting.
        m = MagicMock()
        m.get.return_value = setting_mock
        return m

    with patch('google.cloud.ndb.Key', side_effect=key_factory), \
         scheduler_token(), user_count(314925):
        response = client.get('/admin/update-user-count', headers=BEARER)

    assert response.status_code == 200
    updated_history = json.loads(setting_mock.value)
    assert len(updated_history['points']) == 2
    assert updated_history['points'][-1]['count'] == 314925
    assert 'month' in updated_history['points'][-1]
    # month should be YYYY-MM format
    assert len(updated_history['points'][-1]['month']) == 7
    assert updated_history['points'][-1]['month'][4] == '-'
    assert updated_history.get('updated') != '2026-04-01'
    assert updated_history.get('updated') is not None
    setting_mock.put.assert_called_once()


def test_update_user_count_creates_setting_when_missing(client):
    """Creates a new Setting entity when none exists."""
    def key_factory(*args, **kwargs):
        # The user count comes from datastore.Client; ndb.Key is only the Setting.
        m = MagicMock()
        m.get.return_value = None
        return m

    with patch('google.cloud.ndb.Key', side_effect=key_factory), \
         patch('ide.routes.Setting') as mock_setting_class, \
         scheduler_token(), user_count(100):
        response = client.get('/admin/update-user-count', headers=BEARER)

    assert response.status_code == 200
    mock_setting_class.assert_called_once_with(id='user_count_history')
    mock_setting_class.return_value.put.assert_called_once()
    written_value = mock_setting_class.return_value.value
    assert written_value is not None
    import json as _json
    written = _json.loads(written_value)
    assert 'points' in written
    assert len(written['points']) == 1
    assert written['points'][0]['count'] == 100
