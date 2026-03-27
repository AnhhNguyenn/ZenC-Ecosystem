import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Notification Entity – Push notification queue.
 *
 * Stores pending and delivered notifications for each user.
 * Notifications are created server-side by various services and
 * delivered to the mobile client via:
 * 1. Socket.io push (if user is online)
 * 2. FCM/APNs push (if user is offline)
 * 3. In-app notification feed (always)
 *
 * Types:
 * - STREAK_WARNING: "Your streak is at risk! Practice today."
 * - DAILY_REMINDER: "Time for your daily English practice!"
 * - ACHIEVEMENT_UNLOCK: "🏆 You've earned: First 7-Day Streak!"
 * - LESSON_AVAILABLE: "New lesson unlocked: At the Airport"
 * - REVIEW_DUE: "You have 15 vocabulary words due for review"
 * - LEVEL_UP: "🎉 Congratulations! You've reached level 10!"
 * - SYSTEM: General system notifications
 *
 * Cleanup: Notifications older than 90 days are eligible for archival.
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 30 })
  type!:
    | 'STREAK_WARNING'
    | 'DAILY_REMINDER'
    | 'ACHIEVEMENT_UNLOCK'
    | 'LESSON_AVAILABLE'
    | 'REVIEW_DUE'
    | 'LEVEL_UP'
    | 'SYSTEM';

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 1000 })
  body!: string;

  /** Optional deep-link URL for navigation on tap */
  @Column({ type: 'varchar', length: 500, nullable: true })
  actionUrl!: string | null;

  /** Optional icon override (default uses type-specific icons) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  iconUrl!: string | null;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  /** When the notification was displayed/delivered to the user */
  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  /** Scheduled delivery time; null = deliver immediately */
  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  readonly createdAt!: Date;
}
