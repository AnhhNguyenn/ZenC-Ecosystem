"""
Pronunciation Scorer – Gemini-powered phoneme-level pronunciation assessment.

Architecture:
- Subscribes to Redis channel `pronunciation_assess`
- Receives base64-encoded audio + reference text
- Uses Gemini 2.5 Flash to analyze pronunciation quality
- Returns per-phoneme scores, overall score, and problem areas
- Results stored in Redis for Gateway polling

Scoring Algorithm:
- Overall score: weighted average of phoneme scores (0-100)
- Individual phoneme scores based on:
  1. Phoneme identification accuracy
  2. Stress pattern correctness
  3. Intonation matching
  4. Connected speech naturalness

Vietnamese-specific concerns:
- Final consonant clusters (Vietnamese lacks them)
- /θ/ and /ð/ sounds (common Vietnamese learner difficulty)
- /r/ vs /l/ distinction
- Vowel length contrasts
"""

import json
import logging
from typing import Optional

import google.generativeai as genai
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


PRONUNCIATION_PROMPT = """You are an expert English pronunciation assessor specializing in Vietnamese learners.

Analyze the following spoken text against the reference text and provide a detailed assessment.

Reference text: "{reference_text}"

Provide your assessment as JSON with this exact structure:
{{
    "overallScore": <0-100>,
    "fluencyScore": <0-100>,
    "accuracyScore": <0-100>,
    "phonemeScores": [
        {{
            "phoneme": "<IPA symbol>",
            "score": <0-100>,
            "feedback": "<brief feedback in Vietnamese>"
        }}
    ],
    "problemAreas": ["<problem description 1>", "<problem description 2>"],
    "suggestions": ["<improvement suggestion 1>", "<improvement suggestion 2>"],
    "detailedFeedback": "<2-3 sentence overall feedback in Vietnamese>"
}}

Focus on common Vietnamese-English pronunciation difficulties:
- /θ/ (th) and /ð/ (dh) sounds
- Final consonant clusters
- /r/ vs /l/ distinction
- Short vs long vowels
- Word stress patterns
- Sentence intonation

Be encouraging but honest. Score generously for beginners."""


async def assess_pronunciation(
    audio_base64: str,
    reference_text: str,
    user_id: str,
) -> dict:
    """
    Assess pronunciation of audio against reference text using Gemini.

    Args:
        audio_base64: Base64-encoded audio (PCM 16-bit 16kHz mono)
        reference_text: The text the user was supposed to read
        user_id: For tracking and caching problem patterns

    Returns:
        Assessment result dict with scores and feedback
    """
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = PRONUNCIATION_PROMPT.format(reference_text=reference_text)

        # Send audio + prompt to Gemini for multimodal analysis
        response = await model.generate_content_async(
            [
                {"mime_type": "audio/pcm", "data": audio_base64},
                prompt,
            ],
            generation_config={
                "temperature": 0.2,
                "response_mime_type": "application/json",
            },
        )

        result = json.loads(response.text)

        logger.info(
            f"Pronunciation assessment for user {user_id}: "
            f"overall={result.get('overallScore', 0)}"
        )

        return {
            "status": "COMPLETED",
            "result": result,
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response: {e}")
        return {
            "status": "ERROR",
            "error": "Failed to parse assessment result",
        }
    except Exception as e:
        logger.error(f"Pronunciation assessment failed: {e}")
        return {
            "status": "ERROR",
            "error": str(e),
        }


async def update_problem_sounds(
    redis_client,
    user_id: str,
    assessment: dict,
) -> None:
    """
    Update the user's problem sound profile in Redis based on assessment history.

    Tracks recurring low-scoring phonemes across assessments to build
    a personalized pronunciation weak spots profile.
    """
    try:
        result = assessment.get("result", {})
        phoneme_scores = result.get("phonemeScores", [])

        if not phoneme_scores:
            return

        # Get existing problem profile
        existing = await redis_client.get(f"pronunciation:problems:{user_id}")
        problems = json.loads(existing) if existing else {"problemPhonemes": []}

        # Update with new scores
        phoneme_map = {p["phoneme"]: p for p in problems.get("problemPhonemes", [])}

        for ps in phoneme_scores:
            phoneme = ps["phoneme"]
            score = ps["score"]

            if phoneme in phoneme_map:
                # Running average
                existing_entry = phoneme_map[phoneme]
                count = existing_entry.get("count", 1)
                avg = existing_entry.get("avgScore", 50)
                new_avg = (avg * count + score) / (count + 1)
                phoneme_map[phoneme] = {
                    "phoneme": phoneme,
                    "avgScore": round(new_avg, 1),
                    "count": count + 1,
                }
            else:
                phoneme_map[phoneme] = {
                    "phoneme": phoneme,
                    "avgScore": score,
                    "count": 1,
                }

        # Keep only phonemes with avg score < 70 (problem areas)
        problem_phonemes = [
            p for p in phoneme_map.values() if p["avgScore"] < 70
        ]
        problem_phonemes.sort(key=lambda x: x["avgScore"])

        await redis_client.set(
            f"pronunciation:problems:{user_id}",
            json.dumps({"problemPhonemes": problem_phonemes}),
            ex=604800,  # 7-day TTL
        )

    except Exception as e:
        logger.error(f"Failed to update problem sounds for {user_id}: {e}")
