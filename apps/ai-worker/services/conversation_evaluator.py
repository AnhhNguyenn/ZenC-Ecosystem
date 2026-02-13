"""
ZenC AI Worker – Conversation Evaluator Service.

Post-conversation AI scoring using Gemini. Evaluates user performance
across 4 dimensions: fluency, accuracy, complexity, and coherence.

Architecture:
- Subscribes to 'conversation_evaluate' Redis Pub/Sub channel
- Receives full transcript + mode + duration from Gateway
- Sends transcript to Gemini for structured evaluation
- Stores results in Redis for Gateway polling, then persists to DB

Vietnamese-specific:
- Detects L1 interference patterns (e.g., missing articles, tense errors)
- Provides feedback in Vietnamese for low-confidence users
- Tracks Vietnamese-specific error trends
"""

import json
import logging
from datetime import datetime

import google.generativeai as genai
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import async_session_factory

logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)
_model = genai.GenerativeModel("gemini-2.5-flash")


async def evaluate_conversation(
    transcript: str,
    mode: str,
    duration_minutes: float,
    user_id: str,
) -> dict:
    """
    Evaluate a conversation transcript using Gemini AI.

    Returns structured scores and feedback:
    - fluency (0-100): How naturally the user speaks
    - accuracy (0-100): Grammar and vocabulary correctness
    - complexity (0-100): Sentence structure and vocabulary variety
    - coherence (0-100): Logical flow and topic relevance
    - overall (0-100): Weighted average
    - highlights: Things the user did well
    - improvements: Areas to work on
    - vietnameseAdvice: Advice in Vietnamese for the user
    """
    if not transcript or len(transcript) < 50:
        return _empty_result()

    try:
        prompt = _build_evaluation_prompt(transcript, mode, duration_minutes)
        response = await _model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )

        result = json.loads(response.text)

        # Validate and clamp scores
        scores = {
            "fluency": _clamp(result.get("fluency", 50)),
            "accuracy": _clamp(result.get("accuracy", 50)),
            "complexity": _clamp(result.get("complexity", 50)),
            "coherence": _clamp(result.get("coherence", 50)),
            "highlights": result.get("highlights", [])[:5],
            "improvements": result.get("improvements", [])[:5],
            "vietnameseAdvice": result.get("vietnameseAdvice", ""),
            "status": "COMPLETED",
        }

        # Calculate weighted overall score
        scores["overall"] = round(
            scores["fluency"] * 0.3
            + scores["accuracy"] * 0.3
            + scores["complexity"] * 0.2
            + scores["coherence"] * 0.2,
            1,
        )

        logger.info(
            f"Conversation evaluated for user {user_id}: "
            f"overall={scores['overall']}"
        )

        return scores

    except Exception as e:
        logger.error(f"Conversation evaluation failed: {e}", exc_info=True)
        return _empty_result(error=str(e))


def _build_evaluation_prompt(
    transcript: str,
    mode: str,
    duration_minutes: float,
) -> str:
    """Build the Gemini prompt for conversation evaluation."""
    return f"""You are an expert English conversation evaluator specializing in Vietnamese learners.

Evaluate the following English conversation transcript. The student is speaking with an AI tutor.

CONVERSATION MODE: {mode}
DURATION: {duration_minutes} minutes

TRANSCRIPT:
---
{transcript[:8000]}
---

Evaluate the STUDENT's (User's) performance ONLY. Score each dimension from 0-100:

1. **fluency** (0-100): How naturally and smoothly does the student speak? Consider:
   - Response speed and hesitation patterns
   - Use of fillers and self-corrections
   - Natural flow and rhythm

2. **accuracy** (0-100): How correct is the student's English? Consider:
   - Grammar correctness
   - Vocabulary usage
   - Common Vietnamese L1 errors (missing articles, tense issues, preposition errors)

3. **complexity** (0-100): How sophisticated is the student's language? Consider:
   - Sentence variety (simple/compound/complex)
   - Vocabulary range
   - Use of idioms, phrasal verbs, connectors

4. **coherence** (0-100): How well-structured is the communication? Consider:
   - Topic relevance and development
   - Logical connections between ideas
   - Appropriate turn-taking

Also provide:
- **highlights**: Array of 3-5 specific things the student did WELL (with examples from transcript)
- **improvements**: Array of 3-5 specific areas to improve (with corrected examples)
- **vietnameseAdvice**: A paragraph of advice IN VIETNAMESE for the student, encouraging and actionable

Respond in JSON format:
{{
  "fluency": number,
  "accuracy": number,
  "complexity": number,
  "coherence": number,
  "highlights": ["string"],
  "improvements": ["string"],
  "vietnameseAdvice": "string"
}}"""


def _clamp(value: int | float, low: int = 0, high: int = 100) -> float:
    """Clamp a score to valid range."""
    try:
        return max(low, min(high, float(value)))
    except (TypeError, ValueError):
        return 50.0


def _empty_result(error: str = "") -> dict:
    """Return empty result for invalid/too-short conversations."""
    return {
        "fluency": 0,
        "accuracy": 0,
        "complexity": 0,
        "coherence": 0,
        "overall": 0,
        "highlights": [],
        "improvements": [],
        "vietnameseAdvice": "",
        "status": "FAILED" if error else "INSUFFICIENT_DATA",
        "error": error,
    }


async def handle_conversation_evaluate(raw_data: str, redis_client) -> None:
    """
    Handle a 'conversation_evaluate' Pub/Sub event.

    1. Parse payload from Gateway
    2. Run Gemini evaluation
    3. Store result in Redis for Gateway polling
    4. Persist scores to DB for long-term storage
    """
    try:
        payload = json.loads(raw_data)
    except json.JSONDecodeError:
        logger.error("Invalid conversation_evaluate payload")
        return

    user_id = payload.get("userId", "")
    session_id = payload.get("sessionId", "")
    transcript = payload.get("transcript", "")
    mode = payload.get("mode", "FREE_TALK")
    duration = payload.get("durationMinutes", 0)

    if not user_id or not transcript:
        logger.warning("Incomplete conversation_evaluate payload")
        return

    result = await evaluate_conversation(transcript, mode, duration, user_id)

    # Store in Redis for Gateway polling (TTL 10 minutes)
    result_key = f"conversation_score:{session_id}"
    await redis_client.set(result_key, json.dumps(result), ex=600)

    # Persist scores to DB (long-term storage)
    if session_id and result.get("status") == "COMPLETED":
        try:
            async with async_session_factory() as db_session:
                from sqlalchemy import text

                await db_session.execute(
                    text("""
                        UPDATE conversations
                        SET overallScore = :overall,
                            fluencyScore = :fluency,
                            accuracyScore = :accuracy,
                            complexityScore = :complexity,
                            coherenceScore = :coherence,
                            status = 'SCORED'
                        WHERE id = :session_id AND userId = :user_id
                    """),
                    {
                        "overall": result.get("overall", 0),
                        "fluency": result.get("fluency", 0),
                        "accuracy": result.get("accuracy", 0),
                        "complexity": result.get("complexity", 0),
                        "coherence": result.get("coherence", 0),
                        "session_id": session_id,
                        "user_id": user_id,
                    },
                )
                await db_session.commit()
                logger.info(f"Scores persisted to DB for session {session_id}")
        except Exception as db_err:
            logger.error(
                f"Failed to persist scores to DB: {db_err}", exc_info=True
            )
            # Non-fatal: Redis cache still has the result

    logger.info(
        f"Conversation score cached: {result_key} "
        f"(overall={result.get('overall', 0)})"
    )

