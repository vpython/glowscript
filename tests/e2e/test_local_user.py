"""B1: the first visit of the single local user (locally every request is localuser@local.host)."""
import pytest

pytestmark = pytest.mark.local_only


def test_fresh_stack_starts_without_a_user(local_user):
    assert local_user["first_visit_state"] == "new_user"


def test_new_user_gets_two_folders(local_user):
    assert local_user["folders_after_create"] == {"MyPrograms": True, "Private": False}
