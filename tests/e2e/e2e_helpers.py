"""Helpers for the browser tests. Nothing here imports the Flask app: these tests drive a URL."""
from urllib.parse import urlparse

TIMEOUT = 20_000  # ms; every wait in tests/e2e is on a condition with this cap
RUN_FRAME = "#ajaxBody iframe.untrusted-frame"  # index.html also holds a hidden template copy


def is_local(base_url):
    """True only for http://localhost[:port]. local_only tests write data, so anything else is refused."""
    return bool(base_url) and urlparse(base_url).hostname == "localhost"
