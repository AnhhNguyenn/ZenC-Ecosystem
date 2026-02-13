import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Notification } from '../entities';

/**
 * NotificationsService – Notification feed and delivery management.
 *
 * Notifications are created server-side by various modules
 * (gamification, streaks, lesson unlock) and delivered via:
 * 1. In-app feed (REST API below)
 * 2. Socket.io real-time push (if user is connected)
 * 3. FCM/APNs push (future integration point)
 *
 * Pagination uses cursor-based approach (createdAt) rather than
 * offset-based to prevent skipping/duplicating during scrolling.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
  ) {}

  /** Get recent notifications for user */
  async getNotifications(
    userId: string,
    limit: number = 20,
    unreadOnly: boolean = false,
  ): Promise<{
    notifications: Notification[];
    unreadCount: number;
  }> {
    const where: Record<string, unknown> = { userId };
    if (unreadOnly) where.isRead = false;

    const notifications = await this.notifRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const unreadCount = await this.notifRepo.count({
      where: { userId, isRead: false },
    });

    return { notifications, unreadCount };
  }

  /** Mark a notification as read */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.notifRepo.update(
      { id: notificationId, userId },
      { isRead: true },
    );
  }

  /** Mark all notifications as read */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notifRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
    return { updated: result.affected ?? 0 };
  }

  /**
   * Create scheduled notification (for streak warnings, daily reminders).
   * Called by cron jobs or event handlers.
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    actionUrl?: string,
  ): Promise<Notification> {
    const notif = this.notifRepo.create({
      userId,
      type,
      title,
      body,
      actionUrl: actionUrl || null,
    } as any);
    return this.notifRepo.save(notif as any);
  }

  /** Clean up old read notifications (> 90 days) */
  async cleanup(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const result = await this.notifRepo
      .createQueryBuilder()
      .delete()
      .where('isRead = :read AND createdAt < :cutoff', {
        read: true,
        cutoff,
      })
      .execute();

    return result.affected ?? 0;
  }
}
