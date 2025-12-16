import { IsOptional, IsEnum, IsString, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { NotificationType, NotificationStatus, NotificationPriority } from '@prisma/client';
import { Type } from 'class-transformer';

export class NotificationHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: 'usr_1234567890',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by notification type',
    enum: NotificationType,
    example: NotificationType.EMAIL,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Filter by notification status',
    enum: NotificationStatus,
    example: NotificationStatus.DELIVERED,
  })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({
    description: 'Filter by notification priority',
    enum: NotificationPriority,
    example: NotificationPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO string)',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search term for subject, content, or recipient email',
    example: 'invoice',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class NotificationHistoryResponseDto {
  @ApiProperty({
    description: 'Notification ID',
    example: 'not_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
    example: NotificationType.EMAIL,
  })
  type: NotificationType;

  @ApiProperty({
    description: 'Notification priority',
    enum: NotificationPriority,
    example: NotificationPriority.NORMAL,
  })
  priority: NotificationPriority;

  @ApiProperty({
    description: 'Notification status',
    enum: NotificationStatus,
    example: NotificationStatus.DELIVERED,
  })
  status: NotificationStatus;

  @ApiPropertyOptional({
    description: 'Notification subject (for email notifications)',
    example: 'Your invoice is ready',
  })
  subject?: string;

  @ApiProperty({
    description: 'Notification content',
    example: 'Your monthly invoice for $79.99 is now available.',
  })
  content: string;

  @ApiPropertyOptional({
    description: 'Recipient email address',
    example: 'user@example.com',
  })
  recipientEmail?: string;

  @ApiPropertyOptional({
    description: 'Recipient phone number',
    example: '+1234567890',
  })
  recipientPhone?: string;

  @ApiPropertyOptional({
    description: 'Scheduled delivery time',
    example: '2024-01-01T12:00:00.000Z',
  })
  scheduledFor?: Date;

  @ApiPropertyOptional({
    description: 'When notification was sent',
    example: '2024-01-01T12:00:00.000Z',
  })
  sentAt?: Date;

  @ApiPropertyOptional({
    description: 'When notification was delivered',
    example: '2024-01-01T12:01:00.000Z',
  })
  deliveredAt?: Date;

  @ApiPropertyOptional({
    description: 'When notification was read',
    example: '2024-01-01T12:05:00.000Z',
  })
  readAt?: Date;

  @ApiPropertyOptional({
    description: 'Failure reason if notification failed',
    example: 'Invalid email address',
  })
  failureReason?: string;

  @ApiProperty({
    description: 'Number of retry attempts',
    example: 0,
  })
  retryCount: number;

  @ApiProperty({
    description: 'When notification was created',
    example: '2024-01-01T11:59:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Template information if notification used a template',
  })
  template?: {
    id: string;
    name: string;
    type: string;
  };
}

export class NotificationHistoryListResponseDto {
  @ApiProperty({
    description: 'List of notifications',
    type: [NotificationHistoryResponseDto],
  })
  notifications: NotificationHistoryResponseDto[];

  @ApiProperty({
    description: 'Total number of notifications',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;
}

export class MarkAsReadDto {
  @ApiProperty({
    description: 'Array of notification IDs to mark as read',
    example: ['not_1234567890', 'not_0987654321'],
  })
  @IsString({ each: true })
  notificationIds: string[];
}

export class MarkAsReadResponseDto {
  @ApiProperty({
    description: 'Number of notifications updated',
    example: 2,
  })
  updated: number;
}
