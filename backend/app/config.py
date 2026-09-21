from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ─── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ─── JWT ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # ─── Groq AI ──────────────────────────────────────────────────────────────
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "openai/gpt-oss-20b"

    # ─── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "Kamadhenu"
    VERSION: str = "0.1.0"
    DEBUG: bool = False


settings = Settings()  # type: ignore[call-arg]
