import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Vocabulary } from './vocabulary.entity';

/**
 * UserVocabulary Entity – Personal word bank with SM-2 spaced repetition.
 *
 * Supports two modes of vocabulary acquisition:
 * 1. Course-linked: via `vocabularyId` FK → Vocabulary entity
 * 2. Context-extracted: Word extracted from conversation transcripts (vocabularyId = null)
 *
 * SM-2 Algorithm (Piotr Woźniak, 1987):
 * - easinessFactor: starts at 2.5, min 1.3 (harder items reviewed more often)
 * - intervalDays: 1 → 6 → (previous * EF) → ...
 * - quality: user self-rating 0-5 (0-2 = fail → reset interval)
 *
 * Performance:
 * - Index on nextReviewAt for the daily cron "due items" query
 * - Index on masteryLevel for progress dashboard aggregation
 */
@Entity('user_vocabulary')
export class UserVocabulary {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  /** FK to Vocabulary (null for context-extracted words) */
  @Column({ type: 'uuid', nullable: true })
  vocabularyId!: string | null;

  @ManyToOne(() => Vocabulary, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'vocabularyId' })
  vocabulary!: Vocabulary | null;

  // ── Word Data (for context-extracted vocabulary) ─────────────

  /** The word itself (stored directly for context-extracted words) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  word!: string | null;

  /** Definition text (auto-generated or from Vocabulary FK) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  definition!: string | null;

  /** Example sentence from context or course */
  @Column({ type: 'varchar', length: 500, nullable: true })
  exampleSentence!: string | null;

  // ── SM-2 Algorithm Fields ────────────────────────────────────

  /**
   * Mastery level: 0-100 integer.
   *   0-19  = NEW
   *   20-49 = LEARNING
   *   50-79 = REVIEWING
   *   80-100 = MASTERED
   */
  @Index()
  @Column({ type: 'int', default: 0 })
  masteryLevel!: number;

  /** Next scheduled review date; null = never reviewed */
  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  nextReviewAt!: Date | null;

  /** Days until next review (SM-2: initial=1, then 6, then prev * EF) */
  @Column({ type: 'int', default: 1 })
  intervalDays!: number;

  /** SM-2 easiness factor (default 2.5, minimum 1.3) */
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 2.5 })
  easinessFactor!: number;

  /** Total number of successful reviews (SM-2 repetition counter) */
  @Column({ type: 'int', default: 0 })
  repetitionCount!: number;

  /** Consecutive correct recalls (resets to 0 on failure) */
  @Column({ type: 'int', default: 0 })
  consecutiveCorrect!: number;

  /** Total times this word was reviewed */
  @Column({ type: 'int', default: 0 })
  totalReviews!: number;

  /** Total correct answers for accuracy percentage calculation */
  @Column({ type: 'int', default: 0 })
  totalCorrect!: number;

  /** Last time this word was reviewed */
  @Column({ type: 'timestamptz', nullable: true })
  lastReviewedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  readonly createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  readonly updatedAt!: Date;
}

