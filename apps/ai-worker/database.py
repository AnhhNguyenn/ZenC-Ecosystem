"""
ZenC AI Worker - Database Connection & Session Factory.

PostgreSQL via psycopg2 driver. The async session adapter wraps
synchronous calls in worker threads to keep the event loop non-blocking.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker, DeclarativeBase
from config import settings


def _build_connection_url() -> str:
    """
    Build the PostgreSQL connection URL for SQLAlchemy.

    Using psycopg2 driver (pure C extension) for maximum performance
    and native PostgreSQL support.
    """
    return (
        f"postgresql+psycopg2://"
        f"{settings.PG_USER}:{settings.PG_PASSWORD}"
        f"@{settings.PG_HOST}:{settings.PG_PORT}"
        f"/{settings.PG_DATABASE}"
    )


engine = create_engine(
    _build_connection_url(),
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=1800,  # Recycle connections every 30 minutes
    echo=False,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


class BufferedScalarResult:
    """Thread-safe scalar result wrapper backed by fully buffered rows."""

    def __init__(self, values: list[Any]) -> None:
        self._values = list(values)

    def all(self) -> list[Any]:
        return list(self._values)

    def first(self) -> Any | None:
        return self._values[0] if self._values else None

    def one(self) -> Any:
        if len(self._values) != 1:
            raise ValueError(
                f"Expected exactly one scalar row, got {len(self._values)}"
            )
        return self._values[0]

    def one_or_none(self) -> Any | None:
        if not self._values:
            return None
        if len(self._values) > 1:
            raise ValueError(
                f"Expected zero or one scalar row, got {len(self._values)}"
            )
        return self._values[0]


class BufferedResult:
    """Thread-safe result wrapper backed by rows materialized in the worker thread."""

    def __init__(self, rows: list[Any], rowcount: int | None = None) -> None:
        self._rows = list(rows)
        self.rowcount = rowcount if rowcount is not None else len(self._rows)

    def all(self) -> list[Any]:
        return list(self._rows)

    def first(self) -> Any | None:
        return self._rows[0] if self._rows else None

    def one(self) -> Any:
        if len(self._rows) != 1:
            raise ValueError(f"Expected exactly one row, got {len(self._rows)}")
        return self._rows[0]

    def one_or_none(self) -> Any | None:
        if not self._rows:
            return None
        if len(self._rows) > 1:
            raise ValueError(f"Expected zero or one row, got {len(self._rows)}")
        return self._rows[0]

    def scalar(self) -> Any | None:
        return self._extract_scalar(self.first())

    def scalar_one(self) -> Any:
        return self._extract_scalar(self.one())

    def scalar_one_or_none(self) -> Any | None:
        return self._extract_scalar(self.one_or_none())

    def scalars(self) -> BufferedScalarResult:
        return BufferedScalarResult(
            [self._extract_scalar(row) for row in self._rows]
        )

    @staticmethod
    def _extract_scalar(row: Any) -> Any | None:
        if row is None:
            return None

        if hasattr(row, "_mapping"):
            mapping = row._mapping
            if mapping:
                return next(iter(mapping.values()))

        try:
            return row[0]
        except Exception:
            return row


class AsyncSessionAdapter:
    """
    Thin async facade over a synchronous SQLAlchemy Session.

    This keeps the service layer non-blocking without requiring an async
    PostgreSQL driver (asyncpg) migration in the same patch.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def _execute_buffered(self, *args, **kwargs) -> BufferedResult:
        result = self._session.execute(*args, **kwargs)
        if getattr(result, "returns_rows", False):
            return BufferedResult(result.all())
        return BufferedResult([], rowcount=getattr(result, "rowcount", 0))

    async def execute(self, *args, **kwargs) -> BufferedResult:
        return await asyncio.to_thread(self._execute_buffered, *args, **kwargs)

    async def commit(self) -> None:
        await asyncio.to_thread(self._session.commit)

    async def rollback(self) -> None:
        await asyncio.to_thread(self._session.rollback)

    async def flush(self) -> None:
        await asyncio.to_thread(self._session.flush)

    async def close(self) -> None:
        await asyncio.to_thread(self._session.close)

    def add(self, instance) -> None:
        self._session.add(instance)

    def add_all(self, instances) -> None:
        self._session.add_all(instances)

    def __getattr__(self, name: str):
        return getattr(self._session, name)


@asynccontextmanager
async def async_session_factory():
    session = SessionLocal()
    adapter = AsyncSessionAdapter(session)
    try:
        yield adapter
    except Exception:
        await adapter.rollback()
        raise
    finally:
        await adapter.close()


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
