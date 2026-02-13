"""
ZenC AI Worker – Database Connection & Session Factory.

Uses SQLAlchemy 2.0 async-compatible engine connecting to MSSQL via pymssql.
Connection pooling is configured for the Worker's workload pattern:
relatively few long-running analytical queries rather than many short ones.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import settings


def _build_connection_url() -> str:
    """
    Build the MSSQL connection URL for SQLAlchemy.

    Using pymssql driver because it's pure Python and doesn't require
    ODBC drivers to be installed in the container, simplifying the
    Docker image.
    """
    return (
        f"mssql+pymssql://"
        f"sa:{settings.MSSQL_SA_PASSWORD}"
        f"@{settings.MSSQL_HOST}:{settings.MSSQL_PORT}"
        f"/{settings.MSSQL_DATABASE}"
    )


engine = create_engine(
    _build_connection_url(),
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,  # Recycle connections every 30 minutes
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


def get_db():
    """
    Dependency injection helper for FastAPI routes.

    Yields a database session and ensures it's closed after the
    request completes, even if an exception occurs.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
