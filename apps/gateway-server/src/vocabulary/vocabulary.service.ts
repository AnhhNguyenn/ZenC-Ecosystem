import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, LessThan } from 'typeorm';
import { Vocabulary, UserVocabulary } from '../entities';

/** Mastery level numeric constants */
const MASTERY = {
  NEW: 0,
  LEARNING: 20,
  REVIEWING: 50,
  MASTERED: 80,
} as const;


/**
 * VocabularyService – Word bank and SM-2 spaced repetition engine.
 *
 * Implements the SuperMemo-2 algorithm exactly as published by Piotr Woźniak:
 *
 * After each review with quality q (0-5):
 * EF' = EF + (0.1 - (5 - q) × (0.08 + (5 - q) × 0.02))
 * EF = max(1.3, EF')
 *
 * If q >= 3 (correct):
 *   n=0: interval = 1 day
 *   n=1: interval = 6 days
 *   n≥2: interval = round(previous_interval × EF)
 *
 * If q < 3 (incorrect):
 *   Reset repetition count to 0, interval to 1 day
 *   (EF still updated)
 *
 * Mastery progression: NEW → LEARNING → REVIEWING → MASTERED
 */
@Injectable()
export class VocabularyService {
  private readonly logger = new Logger(VocabularyService.name);

  constructor(
    @InjectRepository(Vocabulary) private readonly vocabRepo: Repository<Vocabulary>,
    @InjectRepository(UserVocabulary) private readonly userVocabRepo: Repository<UserVocabulary>,
  ) {}

  /**
   * Browse vocabulary catalog with filtering.
   * Returns words WITHOUT user-specific progress data.
   */
  async browseCatalog(
    level?: string,
    category?: string,
    page: number = 1,
    limit: number = 30,
  ): Promise<{ words: Vocabulary[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (level) where.level = level;
    if (category) where.category = category;

    const [words, total] = await this.vocabRepo.findAndCount({
      where,
      order: { difficultyRating: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { words, total };
  }

  /**
   * Get user's personal word bank with mastery progress.
   */
  async getUserBank(
    userId: string,
    masteryFilter?: string,
    page: number = 1,
    limit: number = 30,
  ): Promise<{
    words: Array<UserVocabulary & { vocabulary: Vocabulary }>;
    total: number;
    stats: { total: number; mastered: number; learning: number; new_: number };
  }> {
    const where: Record<string, unknown> = { userId };
    if (masteryFilter) where.masteryLevel = masteryFilter;

    const [words, total] = await this.userVocabRepo.findAndCount({
      where,
      relations: ['vocabulary'],
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Aggregate stats using numeric ranges
    const totalCount = await this.userVocabRepo.count({ where: { userId } });
    const masteredCount = await this.userVocabRepo.count({
      where: { userId, masteryLevel: MoreThanOrEqual(MASTERY.MASTERED) },
    });
    const learningCount = await this.userVocabRepo.count({
      where: [
        { userId, masteryLevel: MoreThanOrEqual(MASTERY.LEARNING) },
      ],
    });
    const newCount = await this.userVocabRepo.count({
      where: { userId, masteryLevel: LessThan(MASTERY.LEARNING) },
    });

    return {
      words: words as Array<UserVocabulary & { vocabulary: Vocabulary }>,
      total,
      stats: {
        total: totalCount,
        mastered: masteredCount,
        learning: learningCount - masteredCount,
        new_: newCount,
      },
    };
  }

  /** Add a word to user's personal bank */
  async addToBank(userId: string, vocabularyId: string): Promise<UserVocabulary> {
    const vocab = await this.vocabRepo.findOne({ where: { id: vocabularyId } });
    if (!vocab) throw new NotFoundException('Word not found');

    const existing = await this.userVocabRepo.findOne({
      where: { userId, vocabularyId },
    });
    if (existing) throw new BadRequestException('Word already in your bank');

    const userVocab = this.userVocabRepo.create({
      userId,
      vocabularyId,
      masteryLevel: MASTERY.NEW,
      nextReviewAt: new Date(), // Available for immediate review
      intervalDays: 1,
      easinessFactor: 2.5,
    });

    return this.userVocabRepo.save(userVocab);
  }

  /**
   * Get due flashcards for review (SM-2 scheduled).
   * Returns words where nextReviewAt <= now, ordered by urgency.
   */
  async getDueReviews(
    userId: string,
    limit: number = 20,
  ): Promise<Array<UserVocabulary & { vocabulary: Vocabulary }>> {
    const due = await this.userVocabRepo.find({
      where: {
        userId,
        nextReviewAt: LessThanOrEqual(new Date()),
      },
      relations: ['vocabulary'],
      order: { nextReviewAt: 'ASC' },
      take: limit,
    });

    return due as Array<UserVocabulary & { vocabulary: Vocabulary }>;
  }

  /**
   * Submit a flashcard review result and apply SM-2 algorithm.
   *
   * @param quality - User's self-rating 0-5:
   *   0: Complete blackout, no memory
   *   1: Wrong answer, correct one seemed familiar
   *   2: Wrong answer, correct one was easy to recall
   *   3: Correct with serious difficulty
   *   4: Correct after hesitation
   *   5: Perfect response, no hesitation
   */
  async submitReview(
    userId: string,
    userVocabularyId: string,
    quality: number,
  ): Promise<{
    nextReviewAt: Date;
    intervalDays: number;
    masteryLevel: number;
    easinessFactor: number;
  }> {
    if (quality < 0 || quality > 5) {
      throw new BadRequestException('Quality must be 0-5');
    }

    const userVocab = await this.userVocabRepo.findOne({
      where: { id: userVocabularyId, userId },
    });

    if (!userVocab) throw new NotFoundException('Word not found in your bank');

    // ── Apply SM-2 Algorithm ──────────────────────────────────
    const result = this._applySM2(userVocab, quality);

    // Update record
    userVocab.easinessFactor = result.easinessFactor;
    userVocab.intervalDays = result.intervalDays;
    userVocab.nextReviewAt = result.nextReviewAt;
    userVocab.repetitionCount = result.repetitionCount;
    userVocab.totalReviews += 1;
    userVocab.masteryLevel = result.masteryLevel;

    if (quality >= 3) {
      userVocab.consecutiveCorrect += 1;
      userVocab.totalCorrect += 1;
    } else {
      userVocab.consecutiveCorrect = 0;
    }

    await this.userVocabRepo.save(userVocab);

    return {
      nextReviewAt: result.nextReviewAt,
      intervalDays: result.intervalDays,
      masteryLevel: result.masteryLevel,
      easinessFactor: result.easinessFactor,
    };
  }

  /**
   * SM-2 Algorithm Implementation.
   *
   * Precisely follows Woźniak's original formulas.
   * This is the same algorithm used by Anki, SuperMemo, and Mnemosyne.
   */
  private _applySM2(
    uv: UserVocabulary,
    quality: number,
  ): {
    easinessFactor: number;
    intervalDays: number;
    repetitionCount: number;
    nextReviewAt: Date;
    masteryLevel: number;
  } {
    // ── Update Easiness Factor ────────────────────────────────
    let ef = Number(uv.easinessFactor);
    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    ef = Math.max(1.3, ef); // Floor at 1.3

    let interval: number;
    let reps: number;

    if (quality >= 3) {
      // ── Correct answer ──────────────────────────────────────
      reps = uv.repetitionCount + 1;

      if (reps === 1) {
        interval = 1;
      } else if (reps === 2) {
        interval = 6;
      } else {
        interval = Math.round(uv.intervalDays * ef);
      }
    } else {
      // ── Incorrect answer → reset ────────────────────────────
      reps = 0;
      interval = 1;
    }

    // ── Calculate next review date ────────────────────────────
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    // ── Determine mastery level ───────────────────────────────
    let mastery = uv.masteryLevel;
    const consecutiveCorrect = quality >= 3 ? uv.consecutiveCorrect + 1 : 0;

    if (consecutiveCorrect >= 5 && ef >= 2.5 && interval >= 21) {
      mastery = MASTERY.MASTERED;
    } else if (consecutiveCorrect >= 3) {
      mastery = MASTERY.REVIEWING;
    } else if (uv.totalReviews > 0) {
      mastery = MASTERY.LEARNING;
    }

    return {
      easinessFactor: Math.round(ef * 100) / 100,
      intervalDays: interval,
      repetitionCount: reps,
      nextReviewAt: nextReview,
      masteryLevel: mastery,
    };
  }
}
