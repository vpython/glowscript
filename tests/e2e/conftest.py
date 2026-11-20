"""Fixtures for the browser tests in tests/e2e. They need --base-url and skip without it."""
import pytest
from tests.e2e.e2e_helpers import is_local


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


@pytest.fixture
def demo_user(pytestconfig):
    return pytestconfig.getoption("--demo-user")


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
