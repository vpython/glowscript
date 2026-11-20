"""
Smoke tests (A): anonymous and read-only, safe against any server, prod included.

Run against a --no-promote candidate before switching traffic, and against
https://glowscript.org right after. Candidate (-dot-) URLs run programs same-origin;
only glowscript.org uses the cross-origin sandbox, so the post-switch run is the only
check of the real sandbox.

    pytest tests/e2e/test_smoke.py --base-url https://VERSION-dot-glowscript.appspot.com \
        --browser chromium --browser webkit --screenshot only-on-failure --output e2e-artifacts
"""
import pytest
from playwright.sync_api import Page
import time
from tests.e2e.e2e_helpers import (TIMEOUT, DEMOS, demo_source, canvas_colors, program_url, run_frame, wait_for_drawing, wait_for_graph,
                                   wait_for_widgets, error_text, real_errors)


@pytest.mark.parametrize("name", list(DEMOS))
def test_demo_runs(page: Page, base_url, demo_user, page_errors, writes, name):
    demo_source(page.request, base_url, demo_user, name)
    page.goto(program_url(base_url, demo_user, "Examples", name))
    frame = run_frame(page)
    check = DEMOS[name]
    if check == "graph":
        wait_for_graph(frame)
    else:
        wait_for_drawing(frame)
    if check == "widgets":
        wait_for_widgets(frame, 3)  # its buttons, slider and menu
    assert error_text(page) == "", f"{name}: error dialog: {error_text(page)}"
    assert real_errors(page_errors) == [], f"{name}: {real_errors(page_errors)}"
    assert writes == [], f"{name}: a smoke test must not write: {writes}"


def test_broken_package_is_caught(page: Page, base_url, demo_user):
    """Sabotage: with an empty glow package nothing can draw, so the drawing check must fail."""
    page.route("**/package/glow.*.min.js", lambda r: r.fulfill(body="", content_type="text/javascript"))
    page.goto(program_url(base_url, demo_user, "Examples", "Extrusions"))
    with pytest.raises(Exception):
        wait_for_drawing(run_frame(page))


from tests.test_rate_timing import LOOP


@pytest.mark.parametrize("n,body_ms", [(60, 8)])
def test_rate_counts_loop_body_time(page: Page, base_url, writes, n, body_ms):
    """#235 on the deployed package: an 8 ms body must not slow rate(60) below 85% of 60."""
    page.goto(f"{base_url}/docs/VPythonDocs/index.html")  # any page on the server's origin
    page.set_content(f'<script src="{base_url}/lib/jquery/2.1/jquery.min.js"></script>'
                     f'<script src="{base_url}/package/glow.3.2.min.js"></script>')
    page.wait_for_function("typeof rate == 'function'", timeout=20_000)
    # Best of 3: one run in a few is slowed by the machine (seen once in WebKit, 38/s), while
    # the #235 bug gives about 40/s every time.
    rates = []
    for _ in range(3):
        rates.append(page.evaluate(LOOP, [n, body_ms, 60]))
        if rates[-1] >= 0.85 * n:
            break
    assert max(rates) >= 0.85 * n, f"rate({n}) with a {body_ms} ms body ran at {rates} per second"
    assert writes == []


def test_missing_demo_is_named(page: Page, base_url, demo_user):
    """A demo that has gone fails with its name, not as a blank canvas (read-only GET)."""
    with pytest.raises(AssertionError, match="NoSuchDemo"):
        demo_source(page.request, base_url, demo_user, "NoSuchDemo")


def test_detectors_see_the_run_frame(page: Page, base_url, demo_user, page_errors, writes):
    """Sabotage for page_errors and writes: an error and a POST from inside the run frame
    (cross-origin on glowscript.org) must be seen. The POST is answered here and never sent."""
    page.route("**/__e2e_probe", lambda r: r.fulfill(status=200, body="ok"))
    page.goto(program_url(base_url, demo_user, "Examples", "GraphTest"))
    run_frame(page).evaluate("""() => {
        fetch('/__e2e_probe', {method: 'POST', body: 'x'})
        console.error('E2E-CONSOLE')
        setTimeout(() => { throw new Error('E2E-THROW') }, 0)
    }""")
    deadline = time.monotonic() + TIMEOUT / 1000
    while not (writes and any("E2E-CONSOLE" in e for e in page_errors) and any("E2E-THROW" in e for e in page_errors)):
        assert time.monotonic() < deadline, f"writes={writes} page_errors={page_errors}"
        page.wait_for_timeout(100)


def test_canvas_check_does_not_hang_on_a_stalled_renderer(page: Page):
    """screenshot() waits for a draw that may never come; canvas_colors must give up."""
    page.set_content("<script>window.canvas = {activated: [{__renderer: {screenshot: () => new Promise(() => {})}}]}</script>")
    t0 = time.monotonic()
    assert canvas_colors(page.main_frame) == 0
    assert time.monotonic() - t0 < 10
