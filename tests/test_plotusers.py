
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
