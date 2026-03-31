import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';

/**
 * User Entity – Core account record for every ZenC AI platform user.
 *
 * Design decisions:
 * - UUID primary key for distributed-safe ID generation (no auto-increment collisions).
 * - Email is indexed for O(1) login lookups; unique constraint prevents duplicates.
 * - TokenBalance uses integer (millitokens) to avoid floating-point arithmetic drift
 *   during high-frequency atomic updates.
 * - Soft-delete pattern (isDeleted + deletedAt) satisfies GDPR data-retention
 *   requirements while keeping referential integrity intact.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  /** Bcrypt hash – never store plaintext passwords */
  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'FREE',
  })
  tier!: 'FREE' | 'PRO' | 'UNLIMITED';

  /**
   * Stored as integer (millitokens) rather than float to guarantee
   * precision during concurrent atomic decrements.
   */
  @Index()
  @Column({ type: 'int', default: 0 })
  tokenBalance!: number;

  /** Used for gamification leaderboard/progress tracking */
  @Index()
  @Column({ type: 'int', default: 0 })
  totalXp!: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'ACTIVE',
  })
  status!: 'ACTIVE' | 'LOCKED' | 'BANNED';

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  /** Hashed refresh token for rotation-based JWT refresh flow */
  @Column({ type: 'varchar', length: 255, nullable: true })
  refreshTokenHash!: string | null;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
