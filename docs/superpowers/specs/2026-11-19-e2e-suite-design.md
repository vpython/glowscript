# End-to-end test suite: design

Date: 2026-11-19. Status: reviewed; open questions answered by Steve the same day.

## Goal

Catch breakage before a glowscript.org traffic switch, and before a merge, by driving the
real site in a real browser and running real programs.

Today `tests/test_e2e.py` (24 tests) checks that pages load, that the docs are there and that
a few API calls return the right status codes. Nothing runs a program. A broken compiler, a
broken `package/glow.3.2.min.js`, a broken run iframe or a `rate()` regression (#235) all pass.

## Decisions already made

- **Tool:** Playwright (`pytest-playwright`), the tool the suite already uses. It runs in the
  Playwright Docker image and gives Chromium plus WebKit (an approximation of Safari).
  Selenium is not used. Driving real Safari through `safaridriver` stays a possible later
  extra for Safari-only bugs like #230, outside this spec.
- **No test accounts in prod.** A `--no-promote` candidate shares glowscript.org's live
  Datastore, so anything run against a candidate is anonymous and read-only.
- **Scope:** a small smoke set (A) for candidates and a robust single-user set (B1) for the
  local stack. Multi-user and sign-in tests (B2) wait for issue #208 and get their own spec.

## Layout

```
tests/
  e2e/
    conftest.py          shared fixtures and helpers (below)
    test_smoke.py        A: anonymous, read-only
    test_local_*.py      B1: marked local_only
  test_e2e.py            existing 24 tests, unchanged
run_e2e.sh               local stack in Docker: Datastore emulator + Flask + Playwright
```

## A: smoke tests (any URL)

Anonymous and read-only. Run against every candidate, and once against glowscript.org right
after a traffic switch. Target: under 2 minutes, in Chromium and WebKit.

1. Run these public demos (Steve's picks, 2026-11-19), from
   `/#/user/GlowScriptDemos/folder/Examples/program/<name>`:
   `VPythonObjects-VPython`, `Extrusions`, `GraphTest`, `ButtonsSlidersMenus-VPython`.
   Each must compile, draw a non-blank canvas and log no page errors. `GraphTest` also checks
   that a graph is drawn; `ButtonsSlidersMenus-VPython` that its widgets appear. The list lives
   in one place in the test file; a demo that has gone fails with a clear message, rather than
   the test guessing a replacement.
2. A `rate()` timing check, reusing the loop and thresholds of `tests/test_rate_timing.py`
   against the deployed package.

A has no compile-error test: the IDE saves as you edit, so running a program of our own means
writing to the Datastore, which a candidate shares with prod. Compile and runtime errors are
tested in B1.

Why the post-switch run matters: `-dot-` candidate URLs are the "preview" host, which runs
programs in an unsandboxed same-origin iframe (`ide/routes.py:168`). Only glowscript.org
itself uses the cross-origin sandbox, so only the post-switch run exercises it.

## B1: single-user tests (local stack only)

Everything one signed-in user does, through the real UI:

- First visit: pick a username; `MyPrograms` (public) and `Private` (private) are created.
- Folders: create, list, make public/private, delete.
- Programs: create; edit in the editor; save; reload and the edit is still there; rename;
  copy and move between folders; delete.
- Run: output and `print()` reach the page; the marker check below passes; a syntax error on
  line 3 shows `#program-error-dialog` naming line 3, without a page crash; a runtime error is
  shown with its line; `input()` if the runtime supports it.
- Version headers: `Web VPython 3.2` runs; an older supported version runs; an unknown version
  gives a clear error.
- Download/export of a program.

Locally every request is `localuser@local.host` (`ide/auth.py:172-176`, issue #208), so B1 has
exactly one user and no anonymous state. It cannot test sign-in, sign-out or one user's view of
another's work; that is B2.

**Guard:** tests in B1 carry a `local_only` marker. `conftest.py` skips them unless
`--base-url` is `localhost`, so they can never write to prod by accident. The guard itself has
a test.

`127.0.0.1` is refused too, though it is just as local: the IDE runs the program frame
same-origin only when `document.domain == "localhost"` (`ide/ide.js:1111`). On any other host,
`ide/routes.py` sets the frame's prefix to `https://sandbox.`, so at `127.0.0.1:8080` the frame
points at `https://sandbox.127.0.0.1:8080`, which doesn't exist, and programs never run. Pages
and the editor still work, which makes the failure confusing. Left as is for now (Steve,
2026-11-20); backlog: make the IDE treat `127.0.0.1` (and `[::1]`) like `localhost`, in its own
small PR, and then let the guard accept it.

## How a test decides a program worked

No screenshot comparison: it is fragile across browsers, GPUs and demo edits.

1. **No errors:** no `pageerror` in the page or the run iframe; no GlowScript error panel; no
   console errors except an explicit allowlist of known noise.
2. **Output:** programs we write end with `print("E2E-DONE", <value>)`; the test waits for
   that marker in the output area. That proves compile, run and output. Demo programs, which
   we don't control, rely on checks 1 and 3.
3. **Drew something:** the WebGL canvas exists, has non-zero size, and sampled pixels are not
   all one color. Pixels are read via the page's own `scene` capture, since a WebGL canvas can
   read back blank. If that proves unreliable in headless WebKit, WebKit uses checks 1–2 only,
   and that decision is recorded in the test.
4. **Waits** are on conditions (marker appears, canvas exists), capped at 20 s. No fixed sleeps.
5. **On failure:** a screenshot and the console log are attached to the pytest output.

## Running

- **Against a candidate:** `pytest tests/e2e/test_smoke.py tests/test_e2e.py --base-url https://VERSION-dot-glowscript.appspot.com`
  (in the Playwright image, with `--noconftest` as today, or after the conftest split below).
- **Local stack:** `./run_e2e.sh` needs only Docker. It starts a fresh Datastore emulator
  (no stored data, so every run starts empty) and a Playwright container on one Docker
  network. That container installs `requirements.txt`, starts Flask with
  `GLOWSCRIPT_RUNNING_LOCALLY=true`, waits for it, then runs B1, A and the existing
  `test_e2e.py` against `http://localhost:8080`, and tears everything down. It does not use
  the prebuilt `us.gcr.io/.../glowscript-flask` image, which runs stale requirements.
- **Browsers:** Chromium by default; `--browser webkit` (pytest-playwright) for WebKit.
  `run_e2e.sh` runs both.
- `tests/conftest.py` imports the Flask app, which is why runs against a URL need
  `--noconftest` today. `tests/e2e/` gets its own `conftest.py` that does not import the app,
  so the e2e tests run without Flask installed.

## Out of scope

- B2: sign-in, sign-out, anonymous viewing, sharing and cross-user privacy (after #208).
- Real Safari via Selenium/safaridriver.
- A GitHub Actions workflow. The repo has no CI; `run_e2e.sh` is written so one could call it.
- Visual regression testing.

## Selectors

No changes to the app. `ide/templates/index.html` already uses meaningful class names and ids:
page templates `.welcomePage`, `.folderPage`, `.runPage`, `.editPage`, `.sharePage`; buttons
`.prog-run`, `.prog-edit`, `.prog-copy`, `.prog-rename`, `.prog-delete`, `.program-new`,
`.folder-new`, `.folder-public`, `.folder-delete`, `.prog-download`; dialogs `#newUser-dialog`,
`#prog-new-dialog`, `#prog-copy-dialog`, `#prog-rename-dialog`, `#prog-delete-dialog`,
`#folder-new-dialog`, `#folder-delete-dialog`, `#version-error-dialog`,
`#program-error-dialog` (`.error-details`, `.error-traceback`); the editor `.program-editor`;
the run iframe `.untrusted-frame`. Inside the iframe (`untrusted/run.html`): `#loading` and
`#glowscript`. The canvas check uses `scene.__renderer.screenshot()` in the iframe, the call
the IDE's own thumbnails use (`untrusted/run.js:350`). Playwright evaluates inside the iframe
whether it is same-origin (candidates, local) or cross-origin (glowscript.org).

The iframe posts errors to the IDE (`send({ error, traceback })`, `untrusted/run.js:177`),
which shows `#program-error-dialog`; that dialog is the error check, along with `pageerror`.
