"""
Dry-run script to extract large text data from PostgreSQL
and load it into MongoDB.
Run this script to migrate existing Beta phase data before
running TypeORM migrations.
"""

import asyncio
import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Import database factories from worker
from database import async_session_factory, mongo_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DataMigration")

async def migrate_conversations():
    async with async_session_factory() as db:
        # Fetch rows containing data
        result = await db.execute(text("""
            SELECT id, "userId", transcript, "userTranscript", highlights, improvements, "vietnameseAdvice"
            FROM conversations
            WHERE transcript IS NOT NULL OR highlights IS NOT NULL
        """))

        rows = result.fetchall()
        logger.info(f"Found {len(rows)} conversations to migrate.")

        success_count = 0
        for row in rows:
            try:
                # Load JSON strings back to dict/list if they are strings
                highlights = json.loads(row.highlights) if row.highlights and isinstance(row.highlights, str) else row.highlights
                improvements = json.loads(row.improvements) if row.improvements and isinstance(row.improvements, str) else row.improvements

                doc = {
                    "conversationId": str(row.id),
                    "userId": str(row.userId),
                    "transcript": row.transcript,
                    "userTranscript": row.userTranscript,
                    "highlights": json.dumps(highlights) if highlights else "[]",
                    "improvements": json.dumps(improvements) if improvements else "[]",
                    "vietnameseAdvice": row.vietnameseAdvice
                }

                await mongo_db.conversations.update_one(
                    {"conversationId": str(row.id)},
                    {"$set": doc},
                    upsert=True
                )
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to migrate conversation {row.id}: {e}")

        logger.info(f"Successfully migrated {success_count}/{len(rows)} conversations to MongoDB.")

async def migrate_audit_logs():
    async with async_session_factory() as db:
        result = await db.execute(text("""
            SELECT id, "adminId", "targetUserId", action, reason, "changeSnapshot"
            FROM admin_audit_logs
            WHERE "changeSnapshot" IS NOT NULL
        """))

        rows = result.fetchall()
        logger.info(f"Found {len(rows)} audit logs to migrate.")

        success_count = 0
        for row in rows:
            try:
                snapshot = json.loads(row.changeSnapshot) if isinstance(row.changeSnapshot, str) else row.changeSnapshot

                doc = {
                    "auditLogId": str(row.id),
                    "adminId": str(row.adminId),
                    "targetUserId": str(row.targetUserId),
                    "action": row.action,
                    "reason": row.reason,
                    "changeSnapshot": snapshot
                }

                await mongo_db.admin_audit_logs.update_one(
                    {"auditLogId": str(row.id)},
                    {"$set": doc},
                    upsert=True
                )
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to migrate audit log {row.id}: {e}")

        logger.info(f"Successfully migrated {success_count}/{len(rows)} audit logs to MongoDB.")

async def run_migration():
    logger.info("Starting Data Migration (PostgreSQL -> MongoDB)...")
    await migrate_conversations()
    await migrate_audit_logs()
    logger.info("Data Migration completed.")

if __name__ == "__main__":
    asyncio.run(run_migration())
