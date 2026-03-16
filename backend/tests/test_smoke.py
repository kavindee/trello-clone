"""Smoke tests for Task 1: scaffolding and DB layer.

These tests verify:
  - database.py, models.py, schemas.py, and main.py all import cleanly.
  - SQLAlchemy can create all tables against an in-memory engine.
  - Pydantic schemas accept valid input and reject invalid input.
  - The /healthz endpoint responds 200.
  - The `db` and `client` fixtures from conftest.py work correctly.
"""

import pytest
from pydantic import ValidationError
from sqlalchemy import inspect

import database
import models
import schemas
from database import Base


# ---------------------------------------------------------------------------
# Import / table-creation checks
# ---------------------------------------------------------------------------


def test_base_metadata_has_expected_tables(create_test_tables):
    """All three ORM tables must be registered on Base.metadata."""
    table_names = set(Base.metadata.tables.keys())
    assert "boards" in table_names
    assert "lists" in table_names
    assert "cards" in table_names


def test_tables_exist_in_test_engine(create_test_tables):
    """create_all() must have materialised all tables in the in-memory DB."""
    from tests.conftest import test_engine

    inspector = inspect(test_engine)
    physical_tables = set(inspector.get_table_names())
    assert "boards" in physical_tables
    assert "lists" in physical_tables
    assert "cards" in physical_tables


# ---------------------------------------------------------------------------
# ORM column-presence checks
# ---------------------------------------------------------------------------


def test_board_columns():
    cols = {c.name for c in models.Board.__table__.columns}
    assert cols == {"id", "name", "created_at"}


def test_list_columns():
    cols = {c.name for c in models.List.__table__.columns}
    assert cols == {"id", "board_id", "name", "position", "created_at"}


def test_card_columns():
    cols = {c.name for c in models.Card.__table__.columns}
    assert cols == {"id", "list_id", "title", "position", "created_at"}


# ---------------------------------------------------------------------------
# Pydantic schema validation — BoardCreate
# ---------------------------------------------------------------------------


def test_board_create_valid():
    b = schemas.BoardCreate(name="My Board")
    assert b.name == "My Board"


def test_board_create_empty_string_rejected():
    with pytest.raises(ValidationError):
        schemas.BoardCreate(name="")


def test_board_create_whitespace_only_rejected():
    with pytest.raises(ValidationError):
        schemas.BoardCreate(name="   ")


def test_board_create_too_long_rejected():
    with pytest.raises(ValidationError):
        schemas.BoardCreate(name="x" * 256)


def test_board_create_newline_rejected():
    with pytest.raises(ValidationError):
        schemas.BoardCreate(name="hello\nworld")


def test_board_create_carriage_return_rejected():
    with pytest.raises(ValidationError):
        schemas.BoardCreate(name="hello\rworld")


# ---------------------------------------------------------------------------
# Pydantic schema validation — ListCreate
# ---------------------------------------------------------------------------


def test_list_create_valid():
    lst = schemas.ListCreate(name="To Do")
    assert lst.name == "To Do"


def test_list_create_whitespace_rejected():
    with pytest.raises(ValidationError):
        schemas.ListCreate(name="\t\n")


# ---------------------------------------------------------------------------
# Pydantic schema validation — CardCreate
# ---------------------------------------------------------------------------


def test_card_create_valid():
    card = schemas.CardCreate(title="Fix the bug")
    assert card.title == "Fix the bug"


def test_card_create_empty_rejected():
    with pytest.raises(ValidationError):
        schemas.CardCreate(title="")


# ---------------------------------------------------------------------------
# Pydantic schema validation — CardPatch
# ---------------------------------------------------------------------------


def test_card_patch_title_only():
    patch = schemas.CardPatch(title="New title")
    assert patch.title == "New title"
    assert patch.list_id is None


def test_card_patch_list_id_only():
    patch = schemas.CardPatch(list_id=2)
    assert patch.list_id == 2
    assert patch.title is None


def test_card_patch_both_fields():
    patch = schemas.CardPatch(title="Renamed", list_id=3)
    assert patch.title == "Renamed"
    assert patch.list_id == 3


def test_card_patch_empty_title_rejected():
    with pytest.raises(ValidationError):
        schemas.CardPatch(title="")


# ---------------------------------------------------------------------------
# FastAPI / TestClient checks
# ---------------------------------------------------------------------------


def test_healthz_returns_200(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_db_fixture_creates_usable_session(db):
    """Verify the db fixture yields a live, working SQLAlchemy session."""
    from sqlalchemy import text

    result = db.execute(text("SELECT 1")).scalar()
    assert result == 1
