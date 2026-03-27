"""
ZenC Deep Brain - Grammar Analyzer (Professor Sarah Persona)

Utilizes Llama 3 70B via Groq API for ultra-low latency grammar explanations.
"""

import httpx
import logging
import json
from config import settings

logger = logging.getLogger(__name__)

# System instructions to shape the "Professor Sarah" persona
SYSTEM_PROMPT = """You are Professor Sarah, an expert linguistics and English grammar professor from Oxford.
You are currently co-teaching an English lesson with your assistant Alex. Alex just received a difficult grammar question from a student and handed it over to you.
Your job is to explain the grammar rule clearly, logically, and concisely in Vietnamese (but keep English terms like "Present Perfect").
Tone: Warm, authoritative, academic but highly accessible.
Constraints: No pleasantries needed (Alex already did that). Dive straight into the explanation. Keep it under 200 words if possible so the student doesn't fall asleep.
Output: Only the explanation text, tailored for text-to-speech reading.
"""

async def analyze_grammar(original_text: str, user_question: str) -> str:
    """
    Calls Groq API (Llama 3 70B) to generate a grammar explanation.
    """
    if not settings.GROQ_API_KEY or "your_groq_api_key" in settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set. Returning fallback pedagogy text.")
        return ("Đây là Professor Sarah. Có vẻ như hệ thống phân tích sâu đang gặp chút vấn đề kết nối. "
                "Tuy nhiên, đối với câu này, bí quyết chủ yếu nằm ở việc chia động từ cho đúng thì. "
                "Alex, mời bạn tiếp tục cuộc trò chuyện nhé!")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    prompt = (f"Student encountered this sentence: '{original_text}'.\n"
              f"Student's question: '{user_question}'.\n"
              "Please explain.")

    payload = {
        "model": "llama3-70b-8192",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 512,
        "stream": False # Use streaming=True in the future if we want chunked TTS
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=8.0)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
            
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return ("Cô xin lỗi, hiện tại cô đang bận một chút trên bục giảng. "
                "Alex sẽ lưu lại câu hỏi này và chúng ta sẽ thảo luận sau nhé!")
