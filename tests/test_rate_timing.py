"""
rate(N) timing, in a real browser.

rate(N) promises N loop iterations per second. The time the loop body takes
is part of each period, so rate() should wait only for what is left of it,
as desktop VPython's RateKeeper does. A flat 1000/N wait on top of the body
makes a physics loop with a fixed dt run slower than real time, and slower
the more work it does.

The page loads the same lib/ sources, in the same order, that
build_original_py3.py packs into package/glow.X.min.js, so these tests check
the source, not a stale package. No server and no conftest are needed:

    pytest --noconftest tests/test_rate_timing.py

Needs pytest-playwright and its chromium (requirements-test.txt).
"""
import re
from pathlib import Path

import pytest
from playwright.sync_api import Page

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "http://glowscript.test"


def _run_libs():
    build = (ROOT / "build_original_py3.py").read_text()
    run = re.search(r'"run":\s*\[(.*?)\]', build, re.S).group(1)
    return ["lib/jquery/2.1/jquery.min.js"] + [
        p[3:] for p in re.findall(r'"(\.\./lib/[^"]+)"', run.replace('"+"2.1"+"', "2.1"))
    ]


@pytest.fixture
def glow(page: Page):
    def serve(route):
        path = ROOT / route.request.url[len(ORIGIN) + 1:]
        if path.is_file():
            route.fulfill(path=str(path), content_type="text/javascript; charset=utf-8")
        else:
            route.fulfill(status=404)

    page.route(ORIGIN + "/lib/**", serve)
    page.route(ORIGIN + "/", lambda route: route.fulfill(
        content_type="text/html",
        body="".join(f'<script src="/{p}"></script>' for p in _run_libs())))
    page.goto(ORIGIN + "/")
    assert page.evaluate("typeof rate") == "function"
    return page


# Each loop busy-waits `body_ms` (the student's physics), then calls rate(n).
# Returns iterations per second over `iters` iterations, after one warm-up.
LOOP = """async ([n, body_ms, iters]) => {
    const work = (ms) => { const t = performance.now(); while (performance.now() - t < ms) {} }
    work(body_ms); await rate(n)
    const t0 = performance.now()
    for (let i = 0; i < iters; i++) { work(body_ms); await rate(n) }
    return iters / ((performance.now() - t0) / 1000)
}"""


@pytest.mark.parametrize("n,body_ms", [(60, 8), (60, 10), (100, 5), (30, 20)])
def test_rate_counts_the_loop_body_as_part_of_the_period(glow, n, body_ms):
    """A body shorter than the period should not slow the loop down."""
    hz = glow.evaluate(LOOP, [n, body_ms, 60])
    assert hz >= 0.85 * n, f"rate({n}) with a {body_ms} ms body ran at {hz:.1f} per second"


def test_rate_with_an_empty_body_is_not_faster_than_asked(glow):
    hz = glow.evaluate(LOOP, [60, 0, 60])
    assert hz <= 1.05 * 60, f"rate(60) ran at {hz:.1f} per second"


def test_a_body_longer_than_the_period_runs_as_fast_as_it_can(glow):
    """25 ms of work at rate(60): 1/(25 ms + the zero wait) per second, not 1/(25 + 16.7 ms) = 24.

    The zero wait still costs a browser's minimum nested timer, 4 ms in Chrome, so about 34.
    """
    hz = glow.evaluate(LOOP, [60, 25, 30])
    assert hz >= 30, f"rate(60) with a 25 ms body ran at {hz:.1f} per second"


def test_rate_does_not_catch_up_after_a_stall(glow):
    """One slow iteration must not be followed by a burst of zero-wait ones."""
    gaps = glow.evaluate("""async () => {
        const work = (ms) => { const t = performance.now(); while (performance.now() - t < ms) {} }
        for (let i = 0; i < 10; i++) await rate(50)
        work(300)                    // a stall of 15 periods
        await rate(50)
        const gaps = []
        let last = performance.now()
        for (let i = 0; i < 5; i++) {
            await rate(50)
            const now = performance.now(); gaps.push(now - last); last = now
        }
        return gaps
    }""")
    # The first gap can be short by the zero wait's own few ms; a burst would be near 0.
    assert min(gaps) >= 0.5 * 20, f"iterations after the stall came {gaps} ms apart"
    assert sum(gaps) >= 0.8 * 5 * 20, f"iterations after the stall came {gaps} ms apart"
