import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from './email.service';
import { WebSocketGateway } from './websocket.gateway';
import {
  CreateNotificationDto,
  BulkNotificationDto,
  NotificationType,
  NotificationPriority,
} from '../dto';

export interface NotificationJob {
  id: string;
  type: NotificationType;
  recipient: string;
  subject: string;
  message: string;
  priority: NotificationPriority;
  templateId?: string;
  templateData?: Record<string, any>;
  tenantId?: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  scheduledAt?: Date;
  attempts?: number;
  maxAttempts?: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private webSocketGateway: WebSocketGateway,
    @InjectQueue('notifications') private notificationQueue: Queue,
  ) {}

  async sendNotification(dto: CreateNotificationDto): Promise<{ id: string; queued: boolean }> {
    try {
      // Create notification record
      const notification = await this.prisma.notification.create({
        data: {
          type: dto.type,
          recipient: dto.recipient,
          subject: dto.subject,
          message: dto.message,
          priority: dto.priority || NotificationPriority.MEDIUM,
          status: 'PENDING',
          templateId: dto.templateId,
          templateData: dto.templateData ? JSON.stringify(dto.templateData) : null,
          tenantId: dto.tenantId,
          userId: dto.userId,
          entityId: dto.entityId,
          entityType: dto.entityType,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          attempts: 0,
          maxAttempts: 3,
        },
      });

      // Queue the notification for processing
      const job: NotificationJob = {
        id: notification.id,
        type: dto.type,
        recipient: dto.recipient,
        subject: dto.subject,
        message: dto.message,
        priority: dto.priority || NotificationPriority.MEDIUM,
        templateId: dto.templateId,
        templateData: dto.templateData,
        tenantId: dto.tenantId,
        userId: dto.userId,
        entityId: dto.entityId,
        entityType: dto.entityType,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        attempts: 0,
        maxAttempts: 3,
      };

      const delay = dto.scheduledAt 
        ? new Date(dto.scheduledAt).getTime() - Date.now()
        : 0;

      await this.notificationQueue.add('send-notification', job, {
        delay: Math.max(0, delay),
        priority: this.getPriorityValue(dto.priority || NotificationPriority.MEDIUM),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(`Notification queued: ${notification.id} (${dto.type})`);

      return {
        id: notification.id,
        queued: true,
      };
    } catch (error) {
      this.logger.error('Failed to queue notification:', error);
      throw error;
    }
  }

  async sendBulkNotifications(dto: BulkNotificationDto): Promise<{ queued: number; failed: number }> {
    let queued = 0;
    let failed = 0;

    for (const recipient of dto.recipients) {
      try {
        await this.sendNotification({
          type: dto.type,
          recipient,
          subject: dto.subject,
          message: dto.message,
          templateId: dto.templateId,
          templateData: dto.templateData,
          tenantId: dto.tenantId,
        });
        queued++;
      } catch (error) {
        this.logger.error(`Failed to queue notification for ${recipient}:`, error);
        failed++;
      }
    }

    this.logger.log(`Bulk notifications: ${queued} queued, ${failed} failed`);
    return { queued, failed };
  }

  async getNotifications(
    tenantId?: string,
    userId?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          recipient: true,
          subject: true,
          message: true,
          priority: true,
          status: true,
          deliveredAt: true,
          readAt: true,
          entityId: true,
          entityType: true,
          createdAt: true,
          scheduledAt: true,
          attempts: true,
          errorMessage: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string, userId?: string): Promise<boolean> {
    try {
      const where: any = { id: notificationId };
      if (userId) where.userId = userId;

      await this.prisma.notification.update({
        where,
        data: {
          readAt: new Date(),
          status: 'READ',
        },
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  async getDeliveryStatus(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        status: true,
        deliveredAt: true,
        readAt: true,
        attempts: true,
        maxAttempts: true,
        errorMessage: true,
        createdAt: true,
        scheduledAt: true,
      },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  async getNotificationStats(tenantId?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;

    const [total, pending, delivered, failed, read] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.notification.count({ where: { ...where, status: 'DELIVERED' } }),
      this.prisma.notification.count({ where: { ...where, status: 'FAILED' } }),
      this.prisma.notification.count({ where: { ...where, status: 'READ' } }),
    ]);

    const deliveryRate = total > 0 ? ((delivered + read) / total) * 100 : 0;

    return {
      total,
      pending,
      delivered,
      failed,
      read,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
    };
  }

  // Helper method to send real-time notifications
  async sendRealTimeNotification(
    tenantId: string,
    userId: string,
    event: string,
    data: any,
  ) {
    // Send via WebSocket
    const sent = await this.webSocketGateway.sendToUser(userId, event, data);
    
    if (!sent) {
      // User not connected, queue as regular notification
      await this.sendNotification({
        type: NotificationType.WEBSOCKET,
        recipient: userId,
        subject: event,
        message: JSON.stringify(data),
        tenantId,
        userId,
      });
    }
  }

  // Helper method to send schedule update notifications
  async sendScheduleUpdateNotification(
    tenantId: string,
    scheduleId: string,
    scheduleName: string,
    changes: string[],
    affectedUsers: string[],
  ) {
    // Send real-time notification
    await this.webSocketGateway.sendScheduleUpdate(tenantId, scheduleId, {
      scheduleName,
      changes,
    });

    // Send email notifications to affected users
    for (const userId of affectedUsers) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (user?.email) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        });

        await this.emailService.sendScheduleNotification(
          user.email,
          scheduleName,
          changes,
          tenant?.name || 'School',
        );
      }
    }
  }

  private getPriorityValue(priority: NotificationPriority): number {
    switch (priority) {
      case NotificationPriority.URGENT:
        return 1;
      case NotificationPriority.HIGH:
        return 2;
      case NotificationPriority.MEDIUM:
        return 3;
      case NotificationPriority.LOW:
        return 4;
      default:
        return 3;
    }
  }
}

