# Browser tests

Two sets, both Playwright (pytest-playwright), both run in Docker.

**Smoke (A), `test_smoke.py`: safe against any server.** Anonymous and read-only (each test
asserts no request but GET was sent). Runs four GlowScriptDemos programs and checks rate().

    # before switching traffic, against the --no-promote candidate:
    pytest tests/e2e/test_smoke.py tests/test_e2e.py --base-url https://VERSION-dot-glowscript.appspot.com --browser chromium --browser webkit
    # and once right after the switch, against https://glowscript.org (the only run that
    # goes through the real cross-origin sandbox)

**Local (B1), `test_local_*.py`: one user's whole workflow, on a throwaway stack.**

    ./run_e2e.sh            # needs only Docker; runs everything, both browsers, then cleans up
    ./run_e2e.sh -k local_run    # extra arguments go to pytest

These tests create data, so they are marked `local_only` and are skipped unless --base-url is
http://localhost. Locally every request is the same user (issue #208), so sign-in and
cross-user privacy are not covered yet.

Use `localhost`, not `127.0.0.1`. At `http://127.0.0.1:8080` pages and the editor work but no
program runs: the IDE only runs the program frame same-origin for `localhost`
(`ide/ide.js:1111`), and anywhere else points it at a `https://sandbox.` host that doesn't exist
locally. The same applies when you run Flask by hand and open it in a browser. Fixing the IDE
is a backlog item; until then the `local_only` guard refuses `127.0.0.1`.

How a test decides a program worked: no page or console errors (see KNOWN_NOISE), our own
programs print an `E2E-DONE` marker, the 3D canvas has more than one color, graphs have traces.
Each check has a test that makes it fail on purpose.

Known browser differences, each handled in the test that meets it:
- WebKit doesn't await an async `wait_for_function` predicate, so canvas checks poll from Python.
- Runtime-error line numbers come only in Chromium (`untrusted/run.js:82`).
- Playwright's WebKit treats the IDE's download (`window.location`) as a navigation, so the
  download test checks the server's response rather than a download event.
