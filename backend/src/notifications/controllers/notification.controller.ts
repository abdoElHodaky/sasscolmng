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
}

