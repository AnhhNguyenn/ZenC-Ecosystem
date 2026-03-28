"""
SM-2 Cron Service – Scheduled spaced repetition task runner.

Runs daily to:
1. Populate daily review lists in Redis for each active user
2. Send streak warning notifications for users at risk
3. Reset weekly leaderboard on Sundays
4. Replenish streak freezes for PRO/UNLIMITED users weekly

Designed to be triggered by an external cron scheduler (e.g., APScheduler
running inside the Worker, or Kubernetes CronJob).
"""

import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import UserMistake, Streak, User, UserVocabulary, Notification

logger = logging.getLogger(__name__)


async def run_daily_review_cron(redis_client) -> dict:
    """
    Daily job: populate Redis review lists from user_mistakes due today.

    For each user with due reviews, pushes a summary into
    `daily_review:{userId}` Redis list for the Gateway's proactive greeting.

    Returns stats about how many users were processed.
    """
    stats = {"users_processed": 0, "total_reviews_queued": 0}

    if redis_client is None:
        logger.warning("Skipping daily review cron because Redis is unavailable")
        return stats

    async with async_session_factory() as session:
        # Find all unique users with mistakes due today or earlier
        today = datetime.utcnow()
        stmt = (
            select(UserMistake.userId, func.count(UserMistake.id).label("due_count"))
            .where(UserMistake.nextReviewAt <= today)
            .group_by(UserMistake.userId)
        )

        result = await session.execute(stmt)
        due_users = result.all()

        for user_id, due_count in due_users:
            try:
                # Get top 10 due mistakes for this user
                mistakes_stmt = (
                    select(UserMistake)
                    .where(
                        UserMistake.userId == user_id,
                        UserMistake.nextReviewAt <= today,
                    )
                    .order_by(UserMistake.nextReviewAt.asc())
                    .limit(10)
                )

                mistakes_result = await session.execute(mistakes_stmt)
                mistakes = mistakes_result.scalars().all()

                # Push review summaries to Redis
                key = f"daily_review:{user_id}"
                await redis_client.delete(key)

                for mistake in mistakes:
                    summary = json.dumps({
                        "grammarRuleId": mistake.grammarRuleId,
                        "originalText": mistake.originalText,
                        "correctedText": mistake.correctedText,
                    })
                    await redis_client.rpush(key, summary)

                await redis_client.expire(key, 86400)  # 24h TTL

                stats["users_processed"] += 1
                stats["total_reviews_queued"] += len(mistakes)

            except Exception as e:
                logger.error(f"Failed to process reviews for user {user_id}: {e}")

    logger.info(
        f"Daily review cron completed: {stats['users_processed']} users, "
        f"{stats['total_reviews_queued']} reviews queued"
    )
    return stats


async def run_streak_warning_cron(redis_client) -> dict:
    """
    Evening job: warn users whose streak will break if they don't practice today.

    Identifies users who were active yesterday but not today.
    Creates a STREAK_WARNING notification for each.
    """
    stats = {"warnings_sent": 0}

    async with async_session_factory() as session:
        today = datetime.utcnow().date().isoformat()
        yesterday = (datetime.utcnow().date() - timedelta(days=1)).isoformat()

        # Find users active yesterday but not today with streak > 0
        stmt = (
            select(Streak)
            .where(
                Streak.lastActiveDate == yesterday,
                Streak.currentStreak > 0,
            )
        )

        result = await session.execute(stmt)
        at_risk = result.scalars().all()

        for streak in at_risk:
            try:
                notif = Notification(
                    userId=streak.userId,
                    type="STREAK_WARNING",
                    title="🔥 Streak ở nguy hiểm!",
                    body=f"Bạn đang có chuỗi {streak.currentStreak} ngày! "
                         f"Hãy luyện tập hôm nay để duy trì streak.",
                )
                session.add(notif)
                stats["warnings_sent"] += 1

            except Exception as e:
                logger.error(f"Failed to warn user {streak.userId}: {e}")

        await session.commit()

    logger.info(f"Streak warning cron: {stats['warnings_sent']} warnings sent")
    return stats


async def run_weekly_reset_cron(redis_client) -> dict:
    """
    Sunday midnight job: reset weekly leaderboard and replenish streak freezes.
    """
    stats = {"leaderboard_reset": False, "freezes_replenished": 0}

    # Reset weekly leaderboard
    try:
        await redis_client.delete("leaderboard:weekly")
        stats["leaderboard_reset"] = True
        logger.info("Weekly leaderboard reset")
    except Exception as e:
        logger.error(f"Failed to reset leaderboard: {e}")

    # Replenish streak freezes
    async with async_session_factory() as session:
        try:
            # PRO users get 1 freeze, UNLIMITED get 3
            for tier, freezes in [("PRO", 1), ("UNLIMITED", 3)]:
                stmt = (
                    select(User.id)
                    .where(User.tier == tier, User.status == "ACTIVE")
                )
                result = await session.execute(stmt)
                user_ids = [row[0] for row in result.all()]

                if user_ids:
                    update_stmt = (
                        update(Streak)
                        .where(Streak.userId.in_(user_ids))
                        .values(freezesRemaining=freezes)
                    )
                    await session.execute(update_stmt)
                    stats["freezes_replenished"] += len(user_ids)

            await session.commit()

        except Exception as e:
            logger.error(f"Failed to replenish freezes: {e}")
            await session.rollback()

    logger.info(
        f"Weekly reset: leaderboard={'✓' if stats['leaderboard_reset'] else '✗'}, "
        f"freezes={stats['freezes_replenished']}"
    )
    return stats


async def run_vocab_review_cron(redis_client) -> dict:
    """
    Daily job: check UserVocabulary items due for SM-2 review
    and create REVIEW_DUE notifications.
    """
    stats = {"notifications_created": 0}

    async with async_session_factory() as session:
        today = datetime.utcnow()

        # Count due vocab items per user
        stmt = (
            select(
                UserVocabulary.userId,
                func.count(UserVocabulary.id).label("due_count"),
            )
            .where(UserVocabulary.nextReviewAt <= today)
            .group_by(UserVocabulary.userId)
            .having(func.count(UserVocabulary.id) >= 5)  # Only notify if 5+ due
        )

        result = await session.execute(stmt)
        due_users = result.all()

        for user_id, due_count in due_users:
            try:
                notif = Notification(
                    userId=user_id,
                    type="REVIEW_DUE",
                    title="📚 Từ vựng cần ôn tập",
                    body=f"Bạn có {due_count} từ vựng cần ôn tập hôm nay!",
                )
                session.add(notif)
                stats["notifications_created"] += 1

            except Exception as e:
                logger.error(f"Failed to notify user {user_id}: {e}")

        # Active Vocabulary Forcing: populate `vocab_force:{userId}` with top 3 due items
        try:
            force_stmt = (
                select(UserVocabulary)
                .where(UserVocabulary.nextReviewAt <= today)
                .order_by(UserVocabulary.nextReviewAt.asc())
            )
            force_result = await session.execute(force_stmt)
            due_vocab_all = force_result.scalars().all()

            # Group by user id
            user_vocab_map = {}
            for v in due_vocab_all:
                if v.userId not in user_vocab_map:
                    user_vocab_map[v.userId] = []
                user_vocab_map[v.userId].append(v.word)

            for uid, words in user_vocab_map.items():
                top_3 = words[:3]
                key = f"vocab_force:{uid}"
                await redis_client.delete(key)
                if top_3:
                    await redis_client.rpush(key, *top_3)
                await redis_client.expire(key, 86400) # 24h TTL
        except Exception as e:
            logger.error(f"Failed to populate vocab force lists: {e}")

        await session.commit()

    logger.info(f"Vocab review cron: {stats['notifications_created']} notifications")
    return stats
