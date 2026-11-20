"""B1: folders, through the folder page (ide/templates/index.html .folderPage)."""
import pytest
from playwright.sync_api import Page, expect
from tests.e2e.e2e_helpers import uniq, api_put, wait_no_dialog

pytestmark = pytest.mark.local_only


def folder_page(page, base_url, user, folder="MyPrograms"):
    page.goto(f"{base_url}/#/user/{user}/folder/{folder}/")  # the trailing / is required (ide.js:463)
    page.locator("#ajaxBody .folderPage").wait_for(state="attached")  # floated children: 0 height


def folders(page, base_url, user):
    d = page.request.get(f"{base_url}/api/user/{user}/folder/").json()
    return dict(zip(d["folders"], d["publics"]))


def test_create_private_folder(page: Page, base_url, local_user):
    name = uniq("F")
    folder_page(page, base_url, local_user["name"])
    page.locator("#ajaxBody .folder-new").click()
    dialog = page.locator(".ui-dialog:visible")
    dialog.locator("input[name=name]").fill(name)
    dialog.locator("input[name=isPublic]").uncheck()
    dialog.get_by_role("button", name="Create").click()
    expect(page.locator("#ajaxBody .folder-name", has_text=name)).to_be_visible()
    assert folders(page, base_url, local_user["name"])[name] is False


def test_toggle_folder_public(page: Page, base_url, local_user):
    name = uniq("F")
    api_put(page.request, base_url, f"user/{local_user['name']}/folder/{name}", {"public": False}, local_user["secret"])
    folder_page(page, base_url, local_user["name"], name)
    page.locator("#ajaxBody .folder-public").click()
    page.locator(".ui-dialog:visible").get_by_role("button", name="Yes").click()
    wait_no_dialog(page)
    assert folders(page, base_url, local_user["name"])[name] is True


def test_delete_empty_folder(page: Page, base_url, local_user):
    name = uniq("F")
    api_put(page.request, base_url, f"user/{local_user['name']}/folder/{name}", {"public": True}, local_user["secret"])
    folder_page(page, base_url, local_user["name"], name)
    page.locator("#ajaxBody .folder-delete").click()
    page.locator(".ui-dialog:visible").get_by_role("button", name="Delete").click()
    wait_no_dialog(page)
    assert name not in folders(page, base_url, local_user["name"])


def test_folder_with_programs_is_not_deleted(page: Page, base_url, local_user):
    name = uniq("F"); user = local_user["name"]
    api_put(page.request, base_url, f"user/{user}/folder/{name}", {"public": True}, local_user["secret"])
    api_put(page.request, base_url, f"user/{user}/folder/{name}/program/P", {"source": "Web VPython 3.2\n"}, local_user["secret"])
    r = page.request.delete(f"{base_url}/api/user/{user}/folder/{name}", headers={"X-CSRF-Token": local_user["secret"]})
    assert r.status == 409
    assert name in folders(page, base_url, user)
