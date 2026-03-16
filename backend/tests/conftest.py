"""Pytest fixtures shared across all backend test modules.

ISOLATION STRATEGY — per-test in-memory SQLite engine
------------------------------------------------------
Each test function gets its own `sqlite:///:memory:` engine with a freshly
created schema.  This is necessary because the FastAPI routers call
`db.commit()` to persist data, and the older "join external transaction +
rollback" pattern does not survive a real COMMIT against a shared connection.

Using a separate in-memory engine per test guarantees:
  - Complete data isolation between tests (no shared state).
  - Routers can call commit/rollback freely without breaking test teardown.
  - The engine is disposed after each test, releasing all memory.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import models so their tables are registered on Base.metadata before
# create_all() is called inside the `db` fixture.
from database import Base, get_db  # noqa: F401
import models  # noqa: F401  — registers Board, List, Card on Base.metadata
from main import app


# ---------------------------------------------------------------------------
# Core fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def db():
    """Yield a SQLAlchemy session backed by a fresh in-memory SQLite DB.

    Tables are created before the session is yielded and the engine is
    disposed (in-memory DB erased) after the test completes.
    """
    # StaticPool reuses a single DBAPI connection for the engine's lifetime.
    # Without it, SQLAlchemy's default pool creates *separate* connections for
    # each checkout, and each in-memory SQLite connection gets its own empty
    # database — so create_all() would populate one connection while the
    # session would later see an empty database on a different connection.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db):
    """FastAPI TestClient whose `get_db` dependency is overridden with the
    per-test session provided by the `db` fixture."""

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
