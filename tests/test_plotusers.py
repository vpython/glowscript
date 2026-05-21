
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


def test_update_user_count_no_cron_header(client):
    """Returns 403 when X-Appengine-Cron header is absent."""
    response = client.get('/admin/update-user-count')
    assert response.status_code == 403


def test_update_user_count_appends_new_point(client):
    """Appends a new data point to existing history and returns 200."""
    existing = {
        'updated': '2026-04-01',
        'points': [{'month': '2012-09', 'count': 320}],
    }

    stat_mock = MagicMock()
    stat_mock.count = 314925

    setting_mock = MagicMock()
    setting_mock.value = json.dumps(existing)

    def key_factory(*args, **kwargs):
        m = MagicMock()
        if args and args[0] == '__Stat_Kind__':
            m.get.return_value = stat_mock
        else:
            m.get.return_value = setting_mock
        return m

    with patch('google.cloud.ndb.Key', side_effect=key_factory):
        response = client.get('/admin/update-user-count',
                              headers={'X-Appengine-Cron': 'true'})

    assert response.status_code == 200
    updated_history = json.loads(setting_mock.value)
    assert len(updated_history['points']) == 2
    assert updated_history['points'][-1]['count'] == 314925
    setting_mock.put.assert_called_once()


def test_update_user_count_creates_setting_when_missing(client):
    """Creates a new Setting entity when none exists."""
    stat_mock = MagicMock()
    stat_mock.count = 100

    def key_factory(*args, **kwargs):
        m = MagicMock()
        if args and args[0] == '__Stat_Kind__':
            m.get.return_value = stat_mock
        else:
            m.get.return_value = None
        return m

    with patch('google.cloud.ndb.Key', side_effect=key_factory), \
         patch('ide.routes.Setting') as mock_setting_class:
        response = client.get('/admin/update-user-count',
                              headers={'X-Appengine-Cron': 'true'})

    assert response.status_code == 200
    mock_setting_class.assert_called_once_with(id='user_count_history')
    mock_setting_class.return_value.put.assert_called_once()
