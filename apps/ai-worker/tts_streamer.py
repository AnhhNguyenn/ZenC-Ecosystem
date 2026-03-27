"""
ZenC Deep Brain - TTS Streamer (Professor Sarah Voice)

Synthesizes the output of the Grammar Analyzer into human-like speech
using ElevenLabs Turbo v2.5.
"""

import httpx
import logging
from config import settings

logger = logging.getLogger(__name__)

async def synthesize_speech(text: str, voice_id: str = None) -> bytes:
    """
    Calls ElevenLabs API to convert text to speech.
    Returns: Raw MP3 audio bytes.
    """
    api_key = settings.ELEVENLABS_API_KEY
    v_id = voice_id or settings.ELEVENLABS_VOICE_ID

    if not api_key or "your_elevenlabs" in api_key:
        logger.warning("ELEVENLABS_API_KEY not set. Returning empty audio buffer.")
        return b"" # In production, return a fallback MP3 or raise an error

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{v_id}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key
    }
    
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True
        }
    }

    try:
        # ElevenLabs generation can take 200-500ms depending on text length
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            response.raise_for_status()
            return response.content
            
    except httpx.HTTPStatusError as e:
        logger.error(f"ElevenLabs API error: {e.response.status_code} - {e.response.text}")
        return b""
    except Exception as e:
        logger.error(f"TTS network error: {e}")
        return b""
