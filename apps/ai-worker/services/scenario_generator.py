"""
Scenario Generator – AI-driven conversational practice scenarios.

Uses Gemini to create immersive, level-appropriate conversation scenarios
that adapt to the user's proficiency level and learning goals.

Scenario Types:
1. DAILY_LIFE: Everyday situations (ordering food, asking directions)
2. BUSINESS: Professional contexts (meetings, presentations, emails)
3. TRAVEL: Airport, hotel, sightseeing scenarios
4. ACADEMIC: University, research, study-related contexts
5. SOCIAL: Making friends, parties, hobbies
6. EMERGENCY: Medical, police, safety situations

Each scenario includes:
- Context description (in Vietnamese for comprehension)
- AI character definition (personality, speaking style)
- Suggested vocabulary for the scenario
- Learning objectives
- Expected CEFR level
"""

import json
import logging
from typing import Optional

import google.generativeai as genai
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SCENARIO_PROMPT = """You are a creative scenario designer for an English learning app for Vietnamese learners.

Generate an immersive conversation practice scenario with the following parameters:
- CEFR Level: {level}
- Category: {category}
- Previous topics practiced by this user: {previous_topics}

Respond with JSON:
{{
    "title": "<scenario title in English>",
    "titleVi": "<scenario title in Vietnamese>",
    "description": "<2-3 sentence description in English>",
    "descriptionVi": "<description in Vietnamese>",
    "context": "<detailed context setting for the learner, in Vietnamese>",
    "aiCharacter": {{
        "name": "<character name>",
        "role": "<character's role in scenario>",
        "personality": "<brief personality description>",
        "speakingStyle": "<formal/casual/professional>"
    }},
    "learningObjectives": [
        "<objective 1>",
        "<objective 2>",
        "<objective 3>"
    ],
    "suggestedVocabulary": [
        {{
            "word": "<English word>",
            "translation": "<Vietnamese translation>",
            "usage": "<example sentence>"
        }}
    ],
    "starterPrompt": "<the first message the AI character says to start the conversation>",
    "expectedDurationMinutes": <3-10>,
    "grammarFocus": ["<grammar point 1>", "<grammar point 2>"]
}}

Make the scenario engaging, culturally relevant to Vietnamese learners,
and naturally integrated with the learning objectives.
Vocabulary should include 5-8 key words/phrases.
The starter prompt should be natural and inviting.
Level-appropriate complexity: A1-A2 use simple sentences, B1-B2 moderate complexity,
C1-C2 can include idioms and nuanced language."""


async def generate_scenario(
    level: str = "A2",
    category: str = "DAILY_LIFE",
    previous_topics: Optional[list[str]] = None,
) -> dict:
    """
    Generate a conversation practice scenario using Gemini.

    Args:
        level: CEFR level (A1-C2)
        category: Scenario category
        previous_topics: Topics the user has already practiced (for variety)

    Returns:
        Complete scenario dict ready for the mobile client
    """
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = SCENARIO_PROMPT.format(
            level=level,
            category=category,
            previous_topics=json.dumps(previous_topics or []),
        )

        response = await model.generate_content_async(
            prompt,
            generation_config={
                "temperature": 0.7,  # Higher creativity for scenarios
                "response_mime_type": "application/json",
            },
        )

        scenario = json.loads(response.text)
        scenario["level"] = level
        scenario["category"] = category
        scenario["generatedAt"] = __import__("datetime").datetime.utcnow().isoformat()

        logger.info(f"Generated scenario: {scenario.get('title', 'untitled')}")
        return scenario

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse scenario response: {e}")
        return _get_fallback_scenario(level, category)
    except Exception as e:
        logger.error(f"Scenario generation failed: {e}")
        return _get_fallback_scenario(level, category)


def _get_fallback_scenario(level: str, category: str) -> dict:
    """Pre-built fallback scenarios when Gemini is unavailable."""
    fallbacks = {
        "DAILY_LIFE": {
            "title": "At the Coffee Shop",
            "titleVi": "Tại quán cà phê",
            "description": "Practice ordering drinks and making small talk at a coffee shop.",
            "descriptionVi": "Luyện tập gọi đồ uống và trò chuyện tại quán cà phê.",
            "context": "Bạn đang ở một quán cà phê và muốn gọi đồ uống. Nhân viên phục vụ rất thân thiện.",
            "aiCharacter": {
                "name": "Sarah",
                "role": "Barista",
                "personality": "Friendly, patient, helpful",
                "speakingStyle": "casual",
            },
            "learningObjectives": [
                "Order food and drinks",
                "Make polite requests",
                "Express preferences",
            ],
            "suggestedVocabulary": [
                {"word": "I'd like", "translation": "Tôi muốn", "usage": "I'd like a cappuccino, please."},
                {"word": "Could I have", "translation": "Cho tôi", "usage": "Could I have a glass of water?"},
                {"word": "medium", "translation": "vừa/trung bình", "usage": "I'll have a medium latte."},
                {"word": "recommendation", "translation": "gợi ý", "usage": "Do you have any recommendations?"},
                {"word": "to go", "translation": "mang đi", "usage": "Can I get that to go?"},
            ],
            "starterPrompt": "Hi there! Welcome to Morning Brew. What can I get for you today?",
            "expectedDurationMinutes": 5,
            "grammarFocus": ["Modal verbs (could, would)", "Polite requests"],
        },
        "BUSINESS": {
            "title": "Job Interview",
            "titleVi": "Phỏng vấn xin việc",
            "description": "Practice common job interview questions and professional responses.",
            "descriptionVi": "Luyện tập trả lời câu hỏi phỏng vấn thường gặp.",
            "context": "Bạn đang tham gia một buổi phỏng vấn cho vị trí Software Developer.",
            "aiCharacter": {
                "name": "Mr. Johnson",
                "role": "HR Manager",
                "personality": "Professional, direct, fair",
                "speakingStyle": "formal",
            },
            "learningObjectives": [
                "Answer interview questions confidently",
                "Describe work experience",
                "Ask professional questions",
            ],
            "suggestedVocabulary": [
                {"word": "experience", "translation": "kinh nghiệm", "usage": "I have 3 years of experience in..."},
                {"word": "strengths", "translation": "điểm mạnh", "usage": "My main strengths are..."},
                {"word": "opportunity", "translation": "cơ hội", "usage": "This is a great opportunity to..."},
                {"word": "teamwork", "translation": "làm việc nhóm", "usage": "I enjoy teamwork and collaboration."},
                {"word": "responsibilities", "translation": "trách nhiệm", "usage": "My responsibilities included..."},
            ],
            "starterPrompt": "Good morning! Thank you for coming in today. Please have a seat. Shall we begin?",
            "expectedDurationMinutes": 7,
            "grammarFocus": ["Past tense (experience)", "Present perfect"],
        },
    }

    scenario = fallbacks.get(category, fallbacks["DAILY_LIFE"])
    scenario["level"] = level
    scenario["category"] = category
    scenario["isFallback"] = True

    return scenario
