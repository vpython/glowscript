"""Fixtures for the browser tests in tests/e2e. They need --base-url and skip without it."""
from pathlib import Path

import pytest
from tests.e2e.e2e_helpers import is_local, api_login, api_put, wait_no_dialog

LOCAL_USER = "e2e"
DEMO_DIR = Path(__file__).parent / "demos"


def pytest_addoption(parser):
    parser.addoption("--demo-user", default="GlowScriptDemos",
                     help="user whose Examples folder holds the smoke-test demos")


def pytest_collection_modifyitems(config, items):
    base_url = config.getoption("--base-url")
    no_url = pytest.mark.skip(reason="browser test: pass --base-url")
    not_local = pytest.mark.skip(reason="local_only: writes data; runs only against http://localhost")
    for item in items:
        path = item.nodeid.replace("\\", "/")
        if not path.startswith("tests/e2e/") or path.startswith("tests/e2e/test_guard.py"):
            continue  # only browser tests need a URL; the guard's own tests don't
        if not base_url:
            item.add_marker(no_url)
        elif item.get_closest_marker("local_only") and not is_local(base_url):
            item.add_marker(not_local)


@pytest.fixture(scope="session")
def local_user(playwright, base_url):
    """The one local user, created through the real first-visit dialog."""
    assert is_local(base_url), "local_user must never run against a real server"
    browser = playwright.chromium.launch()
    page = browser.new_page()
    state = api_login(page.request, base_url)["state"]
    if state == "new_user":
        page.goto(base_url)
        dialog = page.locator(".ui-dialog:has(#newUser-dialog), .ui-dialog:has-text('choose a unique name')").first
        dialog.locator("input[name=name]").fill(LOCAL_USER)
        dialog.get_by_role("button", name="OK").click()
        wait_no_dialog(page)
    login = api_login(page.request, base_url)
    folders = page.request.get(f"{base_url}/api/user/{login['username']}/folder/").json()
    browser.close()
    return {"name": login["username"], "secret": login["secret"], "first_visit_state": state,
            "folders_after_create": dict(zip(folders["folders"], folders["publics"]))}


@pytest.fixture
def demo_user(pytestconfig, base_url, request):
    if not is_local(base_url):
        return pytestconfig.getoption("--demo-user")
    user = request.getfixturevalue("local_user")
    req = request.getfixturevalue("page").request
    api_put(req, base_url, f"user/{user['name']}/folder/Examples", {"public": True}, user["secret"])
    for f in sorted(DEMO_DIR.glob("*.py")):
        api_put(req, base_url, f"user/{user['name']}/folder/Examples/program/{f.stem}",
                {"source": f.read_text()}, user["secret"])
    return user["name"]


@pytest.fixture
def page_errors(page):
    """Uncaught errors and console errors from the page and its frames, as text."""
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))
    return errors


@pytest.fixture
def writes(page):
    """Every non-GET request the page sends. Smoke tests assert this stays empty."""
    sent = []
    page.on("request", lambda r: r.method not in ("GET", "HEAD", "OPTIONS") and sent.append((r.method, r.url)))
    return sent
