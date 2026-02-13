"""
ZenC AI Worker – FastAPI Application Entry Point (Deep Brain v3.0).

The AI Worker is the asynchronous analytical engine of the ZenC platform.
It handles:
1. Grammar analysis triggered by Redis Pub/Sub events from the Gateway
2. RAG pipeline for curriculum document management
3. Pronunciation assessment via Redis Pub/Sub
4. SM-2 spaced repetition daily cron jobs
5. Weekly learning analytics generation
6. AI-powered content recommendations
7. Conversation scenario generation
8. Post-conversation evaluation & scoring (v3.0)
9. Real-time grammar coaching < 200ms (v3.0)

Architecture:
- Lifespan context manager starts/stops background services (Pub/Sub listener,
  Qdrant collection init, APScheduler for cron).
- The Worker NEVER blocks Gateway requests – all communication is async
  via Redis Pub/Sub.
- New services are integrated as background tasks or REST endpoints.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import redis.asyncio as aioredis

from config import get_settings
from rag.rag_router import router as rag_router
from events.pubsub_listener import pubsub_listener
from rag.rag_service import rag_service
from services.sm2_cron import (
    run_daily_review_cron,
    run_streak_warning_cron,
    run_weekly_reset_cron,
    run_vocab_review_cron,
)
from services.learning_analytics import generate_all_weekly_reports
from services.pronunciation_scorer import assess_pronunciation, update_problem_sounds
from services.content_recommender import cache_recommendations
from services.scenario_generator import generate_scenario
from services.conversation_evaluator import evaluate_conversation
from services.realtime_grammar_coach import (
    check_grammar_realtime,
    get_user_grammar_patterns,
)

# ── Logging Configuration ────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-25s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("zenc.worker")

settings = get_settings()
scheduler = AsyncIOScheduler()

# ── Redis Client (async) ────────────────────────────────────────
redis_client: aioredis.Redis | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager – handles startup and shutdown.

    Startup: Qdrant init → Pub/Sub listener → Pronunciation listener → Cron scheduler
    Shutdown: Scheduler → Pub/Sub → Redis → connections
    """
    global redis_client

    logger.info("🧠 ZenC AI Worker v3.0 starting up...")

    # 1. Redis connection
    try:
        redis_client = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None,
            decode_responses=True,
        )
        logger.info("✅ Redis connected")
    except Exception as e:
        logger.error(f"⚠️  Redis connection failed: {e}")

    # 2. Qdrant
    try:
        await rag_service.initialize()
        logger.info("✅ Qdrant collection initialized")
    except Exception as e:
        logger.error(f"⚠️  Qdrant initialization failed (non-fatal): {e}")

    # 3. Pub/Sub listener (grammar + pronunciation)
    try:
        await pubsub_listener.start()
        logger.info("✅ Redis Pub/Sub listener started")
    except Exception as e:
        logger.error(f"⚠️  Pub/Sub listener failed to start (non-fatal): {e}")

    # 4. APScheduler cron jobs
    try:
        # Daily at 6:00 AM UTC+7 (midnight-ish for Vietnamese users)
        scheduler.add_job(
            run_daily_review_cron,
            "cron",
            hour=23, minute=0,  # 23:00 UTC = 06:00 UTC+7
            args=[redis_client],
            id="daily_review",
            name="SM-2 Daily Review Population",
        )

        # Daily at 20:00 UTC+7 (evening streak warning)
        scheduler.add_job(
            run_streak_warning_cron,
            "cron",
            hour=13, minute=0,  # 13:00 UTC = 20:00 UTC+7
            args=[redis_client],
            id="streak_warning",
            name="Streak Warning Notifications",
        )

        # Sunday midnight UTC – weekly jobs
        scheduler.add_job(
            run_weekly_reset_cron,
            "cron",
            day_of_week="sun",
            hour=17, minute=0,  # 17:00 UTC Sunday = 00:00 UTC+7 Monday
            args=[redis_client],
            id="weekly_reset",
            name="Weekly Leaderboard Reset & Freeze Replenish",
        )

        # Sunday 01:00 UTC – weekly analytics
        scheduler.add_job(
            generate_all_weekly_reports,
            "cron",
            day_of_week="sun",
            hour=18, minute=0,  # 18:00 UTC Sunday = 01:00 UTC+7 Monday
            args=[redis_client],
            id="weekly_analytics",
            name="Weekly Learning Analytics Report",
        )

        # Daily vocab review notifications
        scheduler.add_job(
            run_vocab_review_cron,
            "cron",
            hour=0, minute=0,  # 00:00 UTC = 07:00 UTC+7
            args=[redis_client],
            id="vocab_review_notif",
            name="Vocabulary Review Notifications",
        )

        scheduler.start()
        logger.info(f"✅ APScheduler started with {len(scheduler.get_jobs())} cron jobs")
    except Exception as e:
        logger.error(f"⚠️  Scheduler failed to start (non-fatal): {e}")

    logger.info(f"🚀 ZenC AI Worker v3.0 ready on port {settings.WORKER_PORT}")

    yield

    # ── Shutdown ───────────────────────────────────────────────────
    logger.info("🛑 ZenC AI Worker shutting down...")

    try:
        scheduler.shutdown()
        logger.info("✅ Scheduler stopped")
    except Exception:
        pass

    try:
        await pubsub_listener.stop()
        logger.info("✅ Pub/Sub listener stopped")
    except Exception as e:
        logger.error(f"Error stopping Pub/Sub listener: {e}")

    if redis_client:
        await redis_client.close()
        logger.info("✅ Redis connection closed")

    logger.info("👋 ZenC AI Worker v3.0 shutdown complete")


# ── FastAPI Application ──────────────────────────────────────────
app = FastAPI(
    title="ZenC AI Worker",
    description=(
        "Deep Brain v3.0 – Grammar analysis, RAG pipeline, pronunciation scoring, "
        "SM-2 cron, learning analytics, content recommendations, scenario generation, "
        "conversation evaluation, real-time grammar coaching"
    ),
    version="3.0.0",
    lifespan=lifespan,
)

# ── CORS Middleware ──────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Route Registration ───────────────────────────────────────────
app.include_router(rag_router, prefix="/api/v1")


# ── Health Check ─────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check() -> dict:
    cron_jobs = len(scheduler.get_jobs()) if scheduler.running else 0
    return {
        "status": "healthy",
        "service": "zenc-ai-worker",
        "version": "3.0.0",
        "cronJobs": cron_jobs,
        "redisConnected": redis_client is not None,
    }


# ── Pronunciation Assessment Endpoint ─────────────────────────────
@app.post("/api/v1/pronunciation/assess", tags=["Pronunciation"])
async def pronunciation_assess(payload: dict) -> dict:
    """
    Direct pronunciation assessment endpoint (alternative to Pub/Sub).
    Accepts: { audioBase64, referenceText, userId, exerciseId? }
    """
    result = await assess_pronunciation(
        audio_base64=payload["audioBase64"],
        reference_text=payload["referenceText"],
        user_id=payload["userId"],
    )

    # Update problem sounds profile
    if redis_client and result.get("status") == "COMPLETED":
        await update_problem_sounds(redis_client, payload["userId"], result)

    return result


# ── Content Recommendation Endpoint ───────────────────────────────
@app.get("/api/v1/recommendations/{user_id}", tags=["Recommendations"])
async def get_recommendations(user_id: str) -> dict:
    """Get personalized content recommendations for a user."""
    if redis_client:
        # Check cache first
        cached = await redis_client.get(f"recommendations:{user_id}")
        if cached:
            import json
            return {"recommendations": json.loads(cached), "cached": True}

        recs = await cache_recommendations(redis_client, user_id)
        return {"recommendations": recs, "cached": False}

    return {"recommendations": [], "error": "Redis not available"}


# ── Scenario Generation Endpoint ──────────────────────────────────
@app.post("/api/v1/scenarios/generate", tags=["Scenarios"])
async def generate_scenario_endpoint(payload: dict) -> dict:
    """
    Generate a conversation practice scenario.
    Accepts: { level?, category?, previousTopics? }
    """
    scenario = await generate_scenario(
        level=payload.get("level", "A2"),
        category=payload.get("category", "DAILY_LIFE"),
        previous_topics=payload.get("previousTopics"),
    )
    return scenario


# ── Analytics Endpoint ────────────────────────────────────────────
@app.get("/api/v1/analytics/{user_id}/weekly", tags=["Analytics"])
async def get_weekly_report(user_id: str) -> dict:
    """Get cached weekly analytics report for a user."""
    if redis_client:
        import json
        cached = await redis_client.get(f"weekly_report:{user_id}")
        if cached:
            return json.loads(cached)

    return {"error": "No report available. Reports are generated weekly."}


@app.get("/", tags=["System"])
async def root() -> dict:
    return {
        "service": "ZenC AI Worker (Deep Brain v3.0)",
        "version": "3.0.0",
        "docs": "/docs",
        "modules": [
            "RAG Pipeline",
            "Grammar Analysis",
            "Pronunciation Scoring",
            "SM-2 Cron",
            "Learning Analytics",
            "Content Recommender",
            "Scenario Generator",
            "Conversation Evaluator (v3.0)",
            "Real-Time Grammar Coach (v3.0)",
        ],
    }


# ── Conversation Evaluation Endpoint ──────────────────────────────
@app.post("/api/v1/conversation/evaluate", tags=["Conversation"])
async def conversation_evaluate_endpoint(payload: dict) -> dict:
    """
    Direct conversation evaluation endpoint (alternative to Pub/Sub).
    Accepts: { transcript, mode, durationMinutes, userId }
    """
    result = await evaluate_conversation(
        transcript=payload["transcript"],
        mode=payload.get("mode", "FREE_TALK"),
        duration_minutes=payload.get("durationMinutes", 0),
        user_id=payload["userId"],
    )
    return result


# ── Real-Time Grammar Check Endpoint ──────────────────────────────
@app.post("/api/v1/grammar/check", tags=["Grammar"])
async def grammar_check_endpoint(payload: dict) -> dict:
    """
    Direct real-time grammar check (alternative to Pub/Sub).
    Accepts: { text, userId }
    """
    result = await check_grammar_realtime(
        text=payload["text"],
        user_id=payload.get("userId", ""),
    )
    return result


# ── Grammar Patterns Endpoint ─────────────────────────────────────
@app.get("/api/v1/grammar/patterns/{user_id}", tags=["Grammar"])
async def grammar_patterns_endpoint(user_id: str) -> dict:
    """Get a user's grammar error pattern frequencies."""
    if redis_client:
        patterns = await get_user_grammar_patterns(user_id, redis_client)
        return {"patterns": patterns}
    return {"patterns": {}, "error": "Redis not available"}
