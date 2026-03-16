"""Pytest fixtures shared across all backend test modules.

Uses an in-memory SQLite database so tests are:
  - Isolated from the production kanban.db file.
  - Fast (no disk I/O).
  - Idempotent (fresh schema per test session by default; see note below).

The `db` fixture provides a raw SQLAlchemy session against the in-memory DB.
The `client` fixture provides a FastAPI TestClient whose `get_db` dependency
is overridden to use the same in-memory session.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import Base and all models so their tables are registered on Base.metadata
# before create_all() is called.
from database import Base, get_db  # noqa: F401 — side-effect import for models
import models  # noqa: F401 — registers Board, List, Card on Base.metadata
from main import app

# ---------------------------------------------------------------------------
# In-memory SQLite engine — shared for the entire test session.
# Each test function that needs isolation should rely on the `db` fixture
# which rolls back after each test.
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = sessionmaker(
    bind=test_engine,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="session", autouse=True)
def create_test_tables():
    """Create all tables once for the entire test session."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db(create_test_tables):  # noqa: ARG001
    """Yield a transactional DB session; roll back after each test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    """FastAPI TestClient with the `get_db` dependency overridden."""

    def _override_get_db():
        try:
            yield db
        finally:
            pass  # rollback handled by the `db` fixture

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
