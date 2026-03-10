"""
End-to-end tests for a deployed (non-promoted) App Engine version.

Usage:
    pytest tests/test_e2e.py --base-url https://VERSION-dot-glowscript.appspot.com -v
"""
import pytest
from playwright.sync_api import Page, expect


# ---------------------------------------------------------------------------
# Home page / IDE
# ---------------------------------------------------------------------------

def test_home_page_loads(page: Page, base_url):
    """Home page should return 200 and render the IDE."""
    page.goto(base_url)
    expect(page).not_to_have_title("")
    assert page.title() != ""


def test_home_page_title(page: Page, base_url):
    """Home page title should be 'Web VPython'."""
    page.goto(base_url)
    expect(page).to_have_title("Web VPython")


def test_home_page_help_link(page: Page, base_url):
    """IDE should have a Help link pointing to the docs index."""
    page.goto(base_url)
    # Use the target=_blank Help link in the header (not the one inside ajaxBody)
    help_link = page.locator("a[target='_blank'][href*='VPythonDocs/index.html']")
    expect(help_link).to_be_visible()
    href = help_link.get_attribute("href")
    assert "VPythonDocs/index.html" in href


def test_home_page_sign_in_link(page: Page, base_url):
    """IDE should show a Sign in link for unauthenticated users."""
    page.goto(base_url)
    sign_in = page.locator("a.signin")
    expect(sign_in).to_be_visible()


# ---------------------------------------------------------------------------
# Static assets
# ---------------------------------------------------------------------------

def test_idejs_loads(page: Page, base_url):
    """ide.js should return 200 and contain JavaScript."""
    response = page.request.get(f"{base_url}/ide.js")
    assert response.status == 200
    assert "javascript" in response.headers.get("content-type", "").lower() or len(response.text()) > 1000


def test_css_loads(page: Page, base_url):
    """IDE CSS should return 200."""
    response = page.request.get(f"{base_url}/css/ide.css")
    assert response.status == 200


def test_docs_static_css_loads(page: Page, base_url):
    """Docs alabaster CSS should return 200."""
    response = page.request.get(f"{base_url}/docs/VPythonDocs/_static/alabaster.css")
    assert response.status == 200


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

def test_api_login_unauthenticated(page: Page, base_url):
    """API login endpoint should return not_logged_in state for anonymous requests."""
    response = page.request.get(f"{base_url}/api/login")
    assert response.status == 200
    data = response.json()
    assert data["state"] == "not_logged_in"
    assert "login_url" in data


def test_api_unknown_user_returns_404(page: Page, base_url):
    """GET on a non-existent user should return 404."""
    response = page.request.get(f"{base_url}/api/user/thisuserdoesnotexist99999")
    assert response.status == 404


# ---------------------------------------------------------------------------
# 404 handling
# ---------------------------------------------------------------------------

def test_unknown_route_returns_error(page: Page, base_url):
    """A non-existent page should not return 200."""
    response = page.request.get(f"{base_url}/this/does/not/exist")
    assert response.status != 200


# ---------------------------------------------------------------------------
# Docs index
# ---------------------------------------------------------------------------

def test_docs_index_loads(page: Page, base_url):
    """Docs index page should load and contain the table of contents."""
    page.goto(f"{base_url}/docs/VPythonDocs/index.html")
    expect(page.locator("body")).to_contain_text("VPython")


def test_docs_index_lists_group(page: Page, base_url):
    """Docs index should contain a link to group.html."""
    page.goto(f"{base_url}/docs/VPythonDocs/index.html")
    link = page.locator("a[href='group.html']")
    expect(link).to_be_visible()
    expect(link).to_contain_text("group")


def test_docs_help_link_from_ide(page: Page, base_url):
    """Clicking the Help link in the IDE should open the docs index."""
    page.goto(base_url)
    # Use the target=_blank Help link in the header
    with page.expect_popup() as popup_info:
        page.locator("a[target='_blank'][href*='VPythonDocs/index.html']").click()
    docs_page = popup_info.value
    docs_page.wait_for_load_state()
    assert "VPythonDocs/index.html" in docs_page.url


# ---------------------------------------------------------------------------
# group.html
# ---------------------------------------------------------------------------

def test_group_docs_page_loads(page: Page, base_url):
    """group.html docs page should load and contain expected content."""
    page.goto(f"{base_url}/docs/VPythonDocs/group.html")
    expect(page.locator("section#group > h1")).to_contain_text("group")
    expect(page.locator("body")).to_contain_text("group_to_world")
    expect(page.locator("body")).to_contain_text("world_to_group")


def test_group_docs_nav_links(page: Page, base_url):
    """group.html should have working prev/next navigation links."""
    page.goto(f"{base_url}/docs/VPythonDocs/group.html")
    expect(page.locator("a", has_text="compound").first).to_be_visible()
    expect(page.locator("a", has_text="vertex").first).to_be_visible()


def test_group_docs_next_link_works(page: Page, base_url):
    """Next link on group.html should navigate to vertex.html."""
    page.goto(f"{base_url}/docs/VPythonDocs/group.html")
    # The rel=next link in <head> confirms the correct next page
    next_href = page.locator("link[rel='next']").get_attribute("href")
    assert next_href == "vertex.html"
    # Also confirm we can navigate there directly
    response = page.request.get(f"{base_url}/docs/VPythonDocs/vertex.html")
    assert response.status == 200


def test_compound_docs_links_to_group(page: Page, base_url):
    """compound.html should link to group.html and the link should work."""
    page.goto(f"{base_url}/docs/VPythonDocs/compound.html")
    link = page.locator("a[href='group.html']").first
    expect(link).to_be_visible()
    link.click()
    expect(page).to_have_url(f"{base_url}/docs/VPythonDocs/group.html")
    expect(page.locator("section#group > h1")).to_contain_text("group")


# ---------------------------------------------------------------------------
# Other existing docs pages (sanity check nothing was broken)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("page_name,expected_text", [
    ("box.html",      "box"),
    ("sphere.html",   "sphere"),
    ("cylinder.html", "cylinder"),
    ("canvas.html",   "canvas"),
    ("vector.html",   "vector"),
    ("compound.html", "compound"),
    ("vertex.html",   "vertex"),
])
def test_existing_docs_page_loads(page: Page, base_url, page_name, expected_text):
    """Existing docs pages should still load correctly."""
    response = page.request.get(f"{base_url}/docs/VPythonDocs/{page_name}")
    assert response.status == 200
    assert expected_text in response.text()
