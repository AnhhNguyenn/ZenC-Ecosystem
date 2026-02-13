"""
ZenC AI Worker – SQLAlchemy ORM Models (v2.0).

These models mirror the TypeORM entities in the Gateway Server.
The Worker reads/writes to exercise_attempts, user_vocabulary,
user_mistakes, streaks, notifications, and reads from users,
user_profiles for context during analysis.

Note: Table names MUST match exactly with TypeORM entity table names
to ensure both services operate on the same schema.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    DateTime,
    Boolean,
    ForeignKey,
    Index,
    Text,
)
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER, BIT
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    passwordHash = Column(String(255), nullable=False)
    displayName = Column(String(100), nullable=True)
    tier = Column(String(20), default="FREE")
    tokenBalance = Column(Integer, default=0)
    status = Column(String(20), default="ACTIVE")
    isDeleted = Column(Boolean, default=False)
    deletedAt = Column(DateTime, nullable=True)
    refreshTokenHash = Column(String(255), nullable=True)
    emailVerified = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    userId = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), unique=True)
    nativeLanguage = Column(String(50), default="vi")
    level = Column(String(2), default="A1")
    confidenceScore = Column(Float, default=0.5)
    vnSupportEnabled = Column(Boolean, default=True)
    speakingSpeed = Column(Float, default=1.0)


class UserMistake(Base):
    __tablename__ = "user_mistakes"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    userId = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), nullable=False, index=True)
    originalText = Column(String(1000), name="originalSentence", nullable=False)
    correctedText = Column(String(1000), name="correctedSentence", nullable=False)
    grammarRuleId = Column(String(50), nullable=False)
    explanation = Column(String(2000), nullable=True)
    nextReviewAt = Column(DateTime, nullable=True, index=True)
    intervalDays = Column(Integer, default=1)
    easinessFactor = Column(Float, default=2.5)
    repetitionCount = Column(Integer, default=0)
    createdAt = Column(DateTime, default=datetime.utcnow)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    userId = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), nullable=False, index=True)
    startTime = Column(DateTime, nullable=False)
    endTime = Column(DateTime, nullable=True)
    tokensConsumed = Column(Integer, name="totalTokensConsumed", default=0)
    clientIp = Column(String(45), nullable=True)
    deviceFingerprint = Column(String(512), nullable=True)
    transcript = Column(Text, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# NEW MODELS (Platform Expansion)
# ═══════════════════════════════════════════════════════════════

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    lessonId = Column(UNIQUEIDENTIFIER, ForeignKey("lessons.id"), nullable=False)
    type = Column(String(20), nullable=False)
    prompt = Column(String(2000), nullable=False)
    correctAnswer = Column(String(2000), nullable=False)
    points = Column(Integer, default=10)


class ExerciseAttempt(Base):
    __tablename__ = "exercise_attempts"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    userId = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), nullable=False, index=True)
    exerciseId = Column(UNIQUEIDENTIFIER, ForeignKey("exercises.id"), nullable=False, index=True)
    userAnswer = Column(String(2000), nullable=False)
    isCorrect = Column(Boolean, nullable=False)
    score = Column(Integer, default=0)
    xpEarned = Column(Integer, default=0)
    responseTimeMs = Column(Integer, nullable=False)
    attemptNumber = Column(Integer, default=1)
    createdAt = Column(DateTime, default=datetime.utcnow)


class UserVocabulary(Base):
    __tablename__ = "user_vocabulary"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    userId = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), nullable=False, index=True)
    vocabularyId = Column(UNIQUEIDENTIFIER, nullable=False)
    masteryLevel = Column(String(20), default="NEW")
    nextReviewAt = Column(DateTime, nullable=True, index=True)
    intervalDays = Column(Integer, default=1)
    easinessFactor = Column(Float, default=2.5)
    repetitionCount = Column(Integer, default=0)
    consecutiveCorrect = Column(Integer, default=0)
    totalReviews = Column(Integer, default=0)
    totalCorrect = Column(Integer, default=0)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Streak(Base):
    __tablename__ = "streaks"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    userId = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), unique=True)
    currentStreak = Column(Integer, default=0)
    longestStreak = Column(Integer, default=0)
    lastActiveDate = Column(String(10), nullable=True)
    freezesRemaining = Column(Integer, default=0)
    lastFreezeUsedAt = Column(String(10), nullable=True)
    totalActiveDays = Column(Integer, default=0)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DailyGoal(Base):
    __tablename__ = "daily_goals"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    userId = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(String(10), nullable=False)
    xpTarget = Column(Integer, default=20)
    xpEarned = Column(Integer, default=0)
    isCompleted = Column(Boolean, default=False)
    lessonsCompleted = Column(Integer, default=0)
    exercisesCompleted = Column(Integer, default=0)
    voiceMinutes = Column(Integer, default=0)
    vocabReviews = Column(Integer, default=0)
    createdAt = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    userId = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(30), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(String(1000), nullable=False)
    actionUrl = Column(String(500), nullable=True)
    iconUrl = Column(String(500), nullable=True)
    isRead = Column(Boolean, default=False)
    deliveredAt = Column(DateTime, nullable=True)
    scheduledAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
