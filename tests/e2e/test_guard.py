"""The guard that keeps local_only tests away from real servers (they write data)."""
import pytest
from tests.e2e.e2e_helpers import is_local


@pytest.mark.parametrize("url,local", [
    ("http://localhost:8080", True),
    ("http://localhost:8080/", True),
    ("https://glowscript.org", False),
    ("https://www.glowscript.org", False),
    ("https://20261119t061441-dot-glowscript.appspot.com", False),
    # 127.0.0.1 is local, but the IDE only runs the program frame same-origin for
    # "localhost" (ide/ide.js:1111), so local_only tests would fail there.
    ("http://127.0.0.1:8080", False),
    ("http://localhost.evil.example", False),
    (None, False),
    ("", False),
])
def test_local_only_guard(url, local):
    assert is_local(url) is local


from tests.e2e.e2e_helpers import skip_reason


@pytest.mark.parametrize("nodeid,local_only,url,skipped", [
    # the hook that applies the guard (tests/e2e/conftest.py), not just is_local
    ("tests/e2e/test_local_run.py::test_x[chromium]", True, "https://glowscript.org", True),
    ("tests/e2e/test_local_run.py::test_x[chromium]", True, "http://127.0.0.1:8080", True),
    ("tests/e2e/test_local_run.py::test_x[chromium]", True, "http://localhost:8080", False),
    ("tests/e2e/test_smoke.py::test_x[chromium]", False, "https://glowscript.org", False),
    ("tests/e2e/test_smoke.py::test_x[chromium]", False, None, True),        # no URL: skip
    ("tests\\e2e\\test_local_run.py::test_x", True, "https://glowscript.org", True),  # Windows ids
    ("tests/e2e/test_guard.py::test_local_only_guard[x]", False, None, False),  # needs no URL
    ("tests/test_api.py::test_x", False, None, False),                         # not a browser test
])
def test_skip_hook(nodeid, local_only, url, skipped):
    assert (skip_reason(nodeid, local_only, url) is not None) is skipped
