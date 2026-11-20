"""Helpers for the browser tests. Nothing here imports the Flask app: these tests drive a URL."""
import time
from urllib.parse import urlparse

TIMEOUT = 20_000  # ms; every wait in tests/e2e is on a condition with this cap
RUN_FRAME = "#ajaxBody iframe.untrusted-frame"  # index.html also holds a hidden template copy


def is_local(base_url):
    """True only for http://localhost[:port]. local_only tests write data, so anything else is refused."""
    return bool(base_url) and urlparse(base_url).hostname == "localhost"

# Steve's picks, 2026-11-19. Value = how the test knows the demo worked.
DEMOS = {
    "VPythonObjects-VPython": "drawing",
    "Extrusions": "drawing",
    "GraphTest": "graph",                     # Plotly only, no 3D canvas
    "ButtonsSlidersMenus-VPython": "widgets",  # also draws
}

# Console errors that are not ours. Each entry needs a comment saying where it comes from.
KNOWN_NOISE = []


def program_url(base_url, user, folder, program, page="run"):
    url = f"{base_url.rstrip('/')}/#/user/{user}/folder/{folder}/program/{program}"
    return url if page == "run" else f"{url}/{page}"


def run_frame(page):
    """The program's iframe, once run.html has loaded in it (cross-origin on glowscript.org)."""
    # Waits for the frame's URL, not for "#glowscript": run.js strips that id once the
    # packages load (run.js:270), so a fast program removes it before we can look.
    page.locator(RUN_FRAME).wait_for(state="attached", timeout=TIMEOUT)
    deadline = time.monotonic() + TIMEOUT / 1000
    while not (frames := [f for f in page.frames if "/untrusted/run.html" in f.url]):
        assert time.monotonic() < deadline, "the program frame never loaded untrusted/run.html"
        page.wait_for_timeout(100)
    frames[0].locator("body").wait_for(state="attached", timeout=TIMEOUT)
    return frames[0]


# Distinct colors in a sample of the first activated 3D canvas, read the way the IDE's own
# thumbnails are (untrusted/run.js:332-350): a WebGL canvas can read back blank otherwise.
_CANVAS_COLORS = """async () => {
    const scene = (window.canvas && canvas.activated || []).find(c => c)
    if (!scene) return -1
    const img = await scene.__renderer.screenshot()
    if (img.decode) await img.decode().catch(() => {})  // a fresh <img> can still be 0x0
    if (!img.width || !img.height) return 0
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, cv.width, cv.height).data, seen = new Set()
    for (let i = 0; i < d.length; i += 4 * 997) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2])
    return seen.size
}"""


def canvas_colors(frame):
    """Distinct sampled colors in the 3D scene; -1 when no 3D canvas was created."""
    return frame.evaluate(_CANVAS_COLORS)


def wait_for_drawing(frame, min_colors=2):
    # Polls from Python: WebKit's wait_for_function doesn't await an async predicate, it
    # takes the returned Promise as truthy, so the check would pass on a blank page.
    deadline = time.monotonic() + TIMEOUT / 1000
    while (n := canvas_colors(frame)) < min_colors:
        assert time.monotonic() < deadline, f"canvas still blank after {TIMEOUT} ms ({n} colors)"
        frame.page.wait_for_timeout(200)


def wait_for_graph(frame):
    frame.wait_for_function(
        "() => document.querySelectorAll('.js-plotly-plot .scatterlayer path, .js-plotly-plot .trace').length > 0",
        timeout=TIMEOUT)


_WIDGETS = "button, input[type=range], select"


def widget_count(frame):
    return frame.evaluate(f"() => document.querySelectorAll('{_WIDGETS}').length")


def wait_for_widgets(frame, n):
    """Widgets are made after the scene first draws, so wait for them rather than count once."""
    frame.wait_for_function(f"() => document.querySelectorAll('{_WIDGETS}').length >= {n}", timeout=TIMEOUT)


def print_text(frame):
    return frame.evaluate("() => (document.querySelector('#print') || {value: ''}).value")


def wait_for_print(frame, text):
    frame.wait_for_function(
        "t => ((document.querySelector('#print') || {}).value || '').includes(t)", arg=text, timeout=TIMEOUT)


def error_text(page):
    """Text of any visible program-error dialog (ide/ide.js:1278), else ''."""
    return " | ".join(page.locator(".ui-dialog .error-details:visible").all_inner_texts()).strip()


def wait_no_dialog(page):
    """Wait until no jQuery UI dialog is showing. (":visible" is Playwright's here; it is not CSS.)"""
    page.locator(".ui-dialog:visible").first.wait_for(state="detached", timeout=TIMEOUT)


def real_errors(errors):
    return [e for e in errors if not any(n in e for n in KNOWN_NOISE)]


import itertools, json
_count = itertools.count()


def uniq(prefix):
    """A name no earlier test in this run used (the emulator is empty at the start of each run)."""
    return f"{prefix}{int(time.time()) % 100000}{next(_count)}"


def api_login(request, base_url):
    return request.get(f"{base_url}/api/login").json()


def api_put(request, base_url, path, data, secret):
    """PUT the way ide.js apiPut does: form field program=<json>, X-CSRF-Token header."""
    r = request.put(f"{base_url}/api/{path}", form={"program": json.dumps(data)},
                    headers={"X-CSRF-Token": secret})
    assert r.ok, f"PUT {path}: {r.status} {r.text()[:200]}"


def set_source(page, source):
    """Replace the editor contents through ACE (window.editor, ide/ide.js:1470); this fires autosave."""
    page.wait_for_function("() => window.editor && window.editor.getSession", timeout=TIMEOUT)
    page.evaluate("s => window.editor.getSession().setValue(s)", source)


def wait_saved(page):
    page.locator("#ajaxBody .program-status").filter(has_text="Saved").wait_for(timeout=TIMEOUT)
