"""B1: one user's programs, through the folder and edit pages."""
import pytest
from playwright.sync_api import Page, expect
from tests.e2e.e2e_helpers import uniq, api_put, program_url, set_source, wait_saved, wait_no_dialog

pytestmark = pytest.mark.local_only
SRC = 'Web VPython 3.2\nprint("E2E-DONE", 6*7)\n'


def source_of(page, base_url, user, folder, prog):
    # A missing program is a 200 with {"error": "... does not exist."}, not a 404.
    r = page.request.get(f"{base_url}/api/user/{user}/folder/{folder}/program/{prog}")
    return r.json().get("source") if r.ok else None


def make(page, base_url, u, prog, folder="MyPrograms", src=SRC):
    api_put(page.request, base_url, f"user/{u['name']}/folder/{folder}/program/{prog}", {"source": src}, u["secret"])


def my_programs(page, base_url, u):
    page.goto(f"{base_url}/#/user/{u['name']}/folder/MyPrograms/")


def test_new_program_opens_editor_with_header(page: Page, base_url, local_user):
    prog = uniq("P")
    my_programs(page, base_url, local_user)
    page.locator("#ajaxBody .program-new").click()
    dialog = page.locator(".ui-dialog:visible")
    dialog.locator("input[name=name]").fill(prog)
    dialog.get_by_role("button", name="Create").click()
    page.locator("#ajaxBody .editPage .program-editor").wait_for()
    assert source_of(page, base_url, local_user["name"], "MyPrograms", prog).startswith("Web VPython 3.2")


def test_edit_autosaves_and_survives_reload(page: Page, base_url, local_user):
    prog = uniq("P"); make(page, base_url, local_user, prog, src="Web VPython 3.2\n")
    page.goto(program_url(base_url, local_user["name"], "MyPrograms", prog, "edit"))
    set_source(page, SRC)
    wait_saved(page)
    page.reload()
    page.wait_for_function("s => window.editor && window.editor.getSession().getValue() === s", arg=SRC)
    assert source_of(page, base_url, local_user["name"], "MyPrograms", prog) == SRC


def test_rename_program(page: Page, base_url, local_user):
    prog, new = uniq("P"), uniq("R"); make(page, base_url, local_user, prog)
    my_programs(page, base_url, local_user)
    page.locator("#ajaxBody .program", has_text=prog).locator(".prog-rename").click()
    dialog = page.locator(".ui-dialog:visible")
    dialog.locator("input[name=name]").fill(new)
    dialog.get_by_role("button", name="Rename").click()
    expect(page.locator("#ajaxBody .prog-name", has_text=new)).to_be_visible()
    assert source_of(page, base_url, local_user["name"], "MyPrograms", new) == SRC
    assert source_of(page, base_url, local_user["name"], "MyPrograms", prog) is None


def test_copy_program_to_other_folder(page: Page, base_url, local_user):
    prog = uniq("P"); make(page, base_url, local_user, prog)
    my_programs(page, base_url, local_user)
    page.locator("#ajaxBody .program", has_text=prog).locator(".prog-copy").click()
    dialog = page.locator(".ui-dialog:visible")
    dialog.locator("input[name=name]").fill(f"Private/{prog}")
    dialog.get_by_role("button", name="Copy").click()
    wait_no_dialog(page)
    assert source_of(page, base_url, local_user["name"], "Private", prog) == SRC
    assert source_of(page, base_url, local_user["name"], "MyPrograms", prog) == SRC


def test_delete_program(page: Page, base_url, local_user):
    prog = uniq("P"); make(page, base_url, local_user, prog)
    my_programs(page, base_url, local_user)
    page.locator("#ajaxBody .program", has_text=prog).locator(".prog-delete").click()
    page.locator(".ui-dialog:visible").get_by_role("button", name="Delete").click()
    expect(page.locator("#ajaxBody .prog-name", has_text=prog)).to_have_count(0)
    assert source_of(page, base_url, local_user["name"], "MyPrograms", prog) is None


def test_download_program(page: Page, base_url, local_user):
    prog = uniq("P"); make(page, base_url, local_user, prog)
    page.goto(program_url(base_url, local_user["name"], "MyPrograms", prog, "edit"))
    # Checks the response, not a download event: the IDE downloads by setting window.location
    # (ide.js:1404), which Playwright's WebKit treats as a navigation and never reports as a download.
    with page.expect_response(lambda r: r.url.endswith(f"/program/{prog}/option/downloadProgram"),
                              timeout=20_000) as resp:
        page.locator("#ajaxBody .prog-download").click()
    r = resp.value
    assert r.ok and r.headers.get("content-disposition", "").startswith("attachment")
    assert "E2E-DONE" in r.text()
