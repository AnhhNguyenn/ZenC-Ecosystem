"""
ZenC AI Worker – Redis Pub/Sub Event Listener.

Subscribes to Redis Pub/Sub channels and triggers corresponding
services:
- session_ended → grammar analysis
- pronunciation_assess → pronunciation scoring
- grammar_realtime → real-time grammar correction (< 200ms)
- conversation_evaluate → post-session conversation scoring
Architecture:
- Runs as a background asyncio task started during FastAPI lifespan.
- On receiving a session_ended event:
  1. Parse the session payload (JSON)
  2. Analyze transcript via grammar_analyzer
  3. Persist mistakes to UserMistakes table via SQLAlchemy
  4. Schedule initial SM-2 review datetime for each mistake
- Never blocks the main FastAPI event loop (runs in a dedicated task).

Design decisions:
- Using async redis (redis.asyncio) for non-blocking Pub/Sub subscription.
- Each message is processed in a try/catch to ensure a single malformed
  event doesn't crash the listener.
- SM-2 initial interval is 1 day, easiness factor 2.5 (standard defaults).
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta

import redis.asyncio as aioredis
from sqlalchemy.orm import Session as DBSession

from config import settings
from database import SessionLocal
from models import UserMistake
from events.grammar_analyzer import analyze_grammar

logger = logging.getLogger(__name__)


class PubSubListener:
    """
    Background listener for Redis Pub/Sub events.

    Lifecycle:
    - start() spawns an asyncio task that subscribes to channels
    - stop() cancels the task and closes the Redis connection
    """

    def __init__(self) -> None:
        """
        Initialize the Pub/Sub listener.

        The Redis connection is created lazily on start() to avoid
        connecting before the event loop is running.
        """
        self._task: asyncio.Task | None = None
        self._redis: aioredis.Redis | None = None
        self._running = False

    async def start(self) -> None:
        """
        Start the background Pub/Sub listener.

        Creates an async Redis connection and spawns a task that
        subscribes to the `session_ended` channel.
        """
        try:
            self._redis = aioredis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                decode_responses=True,
            )
            self._running = True
            self._task = asyncio.create_task(self._listen())
            logger.info("Pub/Sub listener started on channel: session_ended")
        except Exception as e:
            logger.error(f"Failed to start Pub/Sub listener: {e}")
            raise

    async def _listen(self) -> None:
        """
        Main listener loop – subscribes to Redis and processes events.

        Channels:
        - session_ended: Triggers grammar analysis
        - pronunciation_assess: Triggers pronunciation scoring

        Runs indefinitely until stop() is called. Each message is
        processed independently with full error isolation.
        """
        if not self._redis:
            return

        pubsub = self._redis.pubsub()
        await pubsub.subscribe(
            "session_ended",
            "pronunciation_assess",
            "grammar_realtime",
            "conversation_evaluate",
        )

        try:
            while self._running:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )

                if message and message["type"] == "message":
                    channel = message.get("channel", "")
                    try:
                        if channel == "session_ended":
                            await self._handle_session_ended(message["data"])
                        elif channel == "pronunciation_assess":
                            await self._handle_pronunciation(message["data"])
                        elif channel == "grammar_realtime":
                            await self._handle_grammar_realtime(message["data"])
                        elif channel == "conversation_evaluate":
                            await self._handle_conversation_evaluate(message["data"])
                    except Exception as e:
                        logger.error(
                            f"Error processing {channel} event: {e}",
                            exc_info=True,
                        )

                await asyncio.sleep(0.1)

        except asyncio.CancelledError:
            logger.info("Pub/Sub listener cancelled")
        finally:
            await pubsub.unsubscribe(
                "session_ended",
                "pronunciation_assess",
                "grammar_realtime",
                "conversation_evaluate",
            )
            await pubsub.close()

    async def _handle_session_ended(self, raw_data: str) -> None:
        """
        Process a session_ended event.

        Flow:
        1. Parse the JSON payload
        2. Analyze transcript for grammar mistakes
        3. Persist mistakes to DB with SM-2 scheduling
        4. Log results for monitoring

        Args:
            raw_data: JSON string from Redis containing session details
        """
        logger.info("Received session_ended event")

        # ── Step 1: Parse payload ──────────────────────────────────
        try:
            payload = json.loads(raw_data)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid session_ended payload: {e}")
            return

        user_id = payload.get("userId")
        transcript = payload.get("transcript", "")
        session_id = payload.get("sessionId", "unknown")

        if not user_id or not transcript:
            logger.warning(f"Incomplete session_ended payload for session {session_id}")
            return

        logger.info(
            f"Processing session {session_id} for user {user_id} "
            f"(transcript length: {len(transcript)} chars)"
        )

        # ── Step 2: Analyze grammar ───────────────────────────────
        mistakes = await analyze_grammar(transcript)

        if not mistakes:
            logger.info(f"No grammar mistakes found for session {session_id}")
            return

        # ── Step 3: Persist mistakes with SM-2 scheduling ─────────
        db: DBSession = SessionLocal()
        try:
            for mistake in mistakes:
                db_mistake = UserMistake(
                    id=str(uuid.uuid4()),
                    userId=user_id,
                    originalSentence=mistake["originalSentence"][:1000],
                    correctedSentence=mistake["correctedSentence"][:1000],
                    grammarRuleId=mistake.get("grammarRuleId", "OTH-001"),
                    nextReviewAt=datetime.utcnow() + timedelta(days=1),
                    intervalDays=1,
                    easinessFactor=2.5,
                    repetitionCount=0,
                )
                db.add(db_mistake)

            db.commit()

            logger.info(
                f"Persisted {len(mistakes)} mistakes for user {user_id} "
                f"from session {session_id}"
            )

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist mistakes: {e}", exc_info=True)
            raise
        finally:
            db.close()

    async def _handle_pronunciation(self, raw_data: str) -> None:
        """
        Process a pronunciation_assess event from the Gateway.

        Flow:
        1. Parse the JSON payload (assessmentId, audioBase64, referenceText)
        2. Run pronunciation scoring via Gemini
        3. Update problem sounds profile
        4. Store result in Redis for Gateway polling
        """
        logger.info("Received pronunciation_assess event")

        try:
            payload = json.loads(raw_data)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid pronunciation payload: {e}")
            return

        assessment_id = payload.get("assessmentId")
        audio_base64 = payload.get("audioBase64", "")
        reference_text = payload.get("referenceText", "")
        user_id = payload.get("userId")

        if not assessment_id or not audio_base64 or not user_id:
            logger.warning("Incomplete pronunciation payload")
            return

        from services.pronunciation_scorer import (
            assess_pronunciation,
            update_problem_sounds,
        )

        result = await assess_pronunciation(audio_base64, reference_text, user_id)

        # Store result in Redis for Gateway polling
        if self._redis:
            await self._redis.set(
                f"pronunciation:{assessment_id}",
                json.dumps(result),
                ex=300,
            )

            # Update problem sounds profile
            if result.get("status") == "COMPLETED":
                await update_problem_sounds(self._redis, user_id, result)

        logger.info(
            f"Pronunciation assessment {assessment_id}: "
            f"status={result.get('status')}"
        )

    async def _handle_grammar_realtime(self, raw_data: str) -> None:
        """
        Process a grammar_realtime event for ultra-fast correction.
        Delegates to realtime_grammar_coach service.
        """
        from services.realtime_grammar_coach import handle_grammar_realtime
        await handle_grammar_realtime(raw_data, self._redis)

    async def _handle_conversation_evaluate(self, raw_data: str) -> None:
        """
        Process a conversation_evaluate event for post-session scoring.
        Delegates to conversation_evaluator service.
        """
        from services.conversation_evaluator import handle_conversation_evaluate
        await handle_conversation_evaluate(raw_data, self._redis)

    async def stop(self) -> None:
        """
        Gracefully stop the Pub/Sub listener.

        Cancels the background task and closes the Redis connection.
        """
        self._running = False

        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        if self._redis:
            await self._redis.close()

        logger.info("Pub/Sub listener stopped")


# Singleton instance
pubsub_listener = PubSubListener()
