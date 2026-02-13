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
  @Column({ type: 'nvarchar', length: 255, unique: true })
  email!: string;

  /** Bcrypt hash – never store plaintext passwords */
  @Column({ type: 'nvarchar', length: 255 })
  passwordHash!: string;

  @Column({
    type: 'nvarchar',
    length: 20,
    default: 'FREE',
  })
  tier!: 'FREE' | 'PRO' | 'UNLIMITED';

  /**
   * Stored as integer (millitokens) rather than float to guarantee
   * precision during concurrent atomic decrements.
   */
  @Column({ type: 'int', default: 0 })
  tokenBalance!: number;

  @Column({
    type: 'nvarchar',
    length: 20,
    default: 'ACTIVE',
  })
  status!: 'ACTIVE' | 'LOCKED' | 'BANNED';

  @Column({ type: 'bit', default: false })
  isDeleted!: boolean;

  @Column({ type: 'datetime2', nullable: true })
  deletedAt!: Date | null;

  /** Hashed refresh token for rotation-based JWT refresh flow */
  @Column({ type: 'nvarchar', length: 255, nullable: true })
  refreshTokenHash!: string | null;

  @Column({ type: 'bit', default: false })
  emailVerified!: boolean;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt!: Date;
}
