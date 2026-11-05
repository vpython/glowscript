"""Which key signs Flask sessions.

Sessions are signed cookies, so whoever knows the key can mint a session for any
user. The placeholder in ide/default_secret.py is public, so a deployed app must
never sign with it -- not even by falling back to it when the real key is
missing. Locally the placeholder is fine.
"""
import pytest

from ide import session_key
from ide.session_key import PLACEHOLDER, choose_key

REAL = b"0123456789abcdef" * 4
OTHER = b"fedcba9876543210" * 4


def never():
    raise AssertionError("should not have been called")


def missing():
    return None


def test_deployed_uses_secret_manager():
    assert choose_key(False, from_secret_manager=lambda: REAL, from_file=never) == REAL


def test_deployed_prefers_secret_manager_over_a_key_file():
    assert choose_key(False, from_secret_manager=lambda: REAL, from_file=lambda: OTHER) == REAL


def test_deployed_falls_back_to_a_real_key_file():
    assert choose_key(False, from_secret_manager=missing, from_file=lambda: REAL) == REAL


def test_deployed_refuses_to_start_without_a_key():
    with pytest.raises(RuntimeError, match="session key"):
        choose_key(False, from_secret_manager=missing, from_file=missing)


def test_deployed_refuses_the_placeholder_from_any_source():
    with pytest.raises(RuntimeError, match="session key"):
        choose_key(False, from_secret_manager=lambda: PLACEHOLDER, from_file=missing)
    with pytest.raises(RuntimeError, match="session key"):
        choose_key(False, from_secret_manager=missing, from_file=lambda: PLACEHOLDER)


def test_deployed_refuses_an_empty_key():
    with pytest.raises(RuntimeError, match="session key"):
        choose_key(False, from_secret_manager=lambda: b"", from_file=missing)


def test_locally_uses_the_key_file_and_skips_secret_manager():
    assert choose_key(True, from_secret_manager=never, from_file=lambda: REAL) == REAL


def test_locally_falls_back_to_the_placeholder():
    assert choose_key(True, from_secret_manager=never, from_file=missing) == PLACEHOLDER


def test_secret_manager_text_becomes_bytes(mocker):
    client = mocker.Mock()
    client.access_secret_version.return_value.payload.data = b"abc123\n"
    mocker.patch("google.cloud.secretmanager.SecretManagerServiceClient", return_value=client)
    assert session_key.read_secret_manager("proj", "name") == b"abc123"
    client.access_secret_version.assert_called_once_with(
        name="projects/proj/secrets/name/versions/latest")


def test_secret_manager_failure_reads_as_missing(mocker):
    mocker.patch("google.cloud.secretmanager.SecretManagerServiceClient",
                 side_effect=Exception("no credentials"))
    assert session_key.read_secret_manager("proj", "name") is None
