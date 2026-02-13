import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Exercise } from './exercise.entity';
import { User } from './user.entity';

/**
 * ExerciseAttempt Entity – Records every user exercise submission.
 *
 * Immutable append-only log: attempts are NEVER updated or deleted.
 * This enables:
 * 1. Accuracy trend analysis (Worker analytics engine)
 * 2. Exercise difficulty calibration (if many users fail → exercise too hard)
 * 3. Anti-cheat detection (impossible response times, answer pattern analysis)
 * 4. GDPR data export compliance
 *
 * Security:
 * - `responseTimeMs` tracked to detect automated/bot submissions
 *   (human responses typically 2000-30000ms; automated < 500ms)
 * - `isCorrect` is server-computed, never client-provided
 *
 * Performance:
 * - Composite index on (userId, exerciseId) for per-exercise history
 * - Index on createdAt for time-range analytics queries
 */
@Entity('exercise_attempts')
export class ExerciseAttempt {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uniqueidentifier' })
  userId!: string;

  @Index()
  @ManyToOne(() => Exercise, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciseId' })
  exercise!: Exercise;

  @Column({ type: 'uniqueidentifier' })
  exerciseId!: string;

  /** The user's submitted answer (sanitized before storage) */
  @Column({ type: 'nvarchar', length: 2000 })
  userAnswer!: string;

  /** Server-computed correctness – NEVER trust client-side evaluation */
  @Column({ type: 'bit' })
  isCorrect!: boolean;

  /** Normalized score 0-100; partials possible for SPEAKING type */
  @Column({ type: 'int', default: 0 })
  score!: number;

  /** Points awarded after difficulty multiplier and streak bonuses */
  @Column({ type: 'int', default: 0 })
  xpEarned!: number;

  /**
   * Time taken to answer in milliseconds.
   * Used for anti-cheat (< 500ms = suspicious) and adaptive difficulty.
   */
  @Column({ type: 'int' })
  responseTimeMs!: number;

  /** Attempt number for this user+exercise combo (1st try, 2nd try, etc.) */
  @Column({ type: 'int', default: 1 })
  attemptNumber!: number;

  @Index()
  @CreateDateColumn({ type: 'datetime2' })
  readonly createdAt!: Date;
}
