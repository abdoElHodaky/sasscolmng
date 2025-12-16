import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
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
import { NotificationHistoryService } from '../services/notification-history.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import {
  CreateNotificationDto,
  BulkNotificationDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  NotificationHistoryQueryDto,
  NotificationHistoryListResponseDto,
  NotificationHistoryResponseDto,
  MarkAsReadDto,
  MarkAsReadResponseDto,
  CreateNotificationPreferenceDto,
  UpdateNotificationPreferenceDto,
  NotificationPreferenceResponseDto,
  BulkUpdatePreferencesDto,
  NotificationPreferencesSummaryDto,
  NotificationEligibilityDto,
} from '../dto';
import { UserRole, NotificationType, TemplateType } from '@prisma/client';

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
    private readonly notificationHistoryService: NotificationHistoryService,
    private readonly notificationPreferenceService: NotificationPreferenceService,
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

  // ============================================================================
  // NOTIFICATION HISTORY ENDPOINTS
  // ============================================================================

  @Get('history')
  @RateLimit('GENEROUS')
  @ApiOperation({ summary: 'Get notification history' })
  @ApiResponse({
    status: 200,
    description: 'Notification history retrieved successfully',
    type: NotificationHistoryListResponseDto,
  })
  async getNotificationHistory(
    @Request() req: any,
    @Query() query: NotificationHistoryQueryDto,
  ): Promise<NotificationHistoryListResponseDto> {
    const { tenantId } = req.user;
    return this.notificationHistoryService.getNotificationHistory(tenantId, query);
  }

  @Get('history/:id')
  @RateLimit('GENEROUS')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification retrieved successfully',
    type: NotificationHistoryResponseDto,
  })
  async getNotificationById(
    @Request() req: any,
    @Param('id') notificationId: string,
  ): Promise<NotificationHistoryResponseDto> {
    const { tenantId } = req.user;
    return this.notificationHistoryService.getNotificationById(tenantId, notificationId);
  }

  @Put('history/:id/read')
  @RateLimit('GENEROUS')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: NotificationHistoryResponseDto,
  })
  async markNotificationAsRead(
    @Request() req: any,
    @Param('id') notificationId: string,
  ): Promise<NotificationHistoryResponseDto> {
    const { tenantId, userId } = req.user;
    return this.notificationHistoryService.markAsRead(tenantId, notificationId, userId);
  }

  @Put('history/read')
  @RateLimit('GENEROUS')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read',
    type: MarkAsReadResponseDto,
  })
  async markMultipleAsRead(
    @Request() req: any,
    @Body() markAsReadDto: MarkAsReadDto,
  ): Promise<MarkAsReadResponseDto> {
    const { tenantId, userId } = req.user;
    return this.notificationHistoryService.markMultipleAsRead(
      tenantId,
      markAsReadDto.notificationIds,
      userId,
    );
  }

  @Delete('history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit('STANDARD')
  @ApiOperation({ summary: 'Delete notification from history' })
  @ApiResponse({
    status: 204,
    description: 'Notification deleted successfully',
  })
  async deleteNotification(
    @Request() req: any,
    @Param('id') notificationId: string,
  ): Promise<void> {
    const { tenantId, userId } = req.user;
    return this.notificationHistoryService.deleteNotification(tenantId, notificationId, userId);
  }

  @Get('history-stats')
  @RateLimit('STANDARD')
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({
    status: 200,
    description: 'Notification statistics retrieved successfully',
  })
  async getNotificationHistoryStats(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    const { tenantId, userId } = req.user;
    return this.notificationHistoryService.getNotificationStats(tenantId, {
      userId,
      startDate,
      endDate,
      groupBy,
    });
  }

  @Get('unread-count')
  @RateLimit('GENEROUS')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number', example: 5 },
      },
    },
  })
  async getUnreadCount(@Request() req: any): Promise<{ count: number }> {
    const { tenantId, userId } = req.user;
    const count = await this.notificationHistoryService.getUnreadCount(tenantId, userId);
    return { count };
  }

  // ============================================================================
  // NOTIFICATION PREFERENCES ENDPOINTS
  // ============================================================================

  @Get('preferences')
  @RateLimit('GENEROUS')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences retrieved successfully',
    type: [NotificationPreferenceResponseDto],
  })
  async getUserPreferences(
    @Request() req: any,
    @Query('notificationType') notificationType?: NotificationType,
    @Query('templateType') templateType?: TemplateType,
  ): Promise<NotificationPreferenceResponseDto[]> {
    const { tenantId, userId } = req.user;
    return this.notificationPreferenceService.getUserPreferences(tenantId, userId, {
      notificationType,
      templateType,
    });
  }

  @Post('preferences')
  @RateLimit('STANDARD')
  @ApiOperation({ summary: 'Create or update notification preference' })
  @ApiResponse({
    status: 201,
    description: 'Notification preference created/updated successfully',
    type: NotificationPreferenceResponseDto,
  })
  async createOrUpdatePreference(
    @Request() req: any,
    @Body() createDto: CreateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    const { tenantId, userId } = req.user;
    return this.notificationPreferenceService.createOrUpdatePreference(tenantId, userId, createDto);
  }

  @Put('preferences/:id')
  @RateLimit('STANDARD')
  @ApiOperation({ summary: 'Update notification preference' })
  @ApiResponse({
    status: 200,
    description: 'Notification preference updated successfully',
    type: NotificationPreferenceResponseDto,
  })
  async updatePreference(
    @Request() req: any,
    @Param('id') preferenceId: string,
    @Body() updateDto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    const { tenantId, userId } = req.user;
    return this.notificationPreferenceService.updatePreference(
      tenantId,
      userId,
      preferenceId,
      updateDto,
    );
  }

  @Put('preferences/bulk')
  @RateLimit('STANDARD')
  @ApiOperation({ summary: 'Bulk update notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences updated successfully',
    type: [NotificationPreferenceResponseDto],
  })
  async bulkUpdatePreferences(
    @Request() req: any,
    @Body() bulkUpdateDto: BulkUpdatePreferencesDto,
  ): Promise<NotificationPreferenceResponseDto[]> {
    const { tenantId, userId } = req.user;
    return this.notificationPreferenceService.bulkUpdatePreferences(tenantId, userId, bulkUpdateDto);
  }

  @Delete('preferences/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit('STANDARD')
  @ApiOperation({ summary: 'Delete notification preference' })
  @ApiResponse({
    status: 204,
    description: 'Notification preference deleted successfully',
  })
  async deletePreference(
    @Request() req: any,
    @Param('id') preferenceId: string,
  ): Promise<void> {
    const { tenantId, userId } = req.user;
    return this.notificationPreferenceService.deletePreference(tenantId, userId, preferenceId);
  }

  @Post('preferences/reset')
  @RateLimit('STANDARD')
  @ApiOperation({ summary: 'Reset preferences to defaults' })
  @ApiResponse({
    status: 200,
    description: 'Preferences reset to defaults successfully',
    type: [NotificationPreferenceResponseDto],
  })
  async resetToDefaults(@Request() req: any): Promise<NotificationPreferenceResponseDto[]> {
    const { tenantId, userId } = req.user;
    return this.notificationPreferenceService.resetToDefaults(tenantId, userId);
  }

  @Get('preferences/check-eligibility')
  @RateLimit('GENEROUS')
  @ApiOperation({ summary: 'Check if user should receive notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification eligibility checked successfully',
    type: NotificationEligibilityDto,
  })
  async checkNotificationEligibility(
    @Request() req: any,
    @Query('notificationType') notificationType: NotificationType,
    @Query('templateType') templateType?: TemplateType,
    @Query('deliveryChannel') deliveryChannel?: string,
  ): Promise<NotificationEligibilityDto> {
    const { tenantId, userId } = req.user;
    return this.notificationPreferenceService.shouldReceiveNotification(
      tenantId,
      userId,
      notificationType,
      templateType,
      deliveryChannel,
    );
  }

  // ============================================================================
  // ADMIN ENDPOINTS (for tenant-wide statistics)
  // ============================================================================

  @Get('admin/stats')
  @RateLimit('STANDARD')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get tenant-wide notification statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant notification statistics retrieved successfully',
  })
  async getTenantNotificationStats(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    const { tenantId } = req.user;
    return this.notificationHistoryService.getNotificationStats(tenantId, {
      startDate,
      endDate,
      groupBy,
    });
  }

  @Get('admin/preferences-summary')
  @RateLimit('STANDARD')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get tenant preferences summary (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant preferences summary retrieved successfully',
    type: NotificationPreferencesSummaryDto,
  })
  async getPreferencesSummary(@Request() req: any): Promise<NotificationPreferencesSummaryDto> {
    const { tenantId } = req.user;
    return this.notificationPreferenceService.getPreferencesSummary(tenantId);
  }
}
