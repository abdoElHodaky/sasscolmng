import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RateLimit } from '../../common/guards/rate-limit.guard';
import { NotificationService } from '../services/notification.service';
import { EmailService } from '../services/email.service';
import { SmsService } from '../services/sms.service';
import { PushService } from '../services/push.service';
import { WebSocketGateway } from '../services/websocket.gateway';
import {
  CreateNotificationDto,
  BulkNotificationDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from '../dto';
import { UserRole } from '@prisma/client';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private notificationService: NotificationService,
    private emailService: EmailService,
    private smsService: SmsService,
    private pushService: PushService,
    private webSocketGateway: WebSocketGateway,
  ) {}

  @Post('send')
  @RateLimit('STANDARD')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Send a notification' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Notification queued successfully' })
  async sendNotification(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() user: any,
  ) {
    // Ensure tenant isolation
    if (!dto.tenantId) {
      dto.tenantId = user.tenantId;
    }

    return await this.notificationService.sendNotification(dto);
  }

  @Post('bulk')
  @RateLimit('BULK')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Send bulk notifications' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Bulk notifications queued successfully' })
  async sendBulkNotifications(
    @Body() dto: BulkNotificationDto,
    @CurrentUser() user: any,
  ) {
    // Ensure tenant isolation
    if (!dto.tenantId) {
      dto.tenantId = user.tenantId;
    }

    return await this.notificationService.sendBulkNotifications(dto);
  }

  @Get()
  @RateLimit('GENEROUS')
  @ApiOperation({ summary: 'Get notifications' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notifications retrieved successfully' })
  async getNotifications(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('userId') userId?: string,
    @CurrentUser() user: any,
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // For non-admin users, only show their own notifications
    const targetUserId = user.role === UserRole.SUPER_ADMIN ? userId : user.id;

    return await this.notificationService.getNotifications(
      user.tenantId,
      targetUserId,
      pageNum,
      limitNum,
    );
  }

  @Put(':id/read')
  @RateLimit('GENEROUS')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notification marked as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const success = await this.notificationService.markAsRead(id, user.id);
    return { success };
  }

  @Get('delivery-status/:id')
  @RateLimit('GENEROUS')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get notification delivery status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Delivery status retrieved successfully' })
  async getDeliveryStatus(@Param('id') id: string) {
    return await this.notificationService.getDeliveryStatus(id);
  }

  @Get('stats')
  @RateLimit('STANDARD')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Statistics retrieved successfully' })
  async getStats(@CurrentUser() user: any) {
    const tenantId = user.role === UserRole.SUPER_ADMIN ? undefined : user.tenantId;
    return await this.notificationService.getNotificationStats(tenantId);
  }

  @Get('websocket/stats')
  @RateLimit('STANDARD')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get WebSocket connection statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'WebSocket stats retrieved successfully' })
  async getWebSocketStats(@CurrentUser() user: any) {
    const connectedUsers = this.webSocketGateway.getConnectedUsersCount();
    const tenantUsers = user.role === UserRole.SUPER_ADMIN 
      ? [] 
      : this.webSocketGateway.getConnectedUsersForTenant(user.tenantId);

    return {
      totalConnectedUsers: connectedUsers,
      tenantConnectedUsers: tenantUsers.length,
      connectedUserIds: user.role === UserRole.SUPER_ADMIN ? [] : tenantUsers,
    };
  }

  @Post('test-email')
  @RateLimit('STRICT')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Test email service connection' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email test completed' })
  async testEmailService(@CurrentUser() user: any) {
    const connectionTest = await this.emailService.testConnection();
    
    if (connectionTest) {
      // Send test email
      const testResult = await this.emailService.sendEmail({
        to: user.email,
        subject: 'Email Service Test',
        text: 'This is a test email from the School Management System.',
        html: '<p>This is a test email from the <strong>School Management System</strong>.</p>',
      });

      return {
        connectionTest: true,
        emailSent: testResult,
        message: testResult 
          ? 'Email service is working correctly' 
          : 'Email service connected but failed to send test email',
      };
    }

    return {
      connectionTest: false,
      emailSent: false,
      message: 'Email service connection failed',
    };
  }

  @Post('send-schedule-update')
  @RateLimit('STANDARD')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Send schedule update notification' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Schedule update notification sent' })
  async sendScheduleUpdateNotification(
    @Body() data: {
      scheduleId: string;
      scheduleName: string;
      changes: string[];
      affectedUserIds: string[];
    },
    @CurrentUser() user: any,
  ) {
    await this.notificationService.sendScheduleUpdateNotification(
      user.tenantId,
      data.scheduleId,
      data.scheduleName,
      data.changes,
      data.affectedUserIds,
    );

    return {
      success: true,
      message: 'Schedule update notifications sent',
      affectedUsers: data.affectedUserIds.length,
    };
  }

  @Post('send-realtime')
  @RateLimit('GENEROUS')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Send real-time notification' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Real-time notification sent' })
  async sendRealTimeNotification(
    @Body() data: {
      userId: string;
      event: string;
      data: any;
    },
    @CurrentUser() user: any,
  ) {
    await this.notificationService.sendRealTimeNotification(
      user.tenantId,
      data.userId,
      data.event,
      data.data,
    );

    return {
      success: true,
      message: 'Real-time notification sent',
    };
  }

  @Post('test-sms')
  @RateLimit('STRICT')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Test SMS service' })
  @ApiResponse({ status: HttpStatus.OK, description: 'SMS service test completed' })
  async testSmsService(
    @Body() data: { phoneNumber: string; message?: string },
    @CurrentUser() user: any,
  ) {
    const connectionTest = await this.smsService.testConnection();
    const serviceStatus = this.smsService.getServiceStatus();

    if (connectionTest) {
      const testMessage = data.message || 'This is a test SMS from the School Management System.';
      const testResult = await this.smsService.sendSms({
        to: data.phoneNumber,
        message: testMessage,
      });

      return {
        connectionTest: true,
        smsSent: testResult.success,
        messageId: testResult.messageId,
        error: testResult.error,
        serviceStatus,
        message: testResult.success 
          ? 'SMS service is working correctly' 
          : 'SMS service connected but failed to send test message',
      };
    }

    return {
      connectionTest: false,
      smsSent: false,
      serviceStatus,
      message: 'SMS service connection failed or not configured',
    };
  }

  @Post('test-push')
  @RateLimit('STRICT')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Test push notification service' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Push notification service test completed' })
  async testPushService(
    @Body() data: { token: string; title?: string; message?: string },
    @CurrentUser() user: any,
  ) {
    const connectionTest = await this.pushService.testConnection();
    const serviceStatus = this.pushService.getServiceStatus();

    if (connectionTest) {
      const testTitle = data.title || 'Test Notification';
      const testMessage = data.message || 'This is a test push notification from the School Management System.';
      
      const testResult = await this.pushService.sendPushNotification({
        token: data.token,
        title: testTitle,
        body: testMessage,
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
      });

      return {
        connectionTest: true,
        pushSent: testResult.success,
        messageId: testResult.messageId,
        error: testResult.error,
        serviceStatus,
        message: testResult.success 
          ? 'Push notification service is working correctly' 
          : 'Push notification service connected but failed to send test notification',
      };
    }

    return {
      connectionTest: false,
      pushSent: false,
      serviceStatus,
      message: 'Push notification service connection failed or not configured',
    };
  }

  @Get('service-status')
  @RateLimit('GENEROUS')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get all notification services status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Services status retrieved' })
  async getServicesStatus() {
    const [emailStatus, smsStatus, pushStatus] = await Promise.all([
      this.emailService.testConnection(),
      this.smsService.testConnection(),
      this.pushService.testConnection(),
    ]);

    return {
      email: {
        connected: emailStatus,
        ...this.emailService.getServiceStatus?.() || { provider: 'Email Service' },
      },
      sms: {
        connected: smsStatus,
        ...this.smsService.getServiceStatus(),
      },
      push: {
        connected: pushStatus,
        ...this.pushService.getServiceStatus(),
      },
      websocket: {
        connected: true,
        connectedUsers: this.webSocketGateway.getConnectedUsersCount(),
      },
    };
  }
}
