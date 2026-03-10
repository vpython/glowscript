"""
End-to-end tests for a deployed (non-promoted) App Engine version.

Usage:
    pytest tests/test_e2e.py --base-url https://VERSION-dot-glowscript.appspot.com -v
"""
import pytest
from playwright.sync_api import Page, expect


def test_home_page_loads(page: Page, base_url):
    """Home page should return 200 and render the IDE."""
    page.goto(base_url)
    expect(page).not_to_have_title("")
    assert page.title() != ""


def test_api_login_unauthenticated(page: Page, base_url):
    """API login endpoint should return not_logged_in state for anonymous requests."""
    response = page.request.get(f"{base_url}/api/login")
    assert response.status == 200
    data = response.json()
    assert data["state"] == "not_logged_in"
    assert "login_url" in data


def test_group_docs_page_loads(page: Page, base_url):
    """group.html docs page should load and contain expected content."""
    page.goto(f"{base_url}/docs/VPythonDocs/group.html")
    expect(page.locator("h1")).to_contain_text("group")
    expect(page.locator("body")).to_contain_text("group_to_world")
    expect(page.locator("body")).to_contain_text("world_to_group")


def test_group_docs_nav_links(page: Page, base_url):
    """group.html should have working prev/next navigation links."""
    page.goto(f"{base_url}/docs/VPythonDocs/group.html")
    # Previous: compound
    prev = page.locator("a", has_text="compound").first
    expect(prev).to_be_visible()
    # Next: vertex
    next_ = page.locator("a", has_text="vertex").first
    expect(next_).to_be_visible()


def test_compound_docs_links_to_group(page: Page, base_url):
    """compound.html should link to group.html and the link should work."""
    page.goto(f"{base_url}/docs/VPythonDocs/compound.html")
    link = page.locator("a[href='group.html']").first
    expect(link).to_be_visible()
    link.click()
    expect(page).to_have_url(f"{base_url}/docs/VPythonDocs/group.html")
    expect(page.locator("h1")).to_contain_text("group")
