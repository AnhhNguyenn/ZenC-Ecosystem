"""
ZenC AI Worker – Configuration Management.

Uses Pydantic Settings for type-safe environment variable loading.
All config values have sensible defaults for local development,
but MUST be overridden via .env or Docker environment in production.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Pydantic Settings automatically reads from environment variables
    matching the field names (case-insensitive). For nested configs,
    use the `env_prefix` class var.
    """

    # ── SQL Server (MSSQL) ───────────────────────────────────────
    MSSQL_HOST: str = "localhost"
    MSSQL_PORT: int = 1433
    MSSQL_SA_PASSWORD: str = "ZenC@Str0ng!Pass2026"
    MSSQL_DATABASE: str = "zenc_ai"

    # ── Redis ────────────────────────────────────────────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "zenc_redis_secret"

    # ── Qdrant (Vector DB) ──────────────────────────────────────
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "zenc_curriculum"

    # ── Google Gemini API ────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"

    # ── Worker ───────────────────────────────────────────────────
    WORKER_PORT: int = 8000

    # ── RAG Pipeline ─────────────────────────────────────────────
    CHUNK_SIZE: int = 512
    """
    Number of tokens per text chunk for the RAG pipeline.
    512 balances retrieval precision vs. context completeness.
    Smaller chunks improve precision but lose context; larger chunks
    preserve context but reduce retrieval accuracy.
    """

    CHUNK_OVERLAP: int = 50
    """
    Token overlap between consecutive chunks prevents information
    loss at chunk boundaries (e.g., a sentence split across chunks).
    """

    class Config:
        env_file = "../../.env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Singleton settings instance
settings = Settings()
