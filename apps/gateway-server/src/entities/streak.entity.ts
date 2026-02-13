import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Streak Entity – Daily activity tracking for gamification.
 *
 * One record per user (1:1). Updated on every qualifying activity.
 * A "qualifying activity" is defined as:
 * - Completing a lesson
 * - Reviewing vocabulary flashcards
 * - Having a voice conversation (≥ 2 minutes)
 * - Completing daily goal
 *
 * Streak freeze: PRO/UNLIMITED users get 1 freeze per week.
 * Using a freeze preserves the streak without activity.
 *
 * Timezone-aware: `lastActiveDate` is stored as DATE (no time component)
 * in the user's configured timezone to prevent midnight-edge-case bugs
 * where server time vs. user time causes false streak breaks.
 */
@Entity('streaks')
export class Streak {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index({ unique: true })
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uniqueidentifier' })
  userId!: string;

  /** Current consecutive active days */
  @Column({ type: 'int', default: 0 })
  currentStreak!: number;

  /** Longest streak ever achieved (personal record) */
  @Column({ type: 'int', default: 0 })
  longestStreak!: number;

  /** Last date the user was active (DATE only, no time) */
  @Column({ type: 'date', nullable: true })
  lastActiveDate!: string | null;

  /** Number of streak freezes remaining this week (PRO: 1, UNLIMITED: 3, FREE: 0) */
  @Column({ type: 'int', default: 0 })
  freezesRemaining!: number;

  /** Date of last freeze usage – prevents multiple freeze uses per day */
  @Column({ type: 'date', nullable: true })
  lastFreezeUsedAt!: string | null;

  /** Total lifetime active days (not necessarily consecutive) */
  @Column({ type: 'int', default: 0 })
  totalActiveDays!: number;

  @UpdateDateColumn({ type: 'datetime2' })
  readonly updatedAt!: Date;
}
