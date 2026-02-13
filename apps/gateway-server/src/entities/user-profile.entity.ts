import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * UserProfile Entity – Stores learner-specific adaptive settings.
 *
 * Design decisions:
 * - One-to-One with User via unique FK. Separated from User to keep
 *   the auth table lean (User is queried on every JWT validation).
 * - ConfidenceScore stored as decimal(5,4) for fine-grained adaptive
 *   prompt switching (thresholds at 0.4 and 0.8).
 * - SpeakingSpeedMultiplier clamped 0.8–1.2 at application layer;
 *   DB stores the raw value.
 */
@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uniqueidentifier' })
  userId!: string;

  /**
   * CEFR level: A1 → C2.
   * Used by the adaptive prompt engine to calibrate vocabulary complexity.
   */
  @Column({
    type: 'nvarchar',
    length: 2,
    default: 'A1',
  })
  currentLevel!: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

  /**
   * Confidence score between 0.0 and 1.0.
   * Drives the adaptive prompt switch:
   *   < 0.4 → Vietnamese explanations
   *   > 0.8 → English only
   *   else  → balanced mode
   */
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.5 })
  confidenceScore!: number;

  /** When true, Vietnamese hints are injected into AI prompts */
  @Column({ type: 'bit', default: true })
  vnSupportEnabled!: boolean;

  /**
   * Controls AI speech output speed. Clamped to 0.8–1.2 at the
   * application layer to prevent unusable extremes.
   */
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  speakingSpeedMultiplier!: number;
}
