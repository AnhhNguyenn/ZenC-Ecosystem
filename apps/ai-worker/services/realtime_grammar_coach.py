"""
ZenC AI Worker – Real-Time Grammar Coach Service.

Ultra-fast grammar checking (< 200ms target) for in-conversation correction.
Subscribes to 'grammar_realtime' Redis Pub/Sub channel and returns corrections
via Redis keys that the Gateway polls.

Design decisions:
- Uses Gemini Flash with very low temperature for deterministic corrections
- Short prompts (< 500 tokens) to minimize latency
- Caches common corrections to avoid repeated API calls
- Tracks error patterns per user for adaptive teaching
- Vietnamese explanations for low-confidence users
"""

import json
import logging
import time
from datetime import datetime

import google.generativeai as genai

from config import settings

logger = logging.getLogger(__name__)

# Configure Gemini for fast responses
genai.configure(api_key=settings.GEMINI_API_KEY)
_model = genai.GenerativeModel("gemini-2.5-flash")

# Common correction cache (in-memory for speed)
_correction_cache: dict[str, dict] = {}
_CACHE_MAX_SIZE = 500


async def check_grammar_realtime(text: str, user_id: str) -> dict:
    """
    Ultra-fast grammar check for a single sentence.

    Target: < 200ms response time.

    Returns:
    {
        "hasMistake": bool,
        "original": str,
        "corrected": str,
        "rule": str,
        "explanation": str,
        "explanationVi": str,
        "confidence": float
    }
    """
    start = time.time()

    # Check cache first
    cache_key = text.strip().lower()
    if cache_key in _correction_cache:
        cached = _correction_cache[cache_key].copy()
        cached["cached"] = True
        cached["latencyMs"] = round((time.time() - start) * 1000)
        return cached

    # Skip very short text
    if len(text.strip()) < 3:
        return {"hasMistake": False, "latencyMs": 0}

    try:
        prompt = f"""Check this English sentence for grammar errors. If correct, respond {{"hasMistake": false}}.
If incorrect, respond with the correction in JSON:
{{"hasMistake": true, "original": "the error part", "corrected": "the fix", "rule": "grammar rule name", "explanation": "brief explanation in English", "explanationVi": "giải thích ngắn bằng tiếng Việt", "confidence": 0.0-1.0}}

Sentence: "{text.strip()}"

Focus on:
- Subject-verb agreement
- Article usage (a/an/the) - common Vietnamese learner error
- Tense consistency
- Preposition usage
- Word order

JSON only, no markdown:"""

        response = await _model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,
                max_output_tokens=200,
            ),
        )

        result = json.loads(response.text)
        latency = round((time.time() - start) * 1000)
        result["latencyMs"] = latency

        # Cache the correction
        if len(_correction_cache) < _CACHE_MAX_SIZE:
            _correction_cache[cache_key] = result

        if latency > 200:
            logger.warning(
                f"Grammar check exceeded 200ms target: {latency}ms"
            )

        return result

    except Exception as e:
        logger.error(f"Real-time grammar check failed: {e}")
        return {
            "hasMistake": False,
            "error": str(e),
            "latencyMs": round((time.time() - start) * 1000),
        }


async def handle_grammar_realtime(raw_data: str, redis_client) -> None:
    """
    Handle a 'grammar_realtime' Pub/Sub event from Gateway.

    1. Parse the sentence from Gateway
    2. Run ultra-fast grammar check
    3. Store result in Redis for Gateway polling
    4. Track error pattern for the user
    """
    try:
        payload = json.loads(raw_data)
    except json.JSONDecodeError:
        logger.error("Invalid grammar_realtime payload")
        return

    correction_id = payload.get("correctionId", "")
    user_id = payload.get("userId", "")
    text = payload.get("text", "")

    if not correction_id or not text:
        return

    result = await check_grammar_realtime(text, user_id)

    # Store result for Gateway polling (TTL 30 seconds)
    await redis_client.set(correction_id, json.dumps(result), ex=30)

    # Track error patterns per user
    if result.get("hasMistake") and user_id:
        rule = result.get("rule", "unknown")
        pattern_key = f"grammar_patterns:{user_id}"
        await redis_client.hincrby(pattern_key, rule, 1)
        await redis_client.expire(pattern_key, 86400 * 30)  # 30 days TTL

    logger.debug(
        f"Grammar check: '{text[:50]}...' → "
        f"mistake={result.get('hasMistake')} "
        f"({result.get('latencyMs', 0)}ms)"
    )


async def get_user_grammar_patterns(
    user_id: str, redis_client
) -> dict:
    """
    Get a user's grammar error pattern frequencies.
    Used by the learning analytics engine for personalized recommendations.
    """
    pattern_key = f"grammar_patterns:{user_id}"
    patterns = await redis_client.hgetall(pattern_key)
    return {
        k: int(v)
        for k, v in sorted(
            patterns.items(), key=lambda x: int(x[1]), reverse=True
        )
    }
