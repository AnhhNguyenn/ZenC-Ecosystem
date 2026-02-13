"""
Learning Analytics Engine – Generates weekly progress reports.

Aggregates data from exercise attempts, voice sessions, vocabulary mastery,
and streaks to produce a comprehensive WeeklyReport for each active user.

Output:
- Stored in Redis for gateway retrieval
- Published to `generate_analytics` channel for potential email delivery
- Generates skill radar visualization data
"""

import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import (
    ExerciseAttempt,
    Exercise,
    UserVocabulary,
    Session as VoiceSession,
    Streak,
    DailyGoal,
)

logger = logging.getLogger(__name__)


async def generate_weekly_report(
    user_id: str,
    session: AsyncSession,
) -> dict:
    """
    Generate a comprehensive weekly learning analytics report.

    Returns the WeeklyReport structure matching shared-types interface.
    """
    now = datetime.utcnow()
    week_start = now - timedelta(days=7)

    # ── Total XP this week ─────────────────────────────────────
    xp_stmt = (
        select(func.coalesce(func.sum(ExerciseAttempt.xpEarned), 0))
        .where(
            ExerciseAttempt.userId == user_id,
            ExerciseAttempt.createdAt >= week_start,
        )
    )
    xp_result = await session.execute(xp_stmt)
    total_xp = xp_result.scalar() or 0

    # ── Exercise stats ─────────────────────────────────────────
    exercise_stmt = (
        select(
            func.count(ExerciseAttempt.id).label("total"),
            func.avg(
                case(
                    (ExerciseAttempt.isCorrect == True, 100.0),  # noqa: E712
                    else_=0.0,
                )
            ).label("accuracy"),
        )
        .where(
            ExerciseAttempt.userId == user_id,
            ExerciseAttempt.createdAt >= week_start,
        )
    )
    exercise_result = await session.execute(exercise_stmt)
    exercise_row = exercise_result.one()
    lessons_completed = int(exercise_row.total or 0)
    exercise_accuracy = round(float(exercise_row.accuracy or 0), 1)

    # ── Voice minutes ──────────────────────────────────────────
    voice_stmt = (
        select(
            func.coalesce(
                func.sum(
                    func.datediff("MINUTE", VoiceSession.startTime, VoiceSession.endTime)
                ),
                0,
            )
        )
        .where(
            VoiceSession.userId == user_id,
            VoiceSession.startTime >= week_start,
            VoiceSession.endTime.is_not(None),
        )
    )
    voice_result = await session.execute(voice_stmt)
    voice_minutes = int(voice_result.scalar() or 0)

    # ── Vocab learned this week ────────────────────────────────
    vocab_stmt = (
        select(func.count(UserVocabulary.id))
        .where(
            UserVocabulary.userId == user_id,
            UserVocabulary.createdAt >= week_start,
        )
    )
    vocab_result = await session.execute(vocab_stmt)
    vocab_learned = int(vocab_result.scalar() or 0)

    # ── Streak ── ──────────────────────────────────────────────
    streak_stmt = select(Streak).where(Streak.userId == user_id)
    streak_result = await session.execute(streak_stmt)
    streak = streak_result.scalar_one_or_none()
    streak_days = streak.currentStreak if streak else 0

    # ── Skill radar ────────────────────────────────────────────
    skill_radar = await _compute_skill_radar(user_id, session, week_start)

    # ── Compared to last week ──────────────────────────────────
    prev_week_start = week_start - timedelta(days=7)

    prev_xp_stmt = (
        select(func.coalesce(func.sum(ExerciseAttempt.xpEarned), 0))
        .where(
            ExerciseAttempt.userId == user_id,
            ExerciseAttempt.createdAt >= prev_week_start,
            ExerciseAttempt.createdAt < week_start,
        )
    )
    prev_xp_result = await session.execute(prev_xp_stmt)
    prev_xp = int(prev_xp_result.scalar() or 0)

    prev_acc_stmt = (
        select(
            func.avg(
                case(
                    (ExerciseAttempt.isCorrect == True, 100.0),  # noqa: E712
                    else_=0.0,
                )
            )
        )
        .where(
            ExerciseAttempt.userId == user_id,
            ExerciseAttempt.createdAt >= prev_week_start,
            ExerciseAttempt.createdAt < week_start,
        )
    )
    prev_acc_result = await session.execute(prev_acc_stmt)
    prev_accuracy = float(prev_acc_result.scalar() or 0)

    return {
        "userId": user_id,
        "weekStart": week_start.isoformat(),
        "weekEnd": now.isoformat(),
        "totalXp": int(total_xp),
        "lessonsCompleted": lessons_completed,
        "exerciseAccuracy": exercise_accuracy,
        "voiceMinutes": voice_minutes,
        "vocabLearned": vocab_learned,
        "streakDays": streak_days,
        "skillRadar": skill_radar,
        "comparedToLastWeek": {
            "xpChange": int(total_xp) - prev_xp,
            "accuracyChange": round(exercise_accuracy - prev_accuracy, 1),
            "timeChange": 0,
        },
    }


async def _compute_skill_radar(
    user_id: str,
    session: AsyncSession,
    since: datetime,
) -> dict:
    """Compute per-skill average scores from exercise attempts."""

    async def skill_score(exercise_types: list[str]) -> float:
        stmt = (
            select(func.avg(ExerciseAttempt.score))
            .join(Exercise, ExerciseAttempt.exerciseId == Exercise.id)
            .where(
                ExerciseAttempt.userId == user_id,
                ExerciseAttempt.createdAt >= since,
                Exercise.type.in_(exercise_types),
            )
        )
        result = await session.execute(stmt)
        return round(float(result.scalar() or 0), 1)

    grammar, speaking, listening, reading = await asyncio_gather(
        skill_score(["MCQ", "FILL_BLANK"]),
        skill_score(["SPEAKING"]),
        skill_score(["LISTENING"]),
        skill_score(["REORDER", "MATCHING"]),
    )

    # Vocab score from mastery percentage
    total_stmt = select(func.count(UserVocabulary.id)).where(
        UserVocabulary.userId == user_id
    )
    mastered_stmt = select(func.count(UserVocabulary.id)).where(
        UserVocabulary.userId == user_id,
        UserVocabulary.masteryLevel == "MASTERED",
    )

    total_result = await session.execute(total_stmt)
    mastered_result = await session.execute(mastered_stmt)
    total = int(total_result.scalar() or 0)
    mastered = int(mastered_result.scalar() or 0)
    vocabulary = round((mastered / total * 100) if total > 0 else 0, 1)

    return {
        "grammar": grammar,
        "vocabulary": vocabulary,
        "speaking": speaking,
        "listening": listening,
        "reading": reading,
    }


async def generate_all_weekly_reports(redis_client) -> dict:
    """
    Batch job: generate weekly reports for all active users.
    """
    import asyncio
    stats = {"reports_generated": 0, "errors": 0}

    async with async_session_factory() as session:
        # Get all active users with activity this week
        week_start = datetime.utcnow() - timedelta(days=7)
        stmt = (
            select(ExerciseAttempt.userId)
            .where(ExerciseAttempt.createdAt >= week_start)
            .distinct()
        )
        result = await session.execute(stmt)
        active_users = [row[0] for row in result.all()]

        for user_id in active_users:
            try:
                report = await generate_weekly_report(user_id, session)

                # Cache in Redis with 7-day TTL
                await redis_client.set(
                    f"weekly_report:{user_id}",
                    json.dumps(report),
                    ex=604800,
                )

                stats["reports_generated"] += 1

            except Exception as e:
                logger.error(f"Failed to generate report for {user_id}: {e}")
                stats["errors"] += 1

    logger.info(
        f"Weekly reports: {stats['reports_generated']} generated, "
        f"{stats['errors']} errors"
    )
    return stats


# Helper to avoid import at top level
async def asyncio_gather(*coros):
    import asyncio
    return await asyncio.gather(*coros)
