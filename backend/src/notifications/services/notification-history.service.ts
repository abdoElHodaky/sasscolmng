import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { 
  Notification, 
  NotificationStatus, 
  NotificationType, 
  NotificationPriority,
  Prisma 
} from '@prisma/client';

export interface NotificationHistoryQueryDto {
  userId?: string;
  type?: NotificationType;
  status?: NotificationStatus;
  priority?: NotificationPriority;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface NotificationHistoryResponseDto {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  subject?: string;
  content: string;
  recipientEmail?: string;
  recipientPhone?: string;
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
  template?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface NotificationStatsDto {
  totalNotifications: number;
  sentNotifications: number;
  deliveredNotifications: number;
  failedNotifications: number;
  readNotifications: number;
  deliveryRate: number;
  readRate: number;
  byType: Record<NotificationType, number>;
  byStatus: Record<NotificationStatus, number>;
  byPriority: Record<NotificationPriority, number>;
  recentActivity: Array<{
    date: string;
    sent: number;
    delivered: number;
    failed: number;
  }>;
}

@Injectable()
export class NotificationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get notification history for a user or tenant
   */
  async getNotificationHistory(
    tenantId: string,
    query: NotificationHistoryQueryDto = {},
  ): Promise<{
    notifications: NotificationHistoryResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      userId,
      type,
      status,
      priority,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      search,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.NotificationWhereInput = {
      tenantId,
      ...(userId && { recipientId: userId }),
      ...(type && { type }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(startDate && endDate && {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { recipientEmail: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Execute queries
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications: notifications.map(this.formatNotificationResponse),
      total,
      page,
      limit,
    };
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(
    tenantId: string,
    notificationId: string,
  ): Promise<NotificationHistoryResponseDto> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        tenantId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.formatNotificationResponse(notification);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    tenantId: string,
    notificationId: string,
    userId: string,
  ): Promise<NotificationHistoryResponseDto> {
    // Verify notification belongs to user and tenant
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        tenantId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Update notification status
    const updatedNotification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return this.formatNotificationResponse(updatedNotification);
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(
    tenantId: string,
    notificationIds: string[],
    userId: string,
  ): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        tenantId,
        recipientId: userId,
        status: { not: NotificationStatus.READ },
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  /**
   * Delete notification from history
   */
  async deleteNotification(
    tenantId: string,
    notificationId: string,
    userId?: string,
  ): Promise<void> {
    const where: Prisma.NotificationWhereInput = {
      id: notificationId,
      tenantId,
      ...(userId && { recipientId: userId }),
    };

    const notification = await this.prisma.notification.findFirst({ where });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(
    tenantId: string,
    options: {
      userId?: string;
      startDate?: string;
      endDate?: string;
      groupBy?: 'day' | 'week' | 'month';
    } = {},
  ): Promise<NotificationStatsDto> {
    const { userId, startDate, endDate, groupBy = 'day' } = options;

    const where: Prisma.NotificationWhereInput = {
      tenantId,
      ...(userId && { recipientId: userId }),
      ...(startDate && endDate && {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    // Get basic counts
    const [
      totalNotifications,
      sentNotifications,
      deliveredNotifications,
      failedNotifications,
      readNotifications,
    ] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, status: { in: [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ] } },
      }),
      this.prisma.notification.count({
        where: { ...where, status: { in: [NotificationStatus.DELIVERED, NotificationStatus.READ] } },
      }),
      this.prisma.notification.count({
        where: { ...where, status: NotificationStatus.FAILED },
      }),
      this.prisma.notification.count({
        where: { ...where, status: NotificationStatus.READ },
      }),
    ]);

    // Get counts by type
    const byTypeResults = await this.prisma.notification.groupBy({
      by: ['type'],
      where,
      _count: { id: true },
    });

    const byType = Object.values(NotificationType).reduce((acc, type) => {
      acc[type] = byTypeResults.find(r => r.type === type)?._count.id || 0;
      return acc;
    }, {} as Record<NotificationType, number>);

    // Get counts by status
    const byStatusResults = await this.prisma.notification.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const byStatus = Object.values(NotificationStatus).reduce((acc, status) => {
      acc[status] = byStatusResults.find(r => r.status === status)?._count.id || 0;
      return acc;
    }, {} as Record<NotificationStatus, number>);

    // Get counts by priority
    const byPriorityResults = await this.prisma.notification.groupBy({
      by: ['priority'],
      where,
      _count: { id: true },
    });

    const byPriority = Object.values(NotificationPriority).reduce((acc, priority) => {
      acc[priority] = byPriorityResults.find(r => r.priority === priority)?._count.id || 0;
      return acc;
    }, {} as Record<NotificationPriority, number>);

    // Get recent activity (last 7 days by default)
    const activityStartDate = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activityEndDate = endDate ? new Date(endDate) : new Date();

    const recentActivity = await this.getRecentActivity(
      tenantId,
      activityStartDate,
      activityEndDate,
      groupBy,
      userId,
    );

    // Calculate rates
    const deliveryRate = totalNotifications > 0 ? (deliveredNotifications / totalNotifications) * 100 : 0;
    const readRate = deliveredNotifications > 0 ? (readNotifications / deliveredNotifications) * 100 : 0;

    return {
      totalNotifications,
      sentNotifications,
      deliveredNotifications,
      failedNotifications,
      readNotifications,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      readRate: Math.round(readRate * 100) / 100,
      byType,
      byStatus,
      byPriority,
      recentActivity,
    };
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        tenantId,
        recipientId: userId,
        status: { in: [NotificationStatus.SENT, NotificationStatus.DELIVERED] },
      },
    });
  }

  /**
   * Clean up old notifications (called by cron job)
   */
  async cleanupOldNotifications(retentionDays: number = 90): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: [NotificationStatus.DELIVERED, NotificationStatus.READ, NotificationStatus.FAILED] },
      },
    });

    return { deleted: result.count };
  }

  // Private helper methods

  private formatNotificationResponse(
    notification: Notification & {
      template?: { id: string; name: string; type: string } | null;
    },
  ): NotificationHistoryResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      status: notification.status,
      subject: notification.subject,
      content: notification.content,
      recipientEmail: notification.recipientEmail,
      recipientPhone: notification.recipientPhone,
      scheduledFor: notification.scheduledFor,
      sentAt: notification.sentAt,
      deliveredAt: notification.deliveredAt,
      readAt: notification.readAt,
      failureReason: notification.failureReason,
      retryCount: notification.retryCount,
      createdAt: notification.createdAt,
      template: notification.template ? {
        id: notification.template.id,
        name: notification.template.name,
        type: notification.template.type,
      } : undefined,
    };
  }

  private async getRecentActivity(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month',
    userId?: string,
  ) {
    // This is a simplified version - in a real implementation, you'd use database-specific
    // date functions to group by day/week/month
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const activity = [];

    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const where: Prisma.NotificationWhereInput = {
        tenantId,
        ...(userId && { recipientId: userId }),
        createdAt: {
          gte: date,
          lt: nextDate,
        },
      };

      const [sent, delivered, failed] = await Promise.all([
        this.prisma.notification.count({
          where: { ...where, status: { in: [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ] } },
        }),
        this.prisma.notification.count({
          where: { ...where, status: { in: [NotificationStatus.DELIVERED, NotificationStatus.READ] } },
        }),
        this.prisma.notification.count({
          where: { ...where, status: NotificationStatus.FAILED },
        }),
      ]);

      activity.push({
        date: date.toISOString().split('T')[0],
        sent,
        delivered,
        failed,
      });
    }

    return activity;
  }
}
