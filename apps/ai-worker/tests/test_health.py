"""
Tests for ZenC AI Worker health and root endpoints.

Uses FastAPI TestClient (via httpx) to send requests without
starting a real server or connecting to external services.
"""

import os
import sys
from unittest.mock import patch, MagicMock
from contextlib import asynccontextmanager

import pytest
from httpx import AsyncClient, ASGITransport


# --- Mock heavy dependencies BEFORE importing main ---
# This prevents import-time errors from missing services / bad .env

# Mock the config module so Pydantic Settings doesn't read .env
mock_settings = MagicMock()
mock_settings.REDIS_HOST = "localhost"
mock_settings.REDIS_PORT = 6379
mock_settings.REDIS_PASSWORD = ""
mock_settings.WORKER_PORT = 8000
mock_settings.QDRANT_HOST = "localhost"
mock_settings.QDRANT_PORT = 6333
mock_settings.QDRANT_COLLECTION = "test_collection"
mock_settings.GEMINI_API_KEY = ""
mock_settings.GEMINI_EMBEDDING_MODEL = "text-embedding-004"
mock_settings.CHUNK_SIZE = 512
mock_settings.CHUNK_OVERLAP = 50

# Create mock modules for all internal services
mock_modules = {
    "config": MagicMock(get_settings=MagicMock(return_value=mock_settings), settings=mock_settings),
    "rag.rag_router": MagicMock(router=MagicMock()),
    "rag.rag_service": MagicMock(),
    "events.pubsub_listener": MagicMock(),
    "services.sm2_cron": MagicMock(),
    "services.learning_analytics": MagicMock(),
    "services.pronunciation_scorer": MagicMock(),
    "services.content_recommender": MagicMock(),
    "services.scenario_generator": MagicMock(),
    "services.conversation_evaluator": MagicMock(),
    "services.realtime_grammar_coach": MagicMock(),
    "database": MagicMock(),
}

for mod_name, mock_mod in mock_modules.items():
    sys.modules[mod_name] = mock_mod


@asynccontextmanager
async def mock_lifespan(app):
    """No-op lifespan that skips Redis/Qdrant connections."""
    yield


# Now patch lifespan and import main
with patch.dict(os.environ, {"SENTRY_DSN": ""}, clear=False):
    import main as main_module
    main_module.lifespan = mock_lifespan
    # Re-create the app with the mocked lifespan
    from fastapi import FastAPI
    test_app = FastAPI(lifespan=mock_lifespan)

    # Copy routes from the real app
    for route in main_module.app.routes:
        test_app.routes.append(route)


@pytest.mark.asyncio
async def test_health_endpoint():
    """Health endpoint should return status=healthy."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "zenc-ai-worker"
    assert data["version"] == "3.0.0"


@pytest.mark.asyncio
async def test_root_endpoint():
    """Root endpoint should return service info and module list."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")

    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "ZenC AI Worker (Deep Brain v3.0)"
    assert "RAG Pipeline" in data["modules"]
    assert "Real-Time Grammar Coach (v3.0)" in data["modules"]
