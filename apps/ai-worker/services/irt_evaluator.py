"""
ZenC AI Worker – IRT Placement Test Service.

Evaluates user performance turn-by-turn during the PLACEMENT_TEST mode.
Calculates Elo rating based on pass/fail and previous Elo.
"""

import json
import logging
import asyncio

import google.generativeai as genai
from ai_timeout import await_with_timeout

from config import settings
from database import async_session_factory

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)
_model = genai.GenerativeModel("gemini-2.5-flash")

async def evaluate_placement_turn(transcript: str) -> int:
    """
    Returns 1 if the transcript demonstrates good fluency and grammar, else 0.
    """
    if not transcript or len(transcript) < 5:
        return 0

    try:
        prompt = f"""Evaluate the following English phrase spoken by a non-native speaker.
Reply exactly with "1" if it is reasonably fluent and grammatically acceptable for basic communication.
Reply exactly with "0" if it is highly fragmented, completely incomprehensible, or structurally very poor.

PHRASE: "{transcript}"
"""
        response = await await_with_timeout(
            _model.generate_content_async(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.0,
                    max_output_tokens=5,
                ),
            ),
            "Placement evaluation",
        )
        return 1 if "1" in response.text else 0
    except Exception as e:
        logger.error(f"Placement evaluation failed: {e}")
        return 1 # Default to pass on failure to prevent Elo tanking

def map_elo_to_cefr(elo: int) -> str:
    if elo < 1300: return 'A1'
    if elo < 1500: return 'A2'
    if elo < 1700: return 'B1'
    if elo < 1900: return 'B2'
    if elo < 2100: return 'C1'
    return 'C2'

async def handle_placement_turn_evaluate(raw_data: str, redis_client) -> None:
    try:
        payload = json.loads(raw_data)
        user_id = payload.get("userId")
        transcript = payload.get("transcript")

        if not user_id or not transcript: return

        # Grade turn
        score = await evaluate_placement_turn(transcript)

        # Calculate Elo
        elo_key = f"placement_elo:{user_id}"
        current_elo_str = await redis_client.get(elo_key)
        current_elo = int(current_elo_str) if current_elo_str else 1200 # Start at A2 border

        # Simple Elo update
        K = 32
        # Assuming the AI adapts its questions to match user Elo, the expected score is 0.5.
        # This is a simplified 1PL Rasch model where we just update based on pass/fail.
        expected = 0.5
        new_elo = int(current_elo + K * (score - expected))

        await redis_client.set(elo_key, new_elo, ex=3600)

        # Save level temporarily in profile cache for next turn's prompt building
        new_level = map_elo_to_cefr(new_elo)

        # Load and update profile cache
        profile_key = f"user_profile:{user_id}"
        profile_str = await redis_client.get(profile_key)
        if profile_str:
            profile = json.loads(profile_str)
            profile['currentLevel'] = new_level
            await redis_client.set(profile_key, json.dumps(profile), ex=86400)

        # Broadcast the level update so the Gateway can adjust the current session's difficulty
        await redis_client.publish(
            "placement_level_update",
            json.dumps({"userId": user_id, "newLevel": new_level})
        )

        logger.info(f"Placement turn for {user_id}: score={score}, new_elo={new_elo}, level={new_level}")

    except Exception as e:
        logger.error(f"Failed to process placement turn: {e}", exc_info=True)
