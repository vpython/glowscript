import base64
import json

# A replayed or cookie-less OAuth callback must not 500.
#
# The authlib state is single-use and lives in the session cookie. Two real
# populations therefore hit MismatchingStateError on /google/auth:
#   - anyone who REFRESHES the callback URL (the state was consumed on the
#     first attempt) — observed live: one classroom machine retried a dead
#     callback 68 times on 2026-09-01, each retry rendering GAE's bare
#     "500 Server Error" page;
#   - browsers that refuse the session cookie, so no state is ever stored.
# Production logs show a steady 1-2% of sign-ins failing this way for at least
# a month. The failure is unrecoverable BY DESIGN — retrying the same URL can
# only ever fail — so the only useful response is a clean landing page where
# the user can start over.

def _state(host):
    return base64.b64encode(json.dumps({'dstHost': host, 'salt': 'x'}).encode()).decode()

def test_replayed_callback_redirects_home_instead_of_500(client):
    # No session state exists (fresh client), which is exactly the replay /
    # blocked-cookie shape: authlib raises MismatchingStateError.
    resp = client.get('/google/auth?state=' + _state('localhost') + '&code=junk')

    assert resp.status_code == 302, (
        'a dead callback should land the user somewhere useful, got %s' % resp.status_code)
    assert resp.headers['Location'].startswith('/'), resp.headers['Location']

def test_callback_with_no_state_at_all_redirects_home(client):
    # A bookmarked /google/auth with no parameters — the "Yikes!" branch.
    resp = client.get('/google/auth')
    assert resp.status_code == 302
    assert resp.headers['Location'].startswith('/')
