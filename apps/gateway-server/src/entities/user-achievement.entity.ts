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
import { Achievement } from './achievement.entity';

/**
 * UserAchievement Entity – Join table recording unlocked achievements.
 *
 * Append-only: once unlocked, never modified or deleted (except GDPR wipe).
 * The unique constraint prevents duplicate unlocks.
 *
 * `notifiedAt` tracks whether the user has seen the unlock notification,
 * enabling the "New Badge!" toast on the mobile client.
 */
@Entity('user_achievements')
@Unique(['userId', 'achievementId'])
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uniqueidentifier' })
  userId!: string;

  @ManyToOne(() => Achievement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'achievementId' })
  achievement!: Achievement;

  @Column({ type: 'uniqueidentifier' })
  achievementId!: string;

  @CreateDateColumn({ type: 'datetime2' })
  readonly unlockedAt!: Date;

  /** Null until user dismisses the notification toast */
  @Column({ type: 'datetime2', nullable: true })
  notifiedAt!: Date | null;
}
