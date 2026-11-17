import re

CONTACT = 'stevespicklemire@gmail.com'

def test_privacy_page_is_served(client):
    response = client.get('/privacy')
    assert response.status_code == 200
    page = response.get_data(as_text=True)
    assert '<h1>Privacy Policy</h1>' in page
    assert 'mailto:' + CONTACT in page

def test_privacy_page_has_no_unresolved_draft_notes(client):
    page = client.get('/privacy').get_data(as_text=True)
    assert '[Steve' not in page

def test_home_page_links_to_privacy_policy(client):
    page = client.get('/').get_data(as_text=True)
    assert re.search(r'<a href="/privacy"[^>]*>Privacy</a>', page)

def test_home_page_loads_no_google_analytics(client):
    page = client.get('/').get_data(as_text=True)
    assert 'googletagmanager' not in page
    assert 'gtag(' not in page

def test_program_runner_page_loads_no_google_analytics(client):
    page = client.get('/untrusted/run.html').get_data(as_text=True)
    assert 'GlowScript Program Template' in page
    assert 'google-analytics' not in page
    assert '_gaq' not in page

def test_privacy_page_covers_children(client):
    page = client.get('/privacy').get_data(as_text=True)
    assert '<h2>Children</h2>' in page
    assert 'general-audience' in page
