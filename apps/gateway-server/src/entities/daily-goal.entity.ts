import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

/**
 * DailyGoal Entity – Per-day XP target and progress.
 *
 * One record per user per day. Created on the user's first activity
 * each day (lazy initialization, not pre-created via cron).
 *
 * Unique constraint: (userId, date) prevents race conditions where
 * two concurrent requests create duplicate daily goal records.
 *
 * XP targets are user-configurable (like Duolingo's casual/regular/serious/insane).
 */
@Entity('daily_goals')
@Unique(['userId', 'date'])
export class DailyGoal {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uniqueidentifier' })
  userId!: string;

  /** Date this goal applies to (DATE only, no timezone issues) */
  @Index()
  @Column({ type: 'date' })
  date!: string;

  /**
   * XP target for the day. User-configurable presets:
   * CASUAL: 10 XP, REGULAR: 20 XP, SERIOUS: 50 XP, INSANE: 100 XP
   */
  @Column({ type: 'int', default: 20 })
  xpTarget!: number;

  /** XP earned so far today (updated on each qualifying activity) */
  @Column({ type: 'int', default: 0 })
  xpEarned!: number;

  /** Whether target was met today */
  @Column({ type: 'bit', default: false })
  isCompleted!: boolean;

  /** Number of lessons completed today */
  @Column({ type: 'int', default: 0 })
  lessonsCompleted!: number;

  /** Number of exercises completed today */
  @Column({ type: 'int', default: 0 })
  exercisesCompleted!: number;

  /** Voice conversation minutes today */
  @Column({ type: 'int', default: 0 })
  voiceMinutes!: number;

  /** Vocabulary reviews completed today */
  @Column({ type: 'int', default: 0 })
  vocabReviews!: number;

  @CreateDateColumn({ type: 'datetime2' })
  readonly createdAt!: Date;
}
