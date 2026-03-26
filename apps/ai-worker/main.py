"""
ZenC AI Worker FastAPI entrypoint.
"""

import json
import logging
import os
import uuid
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

import redis.asyncio as aioredis
import sentry_sdk
from apscheduler.events import EVENT_JOB_ERROR, JobExecutionEvent
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, HTTPException, Response, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from config import get_settings
from events.pubsub_listener import pubsub_listener
from rag.rag_router import router as rag_router
from rag.rag_service import rag_service
from services.content_recommender import cache_recommendations
from services.conversation_evaluator import evaluate_conversation
from services.learning_analytics import generate_all_weekly_reports
from services.pronunciation_scorer import assess_pronunciation, update_problem_sounds
from services.realtime_grammar_coach import (
    check_grammar_realtime,
    get_user_grammar_patterns,
)
from services.scenario_generator import generate_scenario
from services.sm2_cron import (
    run_daily_review_cron,
    run_streak_warning_cron,
    run_vocab_review_cron,
    run_weekly_reset_cron,
)

sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.getenv("NODE_ENV", "development"),
        traces_sample_rate=0.2 if os.getenv("NODE_ENV") == "production" else 1.0,
        profiles_sample_rate=0.1,
    )
else:
    logging.getLogger("zenc.worker").warning(
        "[Sentry] SENTRY_DSN not set - error tracking disabled"
    )

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-25s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("zenc.worker")

settings = get_settings()
scheduler = AsyncIOScheduler()
redis_client: aioredis.Redis | None = None
component_status = {
    "redis": False,
    "qdrant": False,
    "pubsub": False,
    "scheduler": False,
}
internal_bearer_scheme = HTTPBearer(auto_error=True)
internal_service_key = os.getenv("ADMIN_SECRET_KEY", "")


class PronunciationAssessRequest(BaseModel):
    audioBase64: str = Field(min_length=1, max_length=8_000_000)
    referenceText: str = Field(min_length=1, max_length=5000)
    userId: str = Field(min_length=1, max_length=255)


class ScenarioGenerateRequest(BaseModel):
    level: str = Field(default="A2", min_length=2, max_length=2)
    category: str = Field(default="DAILY_LIFE", min_length=1, max_length=100)
    previousTopics: list[str] | None = None


class ConversationEvaluateRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=12000)
    mode: str = Field(default="FREE_TALK", min_length=1, max_length=100)
    durationMinutes: float = Field(default=0, ge=0, le=1440)
    userId: str = Field(min_length=1, max_length=255)


class GrammarCheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    userId: str = Field(default="", max_length=255)


def _capture_scheduler_error(event: JobExecutionEvent) -> None:
    if not event.exception:
        return

    logger.error(
        f"Scheduler job failed: job_id={event.job_id}",
        exc_info=(
            type(event.exception),
            event.exception,
            event.exception.__traceback__,
        ),
    )
    sentry_sdk.capture_exception(event.exception)


def require_internal_service(
    credentials: HTTPAuthorizationCredentials = Security(internal_bearer_scheme),
) -> None:
    if not internal_service_key or credentials.credentials != internal_service_key:
        raise HTTPException(status_code=403, detail="Internal service access required")


async def _run_singleton_job(
    job_id: str,
    job_func: Callable[..., Awaitable[Any]],
    *job_args,
    lock_ttl_seconds: int = 1800,
) -> Any:
    if redis_client is None:
        logger.warning("Running cron '%s' without Redis lock", job_id)
        return await job_func(*job_args)

    lock_key = f"cron_lock:{job_id}"
    token = str(uuid.uuid4())
    acquired = await redis_client.set(lock_key, token, ex=lock_ttl_seconds, nx=True)
    if not acquired:
        logger.info("Skipping cron '%s' because another worker holds the lock", job_id)
        return {"skipped": True}

    try:
        return await job_func(*job_args)
    finally:
        try:
            await redis_client.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                1,
                lock_key,
                token,
            )
        except Exception as exc:
            logger.warning("Failed to release cron lock for %s: %s", job_id, exc)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global redis_client

    logger.info("ZenC AI Worker starting up")

    component_status.update(
        {
            "redis": False,
            "qdrant": False,
            "pubsub": False,
            "scheduler": False,
        }
    )

    try:
        redis_client = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None,
            decode_responses=True,
        )
        await redis_client.ping()
        component_status["redis"] = True
        logger.info("Redis connected")
    except Exception as exc:
        redis_client = None
        logger.error("Redis connection failed: %s", exc)

    try:
        await rag_service.initialize()
        component_status["qdrant"] = True
        logger.info("Qdrant collection initialized")
    except Exception as exc:
        logger.error("Qdrant initialization failed: %s", exc)

    try:
        await pubsub_listener.start()
        component_status["pubsub"] = True
        logger.info("Redis Pub/Sub listener started")
    except Exception as exc:
        logger.error("Pub/Sub listener failed to start: %s", exc)

    try:
        scheduler.add_job(
            _run_singleton_job,
            "cron",
            hour=23,
            minute=0,
            args=["daily_review", run_daily_review_cron, redis_client],
            kwargs={"lock_ttl_seconds": 1800},
            id="daily_review",
            name="SM-2 Daily Review Population",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        scheduler.add_job(
            _run_singleton_job,
            "cron",
            hour=13,
            minute=0,
            args=["streak_warning", run_streak_warning_cron, redis_client],
            kwargs={"lock_ttl_seconds": 1800},
            id="streak_warning",
            name="Streak Warning Notifications",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )
        scheduler.add_job(
            _run_singleton_job,
            "cron",
            day_of_week="sun",
            hour=17,
            minute=0,
            args=["weekly_reset", run_weekly_reset_cron, redis_client],
            kwargs={"lock_ttl_seconds": 3600},
            id="weekly_reset",
            name="Weekly Leaderboard Reset and Freeze Replenish",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=600,
        )
        scheduler.add_job(
            _run_singleton_job,
            "cron",
            day_of_week="sun",
            hour=18,
            minute=0,
            args=["weekly_analytics", generate_all_weekly_reports, redis_client],
            kwargs={"lock_ttl_seconds": 7200},
            id="weekly_analytics",
            name="Weekly Learning Analytics Report",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=600,
        )
        scheduler.add_job(
            _run_singleton_job,
            "cron",
            hour=0,
            minute=0,
            args=["vocab_review_notif", run_vocab_review_cron, redis_client],
            kwargs={"lock_ttl_seconds": 1800},
            id="vocab_review_notif",
            name="Vocabulary Review Notifications",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )

        scheduler.add_listener(_capture_scheduler_error, EVENT_JOB_ERROR)
        scheduler.start()
        component_status["scheduler"] = True
        logger.info("APScheduler started with %s cron jobs", len(scheduler.get_jobs()))
    except Exception as exc:
        logger.error("Scheduler failed to start: %s", exc)

    logger.info("ZenC AI Worker ready on port %s", settings.WORKER_PORT)

    yield

    logger.info("ZenC AI Worker shutting down")

    try:
        scheduler.shutdown()
        component_status["scheduler"] = False
        logger.info("Scheduler stopped")
    except Exception:
        pass

    try:
        await pubsub_listener.stop()
        component_status["pubsub"] = False
        logger.info("Pub/Sub listener stopped")
    except Exception as exc:
        logger.error("Error stopping Pub/Sub listener: %s", exc)

    if redis_client:
        await redis_client.close()
        component_status["redis"] = False
        logger.info("Redis connection closed")

    logger.info("ZenC AI Worker shutdown complete")


app = FastAPI(
    title="ZenC AI Worker",
    description=(
        "Deep Brain v3.0 - Grammar analysis, RAG pipeline, pronunciation scoring, "
        "SM-2 cron, learning analytics, content recommendations, scenario generation, "
        "conversation evaluation, real-time grammar coaching"
    ),
    version="3.0.0",
    lifespan=lifespan,
)

_raw_origins = os.getenv(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3001,http://localhost:3002"
)
allowed_origins = [origin.strip() for origin in _raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(rag_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health_check(response: Response) -> dict:
    cron_jobs = len(scheduler.get_jobs()) if scheduler.running else 0
    ready = (
        component_status["redis"]
        and component_status["qdrant"]
        and component_status["pubsub"]
    )
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if ready else "unhealthy",
        "service": "zenc-ai-worker",
        "version": "3.0.0",
        "cronJobs": cron_jobs,
        "redisConnected": component_status["redis"],
        "components": component_status.copy(),
    }


@app.post(
    "/api/v1/pronunciation/assess",
    tags=["Pronunciation"],
    dependencies=[Depends(require_internal_service)],
)
async def pronunciation_assess(payload: PronunciationAssessRequest) -> dict:
    result = await assess_pronunciation(
        audio_base64=payload.audioBase64,
        reference_text=payload.referenceText,
        user_id=payload.userId,
    )

    if redis_client and result.get("status") == "COMPLETED":
        await update_problem_sounds(redis_client, payload.userId, result)

    return result


@app.get(
    "/api/v1/recommendations/{user_id}",
    tags=["Recommendations"],
    dependencies=[Depends(require_internal_service)],
)
async def get_recommendations(user_id: str) -> dict:
    if redis_client:
        cached = await redis_client.get(f"recommendations:{user_id}")
        if cached:
            return {"recommendations": json.loads(cached), "cached": True}

        recommendations = await cache_recommendations(redis_client, user_id)
        return {"recommendations": recommendations, "cached": False}

    return {"recommendations": [], "error": "Redis not available"}


@app.post(
    "/api/v1/scenarios/generate",
    tags=["Scenarios"],
    dependencies=[Depends(require_internal_service)],
)
async def generate_scenario_endpoint(payload: ScenarioGenerateRequest) -> dict:
    return await generate_scenario(
        level=payload.level,
        category=payload.category,
        previous_topics=payload.previousTopics,
    )


@app.get(
    "/api/v1/analytics/{user_id}/weekly",
    tags=["Analytics"],
    dependencies=[Depends(require_internal_service)],
)
async def get_weekly_report(user_id: str) -> dict:
    if redis_client:
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


@app.post(
    "/api/v1/conversation/evaluate",
    tags=["Conversation"],
    dependencies=[Depends(require_internal_service)],
)
async def conversation_evaluate_endpoint(payload: ConversationEvaluateRequest) -> dict:
    return await evaluate_conversation(
        transcript=payload.transcript,
        mode=payload.mode,
        duration_minutes=payload.durationMinutes,
        user_id=payload.userId,
    )


@app.post(
    "/api/v1/grammar/check",
    tags=["Grammar"],
    dependencies=[Depends(require_internal_service)],
)
async def grammar_check_endpoint(payload: GrammarCheckRequest) -> dict:
    return await check_grammar_realtime(
        text=payload.text,
        user_id=payload.userId,
    )


@app.get(
    "/api/v1/grammar/patterns/{user_id}",
    tags=["Grammar"],
    dependencies=[Depends(require_internal_service)],
)
async def grammar_patterns_endpoint(user_id: str) -> dict:
    if redis_client:
        patterns = await get_user_grammar_patterns(user_id, redis_client)
        return {"patterns": patterns}
    return {"patterns": {}, "error": "Redis not available"}
