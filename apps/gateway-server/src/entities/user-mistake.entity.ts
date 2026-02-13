import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * UserMistake Entity – Tracks individual grammar/pronunciation errors
 * discovered by the Deep Brain (Python Worker) during post-session analysis.
 *
 * Design decisions:
 * - GrammarRuleID is a string identifier (e.g. "SVA-001" for Subject-Verb
 *   Agreement) enabling the frontend to show rule-specific tutorials.
 * - NextReviewAt drives the SuperMemo-2 spaced repetition scheduler;
 *   a daily cron in the Worker pushes due items to Redis `daily_review:{userId}`.
 * - Indexed on userId + nextReviewAt for efficient "due today" queries.
 */
@Entity('user_mistakes')
export class UserMistake {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uniqueidentifier' })
  userId!: string;

  @Column({ type: 'nvarchar', length: 1000 })
  originalSentence!: string;

  @Column({ type: 'nvarchar', length: 1000 })
  correctedSentence!: string;

  /** Rule identifier for frontend tutorial linking (e.g. "SVA-001") */
  @Column({ type: 'nvarchar', length: 50 })
  grammarRuleId!: string;

  /**
   * SuperMemo-2 scheduling field: next review timestamp.
   * Worker cron queries WHERE nextReviewAt <= NOW() daily.
   */
  @Index()
  @Column({ type: 'datetime2', nullable: true })
  nextReviewAt!: Date | null;

  /** SM-2 interval in days – doubles on successful recall */
  @Column({ type: 'int', default: 1 })
  intervalDays!: number;

  /** SM-2 easiness factor (default 2.5, min 1.3) */
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 2.5 })
  easinessFactor!: number;

  /** Number of consecutive correct recalls */
  @Column({ type: 'int', default: 0 })
  repetitionCount!: number;
}
