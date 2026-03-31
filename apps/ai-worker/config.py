"""
ZenC AI Worker configuration.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PG_HOST: str = "localhost"
    PG_PORT: int = 5432
    PG_USER: str = "postgres"
    PG_PASSWORD: str = ""
    PG_DATABASE: str = "zenc_ai"

    MONGO_URI: str = ""

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"

    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "zenc_curriculum"
    QDRANT_API_KEY: str = ""

    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"
    AI_PROVIDER_TIMEOUT_SECONDS: float = 10.0

    GROQ_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "EXAVITQu4vr4xnSDxMaL" # Sarah voice

    AZURE_SPEECH_KEY: str = ""
    AZURE_SPEECH_REGION: str = ""

    WORKER_PORT: int = 8000
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30

    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 50

    class Config:
        env_file = "../../.env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
