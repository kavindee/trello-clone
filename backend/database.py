"""SQLAlchemy engine, session factory, and declarative Base."""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Allow DATABASE_URL override for testing; default to the spec-mandated file.
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./kanban.db")

# connect_args is required for SQLite to allow multi-thread access (FastAPI
# runs each request in a thread-pool worker).
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


def get_db():
    """FastAPI dependency: yields a database session and ensures it is closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
