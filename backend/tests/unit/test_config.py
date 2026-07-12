import pytest
from pydantic import ValidationError

from config import Settings


def test_missing_database_url_raises(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr("config.settings", None, raising=False)
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(_env_file=None)


def test_settings_singleton_loads():
    from config import settings
    assert settings.DATABASE_URL != ""
