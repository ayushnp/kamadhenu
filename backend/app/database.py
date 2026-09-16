from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

# Neon DB is serverless — connections can be dropped when idle.
# pool_pre_ping tests the connection before use (handles stale connections).
# pool_recycle rotates connections every 5 minutes to avoid Neon's idle timeout.
# pool_size / max_overflow are kept small since Neon's free tier has connection limits.
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
    """Create all tables defined by SQLModel metadata.
    Called at application startup via lifespan handler.
    """
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session per request."""
    with Session(engine) as session:
        yield session
