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
