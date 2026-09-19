from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

# Neon DB is serverless — connections can be dropped when idle.
# pool_pre_ping tests the connection before use (handles stale connections).
# pool_recycle rotates connections every 5 minutes to avoid Neon's idle timeout.
# pool_size / max_overflow are kept small since Neon's free tier has connection limits.
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    # SQLite (used in tests) does not support pool_size, max_overflow, or sslmode.
    engine = create_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_recycle=300,   # recycle connections after 5 min
        pool_size=5,
        max_overflow=10,
        connect_args={"sslmode": "require"},
    )


def create_db_and_tables() -> None:
    """Create all tables defined by SQLModel metadata and run minor column migrations.
    Called at application startup via lifespan handler.
    """
    SQLModel.metadata.create_all(engine)

    # In PostgreSQL, create_all does not alter existing tables.
    # Safely ensure newly added columns exist:
    if not _is_sqlite:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token VARCHAR(255);"))
            conn.commit()


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session per request."""
    with Session(engine) as session:
        yield session
