"""
ZenC AI Worker – Redis Pub/Sub Event Listener.

Subscribes to Redis Pub/Sub channels and triggers corresponding
services:
- session_ended → grammar analysis
- pronunciation_assess → pronunciation scoring (durable queue)
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
- Durable session and conversation events are consumed from Redis lists
  so they survive worker restarts and can be replayed after crashes.
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
        self._durable_tasks: list[asyncio.Task] = []
        self._redis: aioredis.Redis | None = None
        self._running = False

    async def start(self) -> None:
        """
        Start the background Pub/Sub listener.

        Creates an async Redis connection and spawns both the realtime
        Pub/Sub listener and durable queue consumers.
        """
        try:
            self._redis = aioredis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                decode_responses=True,
            )
            await self._restore_processing_queue("session_ended")
            await self._restore_processing_queue("conversation_evaluate")
            await self._restore_processing_queue("pronunciation_assess")
            self._running = True
            self._task = asyncio.create_task(self._listen())
            self._durable_tasks = [
                asyncio.create_task(
                    self._listen_durable_queue(
                        "session_ended",
                        self._handle_session_ended,
                    )
                ),
                asyncio.create_task(
                    self._listen_durable_queue(
                        "conversation_evaluate",
                        self._handle_conversation_evaluate,
                    )
                ),
                asyncio.create_task(
                    self._listen_durable_queue(
                        "pronunciation_assess",
                        self._handle_pronunciation,
                    )
                ),
                asyncio.create_task(
                    self._listen_durable_queue(
                        "deep_brain_tasks",
                        self._handle_deep_brain,
                    )
                ),
            ]
            logger.info(
                "Pub/Sub listener started on channels: grammar_realtime, deep_brain_tasks"
            )
        except Exception as e:
            logger.error(f"Failed to start Pub/Sub listener: {e}")
            raise

    async def _listen(self) -> None:
        """
        Main listener loop – subscribes to Redis and processes events.

        Channels:
        - grammar_realtime: Triggers low-latency corrections

        Runs indefinitely until stop() is called. Each message is
        processed independently with full error isolation.
        """
        if not self._redis:
            return

        pubsub = self._redis.pubsub()
        await pubsub.subscribe(
            "grammar_realtime",
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
                        if channel == "grammar_realtime":
                            await self._handle_grammar_realtime(message["data"])
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
                "grammar_realtime",
            )
            await pubsub.close()

    async def _listen_durable_queue(self, event_name: str, handler) -> None:
        """
        Consume durable events using BRPOPLPUSH so unfinished work can be
        retried after worker restarts.
        """
        if not self._redis:
            return

        queue_key = self._queue_key(event_name)
        processing_key = self._processing_key(event_name)
        dead_letter_key = self._dead_letter_key(event_name)

        try:
            while self._running:
                raw_data = await self._redis.brpoplpush(
                    queue_key,
                    processing_key,
                    timeout=1,
                )
                if not raw_data:
                    continue

                try:
                    await handler(raw_data)
                    await self._redis.lrem(processing_key, 1, raw_data)
                except Exception as e:
                    logger.error(
                        f"Error processing durable {event_name} event: {e}",
                        exc_info=True,
                    )
                    await self._redis.lrem(processing_key, 1, raw_data)
                    await self._redis.lpush(dead_letter_key, raw_data)
        except asyncio.CancelledError:
            logger.info("Durable listener cancelled for %s", event_name)

    async def _restore_processing_queue(self, event_name: str) -> None:
        """
        Move in-flight items back to the main queue after an unclean
        shutdown so they can be retried on startup.
        """
        if not self._redis:
            return

        processing_key = self._processing_key(event_name)
        queue_key = self._queue_key(event_name)
        restored = 0

        while True:
            raw_data = await self._redis.rpoplpush(processing_key, queue_key)
            if raw_data is None:
                break
            restored += 1

        if restored > 0:
            logger.warning(
                "Restored %s in-flight durable %s events after restart",
                restored,
                event_name,
            )

    def _queue_key(self, event_name: str) -> str:
        return f"durable_queue:{event_name}"

    def _processing_key(self, event_name: str) -> str:
        return f"durable_processing:{event_name}"

    def _dead_letter_key(self, event_name: str) -> str:
        return f"durable_deadletter:{event_name}"

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
        1. Parse the JSON payload (assessmentId, audioUrl, referenceText)
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
        audio_url = payload.get("audioUrl", "")
        reference_text = payload.get("referenceText", "")
        user_id = payload.get("userId")

        if not assessment_id or not audio_url or not user_id:
            logger.warning("Incomplete pronunciation payload")
            return

        from services.pronunciation_scorer import (
            assess_pronunciation,
            update_problem_sounds,
        )

        result = await assess_pronunciation(audio_url, reference_text, user_id)

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

    async def _handle_deep_brain(self, raw_data: str) -> None:
        """
        Process a deep_brain_tasks event from the Gateway.
        """
        logger.info("Received deep_brain_tasks event")
        try:
            payload = json.loads(raw_data)

            # Check for specific task type (like summarization)
            if payload.get("pattern") == "summarize_long_term_memory" or payload.get("taskType") == "summarize_long_term_memory":
                user_id = payload.get("userId")
                session_id = payload.get("sessionId")
                if user_id and session_id:
                    # Execute Background Summarization
                    await self._summarize_conversation(user_id, session_id)
                return

            # Note: gateway sometimes sends `pattern` wrapped, but original payload is just stringified.
            # Handle standard grammar explanation task
            session_id = payload.get("sessionId")
            question = payload.get("question")
            original_text = payload.get("originalText", "")

            if not session_id or not question:
                logger.warning("Incomplete deep_brain payload")
                return

            from events.grammar_analyzer import analyze_grammar
            from events.tts_streamer import synthesize_speech
            import base64

            # 1. Generate Explanation
            explanation_text = await analyze_grammar(original_text, question)
            
            # 2. Convert to Speech
            audio_bytes = await synthesize_speech(explanation_text)

            if audio_bytes and self._redis:
                # 3. Stream back
                b64_audio = base64.b64encode(audio_bytes).decode('utf-8')
                message = f"{session_id}:{b64_audio}"
                await self._redis.publish("tts_audio_stream", message)
                logger.info(f"Published TTS audio for session {session_id}")
            else:
                logger.warning(f"Failed to generate TTS audio for session {session_id}")

        except Exception as e:
            logger.error(f"Error processing deep_brain_task: {e}", exc_info=True)

    async def _summarize_conversation(self, user_id: str, session_id: str) -> None:
        """
        Background job to summarize the conversation transcript up to this point
        and update the long-term memory (user persona) to prevent context window overflow.
        """
        if not self._redis:
            return

        try:
            # 1. Fetch transcript from Redis
            transcript_raw = await self._redis.lrange(f"transcript:{session_id}", 0, -1)
            if not transcript_raw or len(transcript_raw) == 0:
                return

            # Parse entries
            entries = []
            for item in transcript_raw:
                try:
                    entries.append(json.loads(item))
                except:
                    pass

            if len(entries) < 15:
                return # Only summarize if it's getting long

            # 2. Reconstruct chat string
            chat_text = "\n".join([f"{e.get('role', 'unknown').capitalize()}: {e.get('text', '')}" for e in entries])

            # 3. Fetch existing summary
            existing_summary = await self._redis.get(f"user_persona:{user_id}")
            existing_summary_text = existing_summary if existing_summary else "No previous context."

            # 4. Generate Core Facts via LLM (Gemini 1.5 Flash)
            import google.generativeai as genai
            from config import settings
            from ai_timeout import await_with_timeout
            from utils.json_parser import extract_and_parse_json

            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = f"""You are an AI tasked with maintaining a concise long-term memory summary of an English learning student.

Previous Summary:
{existing_summary_text}

New Conversation Segment:
{chat_text}

Task: Extract the core facts about this student. Focus ONLY on:
1. The student's name, interests, and current context
2. Key English mistakes they made
3. Their overall tone and confidence
4. Any specific goal they mentioned

Format the output strictly as a JSON object with the keys "core_facts" (list of strings) and "summary" (a short paragraph under 100 words).
Do NOT include any conversational preamble. Only output valid JSON."""

            response = await await_with_timeout(
                model.generate_content_async(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        temperature=0.1,
                        max_output_tokens=300,
                        response_mime_type="application/json"
                    )
                ),
                "Background Summarization"
            )

            result = extract_and_parse_json(response.text)
            new_summary = result.get("summary", "").strip()
            core_facts = result.get("core_facts", [])

            # Phase 3: The ChatGPT Killer - Store Core Facts into Qdrant Vector DB for long-term memory
            if core_facts and settings.QDRANT_URL and settings.QDRANT_API_KEY:
                from rag.rag_service import QdrantService
                try:
                    qdrant = QdrantService()
                    # In a real production system, you would embed each fact and store it
                    # Here we simulate storing it by logging, or integrating directly if the method exists
                    # await qdrant.store_user_facts(user_id, core_facts)
                    logger.info(f"Extracted {len(core_facts)} core facts for user {user_id} to be stored in Qdrant.")
                except Exception as ex:
                    logger.error(f"Failed to store facts in Qdrant: {ex}")

            # Fallback to store core facts into Redis List for the Gateway to fetch instantly
            if core_facts:
                try:
                    # Push each fact into a Redis list (keeping top 10)
                    fact_key = f"user_core_facts:{user_id}"
                    for fact in core_facts:
                        await self._redis.lpush(fact_key, str(fact))
                    await self._redis.ltrim(fact_key, 0, 9) # Keep 10 most recent facts
                    await self._redis.expire(fact_key, 604800) # 7 days
                except Exception as r_err:
                    logger.error(f"Failed to save core facts to Redis: {r_err}")

            # 5. Save the rolling summary back to Redis for immediate context
            if new_summary:
                await self._redis.set(f"user_persona:{user_id}", new_summary, ex=604800) # 7 days
                logger.info(f"Successfully updated user persona for {user_id}. Length: {len(entries)} turns.")

        except Exception as e:
            logger.error(f"Failed to summarize conversation for user {user_id}: {e}")

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

        for task in self._durable_tasks:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        self._durable_tasks = []

        if self._redis:
            await self._redis.close()

        logger.info("Pub/Sub listener stopped")


# Singleton instance
pubsub_listener = PubSubListener()
