import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { PushService } from './push.service';
import { WebSocketGateway } from './websocket.gateway';
import { NotificationJob } from './notification.service';
import { NotificationType } from '../dto';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private smsService: SmsService,
    private pushService: PushService,
    private webSocketGateway: WebSocketGateway,
  ) {}

  @Process('send-notification')
  async handleSendNotification(job: Job<NotificationJob>) {
    const { data } = job;
    this.logger.log(`Processing notification: ${data.id} (${data.type})`);

    try {
      // Update attempts count
      await this.prisma.notification.update({
        where: { id: data.id },
        data: {
          attempts: { increment: 1 },
          status: 'PROCESSING',
        },
      });

      let success = false;
      let errorMessage = '';

      // Process based on notification type
      switch (data.type) {
        case NotificationType.EMAIL:
          success = await this.sendEmailNotification(data);
          break;

        case NotificationType.WEBSOCKET:
          success = await this.sendWebSocketNotification(data);
          break;

        case NotificationType.SMS:
          // TODO: Implement SMS sending (Twilio integration)
          success = await this.sendSMSNotification(data);
          break;

        case NotificationType.PUSH:
          // TODO: Implement push notification sending
          success = await this.sendPushNotification(data);
          break;

        default:
          throw new Error(`Unsupported notification type: ${data.type}`);
      }

      // Update notification status
      if (success) {
        await this.prisma.notification.update({
          where: { id: data.id },
          data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
            errorMessage: null,
          },
        });
        this.logger.log(`Notification delivered successfully: ${data.id}`);
      } else {
        throw new Error('Notification delivery failed');
      }
    } catch (error) {
      this.logger.error(`Notification delivery failed: ${data.id}`, error);

      const attempts = (data.attempts || 0) + 1;
      const maxAttempts = data.maxAttempts || 3;
      const status = attempts >= maxAttempts ? 'FAILED' : 'PENDING';

      await this.prisma.notification.update({
        where: { id: data.id },
        data: {
          status,
          errorMessage: error.message,
        },
      });

      if (attempts < maxAttempts) {
        // Re-queue for retry
        throw error; // This will trigger Bull's retry mechanism
      }
    }
  }

  private async sendEmailNotification(data: NotificationJob): Promise<boolean> {
    try {
      if (data.templateId && data.templateData) {
        // Use template
        return await this.emailService.sendEmail({
          to: data.recipient,
          subject: data.subject,
          templateId: data.templateId,
          templateData: data.templateData,
        });
      } else {
        // Send plain email
        return await this.emailService.sendEmail({
          to: data.recipient,
          subject: data.subject,
          html: this.formatEmailContent(data.message),
          text: data.message,
        });
      }
    } catch (error) {
      this.logger.error('Email notification failed:', error);
      return false;
    }
  }

  private async sendWebSocketNotification(data: NotificationJob): Promise<boolean> {
    try {
      if (data.userId) {
        return await this.webSocketGateway.sendToUser(data.userId, 'notification', {
          id: data.id,
          type: data.type,
          subject: data.subject,
          message: data.message,
          priority: data.priority,
          timestamp: new Date().toISOString(),
          entityId: data.entityId,
          entityType: data.entityType,
        });
      } else if (data.tenantId) {
        await this.webSocketGateway.sendToTenant(data.tenantId, 'notification', {
          id: data.id,
          type: data.type,
          subject: data.subject,
          message: data.message,
          priority: data.priority,
          timestamp: new Date().toISOString(),
          entityId: data.entityId,
          entityType: data.entityType,
        });
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('WebSocket notification failed:', error);
      return false;
    }
  }

  private async sendSMSNotification(data: NotificationJob): Promise<boolean> {
    try {
      const result = await this.smsService.sendSms({
        to: data.recipient,
        message: data.message,
      });

      if (result.success) {
        this.logger.log(`SMS notification sent successfully to ${data.recipient}`);
        return true;
      } else {
        this.logger.warn(`SMS notification failed: ${result.error}`);
        return false;
      }
    } catch (error) {
      this.logger.error('SMS notification failed:', error);
      return false;
    }
  }

  private async sendPushNotification(data: NotificationJob): Promise<boolean> {
    try {
      const result = await this.pushService.sendPushNotification({
        token: data.recipient, // For push notifications, recipient is the FCM token
        title: data.subject,
        body: data.message,
        data: data.templateData || {},
      });

      if (result.success) {
        this.logger.log(`Push notification sent successfully to ${data.recipient}`);
        return true;
      } else {
        this.logger.warn(`Push notification failed: ${result.error}`);
        return false;
      }
    } catch (error) {
      this.logger.error('Push notification failed:', error);
      return false;
    }
  }

  private formatEmailContent(message: string): string {
    // Convert plain text to basic HTML
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 20px;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p>This is an automated notification from the School Management System.</p>
        </div>
      </div>
    `;
  }
}
