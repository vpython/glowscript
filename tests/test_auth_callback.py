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

# The THIRD population, and the one the OAuthError handler cannot reach: the
# outbound token exchange to Google fails at the network level. Reported by
# Bruce on 2026-09-05 as two Error Reporting alerts — http.client.
# RemoteDisconnected and the urllib3/requests wrapper of the same exception,
# which are one event split into two groups by stack signature. The live
# request hung 13.2s before the far end dropped it.
#
# requests.RequestException is NOT an authlib OAuthError, so it escapes the
# except above and renders GAE's bare 500. Same endpoint, same useless outcome
# for the user, different exception class — and equally unrecoverable on this
# request, since the single-use state is consumed either way.
def test_network_failure_during_token_exchange_redirects_home(client, mocker):
    import requests
    from ide import auth as auth_mod

    oauth = auth_mod.authNamespace.get('oauth') or auth_mod.fillAuthNamespace()
    mocker.patch.object(
        oauth.google, 'authorize_access_token',
        side_effect=requests.exceptions.ConnectionError(
            'Connection aborted.', ConnectionResetError('Remote end closed connection')))

    resp = client.get('/google/auth?state=' + _state('localhost') + '&code=junk')

    assert resp.status_code == 302, (
        'a network failure talking to Google should land the user somewhere '
        'useful, got %s' % resp.status_code)
    assert resp.headers['Location'].startswith('/'), resp.headers['Location']
