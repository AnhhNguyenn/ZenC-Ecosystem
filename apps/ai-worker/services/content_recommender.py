"""
Content Recommender – AI-powered personalized learning path generation.

Uses Gemini to analyze user's learning history, strengths, and weaknesses
to recommend the most effective next activities.

Recommendation Algorithm:
1. Analyze recent exercise accuracy by type (grammar, vocab, speaking, etc.)
2. Identify skill gaps from mistake patterns
3. Consider user's CEFR level and progression rate
4. Balance between strengthening weaknesses and maintaining engagement
5. Apply spaced repetition insights from SM-2 data

Output: Ordered list of ContentRecommendation matching shared-types interface.
"""

import json
import logging
from datetime import datetime, timedelta

import google.generativeai as genai
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import (
    ExerciseAttempt,
    Exercise,
    UserMistake,
    UserVocabulary,
    UserProfile,
    Lesson,
    Course,
)
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

RECOMMENDER_PROMPT = """You are a learning path optimizer for an English learning app designed for Vietnamese learners.

Based on the learner's profile and performance data below, recommend the next 5 activities they should do.

**Learner Profile:**
{learner_profile}

**Recent Performance:**
{performance_data}

**Skill Gaps:**
{skill_gaps}

Respond with a JSON array of exactly 5 recommendations:
[
    {{
        "type": "LESSON" | "VOCABULARY" | "EXERCISE" | "CONVERSATION",
        "title": "<descriptive title in Vietnamese>",
        "reason": "<why this is recommended, in Vietnamese>",
        "priority": <1-5, where 1 is highest>
    }}
]

Principles:
1. 60% weakness focus, 40% strength reinforcement (avoid frustration)
2. Alternate between skill types to maintain engagement
3. Prioritize areas with declining accuracy trends
4. Include at least one speaking/conversation activity
5. Consider spaced repetition timing for vocabulary"""


async def generate_recommendations(
    user_id: str,
    session: AsyncSession,
) -> list[dict]:
    """
    Generate personalized content recommendations using Gemini.
    """
    try:
        # ── Gather learner data ────────────────────────────────
        learner_profile = await _get_learner_profile(user_id, session)
        performance_data = await _get_recent_performance(user_id, session)
        skill_gaps = await _get_skill_gaps(user_id, session)

        # ── Generate recommendations via Gemini ────────────────
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = RECOMMENDER_PROMPT.format(
            learner_profile=json.dumps(learner_profile, indent=2),
            performance_data=json.dumps(performance_data, indent=2),
            skill_gaps=json.dumps(skill_gaps, indent=2),
        )

        response = await model.generate_content_async(
            prompt,
            generation_config={
                "temperature": 0.4,
                "response_mime_type": "application/json",
            },
        )

        recommendations = json.loads(response.text)

        logger.info(f"Generated {len(recommendations)} recommendations for {user_id}")
        return recommendations

    except Exception as e:
        logger.error(f"Recommendation generation failed for {user_id}: {e}")
        # Fallback: return generic recommendations
        return _get_fallback_recommendations()


async def _get_learner_profile(user_id: str, session: AsyncSession) -> dict:
    """Get user's profile data for the recommender."""
    stmt = select(UserProfile).where(UserProfile.userId == user_id)
    result = await session.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile:
        return {"level": "A1", "confidenceScore": 50}

    return {
        "level": profile.level,
        "confidenceScore": float(profile.confidenceScore or 50),
        "nativeLanguage": profile.nativeLanguage,
    }


async def _get_recent_performance(user_id: str, session: AsyncSession) -> dict:
    """Get last 7 days of exercise performance grouped by type."""
    week_ago = datetime.utcnow() - timedelta(days=7)

    stmt = (
        select(
            Exercise.type,
            func.count(ExerciseAttempt.id).label("attempts"),
            func.avg(ExerciseAttempt.score).label("avg_score"),
            func.avg(
                case(
                    (ExerciseAttempt.isCorrect == True, 100.0),  # noqa: E712
                    else_=0.0,
                )
            ).label("accuracy"),
        )
        .join(Exercise, ExerciseAttempt.exerciseId == Exercise.id)
        .where(
            ExerciseAttempt.userId == user_id,
            ExerciseAttempt.createdAt >= week_ago,
        )
        .group_by(Exercise.type)
    )

    result = await session.execute(stmt)
    rows = result.all()

    return {
        row.type: {
            "attempts": int(row.attempts),
            "avgScore": round(float(row.avg_score or 0), 1),
            "accuracy": round(float(row.accuracy or 0), 1),
        }
        for row in rows
    }


async def _get_skill_gaps(user_id: str, session: AsyncSession) -> list[dict]:
    """Identify top skill gaps from mistake patterns."""
    stmt = (
        select(
            UserMistake.grammarRuleId,
            func.count(UserMistake.id).label("mistake_count"),
        )
        .where(UserMistake.userId == user_id)
        .group_by(UserMistake.grammarRuleId)
        .order_by(func.count(UserMistake.id).desc())
        .limit(5)
    )

    result = await session.execute(stmt)
    rows = result.all()

    return [
        {"rule": row.grammarRuleId, "mistakeCount": int(row.mistake_count)}
        for row in rows
    ]


def _get_fallback_recommendations() -> list[dict]:
    """Generic recommendations when AI generation fails."""
    return [
        {
            "type": "LESSON",
            "title": "Ôn tập ngữ pháp cơ bản",
            "reason": "Củng cố nền tảng ngữ pháp",
            "priority": 1,
        },
        {
            "type": "VOCABULARY",
            "title": "Từ vựng hàng ngày",
            "reason": "Mở rộng vốn từ thông dụng",
            "priority": 2,
        },
        {
            "type": "CONVERSATION",
            "title": "Luyện nói với AI",
            "reason": "Tăng cường kỹ năng giao tiếp",
            "priority": 3,
        },
        {
            "type": "EXERCISE",
            "title": "Bài tập nghe hiểu",
            "reason": "Cải thiện kỹ năng nghe",
            "priority": 4,
        },
        {
            "type": "VOCABULARY",
            "title": "Flashcard ôn tập",
            "reason": "Ôn lại từ vựng đã học",
            "priority": 5,
        },
    ]


async def cache_recommendations(redis_client, user_id: str) -> list[dict]:
    """Generate and cache recommendations for a user."""
    async with async_session_factory() as session:
        recs = await generate_recommendations(user_id, session)

    await redis_client.set(
        f"recommendations:{user_id}",
        json.dumps(recs),
        ex=21600,  # 6-hour TTL
    )

    return recs
