# Replacing the local-auth short-circuit

Status: design note, no code yet. Branch `feat/local-auth-emulator`.

## The hack

`ide/auth.py`:

```python
def is_logged_in():
    return ('user' in session) or (routes.is_running_locally())

def get_user_info():
    if routes.is_running_locally():
        return {'email': 'localuser@local.host'}
    return session.get('user') or {}
```

Running locally you are *always* signed in as `localuser@local.host`. There is
no way to be anonymous, and no way to be a *different* user.

## Why it matters

It is not just inelegant — it removes whole behaviours from local testing:

* **Anonymous state cannot exist**, so the sign-in link, the `not_logged_in`
  API state, and any "must be logged in" guard are untestable locally. Three
  e2e tests had to be skipped for exactly this (merged as #207).
* **Only one identity exists**, so nothing involving two users — sharing a
  program, another user's folder, permissions — can be exercised.
* **Local behaviour diverges from production** at the one layer where that is
  most expensive to get wrong.

## The same hack lives in webvpython

`webvpython/flaskHost/src/auth.py` has all three sites:

| line | what |
|---|---|
| 70 | `is_logged_in()` returns true whenever local |
| 73-74 | `get_user_info()` returns `localuser@local.host` |
| 88 | `login()` sets `session['user'] = {'email':'local@user'}` and redirects |

Line 88 is the interesting one: it is *already* the right shape — a local login
that puts a user in the session. The other two override it, so it never matters.
Whatever is done here should be done there too, and the note about a second
identity applies equally.

## Direction

Keep `is_logged_in()` / `get_user_info()` **honest** — session only, no
environment special-case — and make local sign-in a real (if fake) login that
populates that session:

1. A local-only `/google/login` that skips OAuth and writes
   `session['user'] = {'email': ...}`, generalising flaskHost's line 88.
   Guarded so it is unreachable when not running locally.
2. Accept an identity, so tests can be two different users, and so
   "sign out" genuinely produces the anonymous state.
3. Then unskip the three tests from #207 — they become locally meaningful,
   which is the actual goal.

A full Firebase/Google auth emulator would be more faithful still; the
session-based route above is the smaller step that removes the untestable
surface, and can be swapped for an emulator later without changing callers.

## Verify with

Not runnable without a local server:

```sh
docker-compose -f docker-datastore.yml up -d
flask run
pytest tests/test_e2e.py --base-url http://localhost:8080 -v
```

Success = the three currently-skipped tests run and pass locally.
