"""B1: running the user's own programs: output, errors, version headers."""
import pytest
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeout
from tests.e2e.e2e_helpers import (uniq, api_put, program_url, run_frame, wait_for_print, print_text,
                                   error_text, wait_for_drawing, canvas_colors, real_errors,
                                   wait_for_graph, wait_for_widgets)

pytestmark = pytest.mark.local_only


def run(page, base_url, u, src):
    prog = uniq("Run")
    api_put(page.request, base_url, f"user/{u['name']}/folder/MyPrograms/program/{prog}", {"source": src}, u["secret"])
    page.goto(program_url(base_url, u["name"], "MyPrograms", prog))
    return run_frame(page)


def wait_error(page):
    page.locator(".ui-dialog .error-details:visible").first.wait_for(timeout=20_000)
    return error_text(page)


def test_print_reaches_the_page(page: Page, base_url, local_user, page_errors):
    frame = run(page, base_url, local_user, 'Web VPython 3.2\nprint("E2E-DONE", 6*7)\n')
    wait_for_print(frame, "E2E-DONE 42")
    assert real_errors(page_errors) == []


def test_drawing_check_sees_objects(page: Page, base_url, local_user):
    frame = run(page, base_url, local_user, 'Web VPython 3.2\nbox(color=color.red)\nprint("E2E-DONE")\n')
    wait_for_print(frame, "E2E-DONE")
    wait_for_drawing(frame)


def test_drawing_check_fails_on_empty_scene(page: Page, base_url, local_user):
    """Sabotage for wait_for_drawing: a scene whose only object is hidden is one color.
    (With no object at all the canvas is never activated and canvas_colors is -1.)"""
    frame = run(page, base_url, local_user, 'Web VPython 3.2\nb = box()\nb.visible = False\nprint("E2E-DONE")\n')
    wait_for_print(frame, "E2E-DONE")
    assert canvas_colors(frame) == 1


def test_syntax_error_names_its_line(page: Page, base_url, local_user):
    run(page, base_url, local_user, 'Web VPython 3.2\nx = 1\ny = )\nprint("E2E-DONE")\n')
    assert wait_error(page) == "Error: Too many right parentheses, line 3: y = )"


def test_runtime_error_names_its_line(page: Page, base_url, local_user, browser_name):
    run(page, base_url, local_user, 'Web VPython 3.2\nx = 1\nprint(undefined_name)\n')
    assert "undefined_name" in wait_error(page)
    traceback = " ".join(page.locator(".ui-dialog .error-traceback").all_inner_texts())
    if browser_name == "chromium":  # run.js:82: "This machinery only gives trace information on Chrome"
        assert "At or near line 3: print(undefined_name)" in traceback


def test_older_version_header_runs(page: Page, base_url, local_user):
    frame = run(page, base_url, local_user, 'GlowScript 3.0 VPython\nprint("E2E-DONE", 6*7)\n')
    wait_for_print(frame, "E2E-DONE 42")


def test_unknown_version_names_the_header_to_use(page: Page, base_url, local_user):
    # The program is never sent to the frame (ide.js:1144), so only the dialog can be checked.
    run(page, base_url, local_user, 'Web VPython 9.9\nprint("E2E-DONE")\n')
    wanted = page.locator(".ui-dialog .desired-version:visible")
    wanted.wait_for(timeout=20_000)
    assert wanted.inner_text() == "Web VPython 3.2 (or JavaScript 3.2)"


def test_graph_check_fails_without_traces(page: Page, base_url, local_user):
    """Sabotage for wait_for_graph: an empty graph has no traces."""
    frame = run(page, base_url, local_user, 'Web VPython 3.2\ng = graph()\nprint("E2E-DONE")\n')
    wait_for_print(frame, "E2E-DONE")
    with pytest.raises(PlaywrightTimeout):
        wait_for_graph(frame)


def test_widget_check_fails_without_widgets(page: Page, base_url, local_user):
    """Sabotage for wait_for_widgets: a program with no button, slider or menu."""
    frame = run(page, base_url, local_user, 'Web VPython 3.2\nbox()\nprint("E2E-DONE")\n')
    wait_for_print(frame, "E2E-DONE")
    with pytest.raises(PlaywrightTimeout):
        wait_for_widgets(frame, 1)
