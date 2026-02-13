import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Achievement Entity – Badge/trophy definitions.
 *
 * Immutable after creation (admin can update display text but not conditions).
 * Each achievement has a machine-readable condition that the gamification
 * service evaluates after qualifying events.
 *
 * Condition format: JSON serialized rules engine:
 * {
 *   "type": "STREAK_DAYS",    // trigger type
 *   "threshold": 7,           // numeric requirement
 *   "comparison": ">="        // comparison operator
 * }
 *
 * Supported condition types:
 * - STREAK_DAYS: consecutive active days
 * - LESSONS_COMPLETED: total lessons finished
 * - EXERCISES_PERFECT: exercises with 100% score
 * - VOCAB_MASTERED: words at MASTERED level
 * - XP_TOTAL: lifetime XP earned
 * - VOICE_MINUTES: total conversation time
 * - COURSE_COMPLETED: finished an entire course
 */
@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'nvarchar', length: 100 })
  name!: string;

  @Column({ type: 'nvarchar', length: 500 })
  description!: string;

  /** CDN URL to badge icon asset */
  @Column({ type: 'nvarchar', length: 500 })
  iconUrl!: string;

  /** Rarity tier affects UI display (golden border, sparkle animation, etc.) */
  @Column({ type: 'nvarchar', length: 20, default: 'COMMON' })
  rarity!: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

  /** JSON-serialized unlock condition – evaluated by gamification service */
  @Column({ type: 'nvarchar', length: 'MAX' })
  conditionJson!: string;

  /** XP bonus awarded when achievement is unlocked */
  @Column({ type: 'int', default: 50 })
  xpBonus!: number;

  /** Display order in the achievements gallery */
  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  /** Hidden achievements are revealed only upon unlock (surprise delight) */
  @Column({ type: 'bit', default: false })
  isHidden!: boolean;

  @CreateDateColumn({ type: 'datetime2' })
  readonly createdAt!: Date;
}
