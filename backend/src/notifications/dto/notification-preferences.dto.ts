import { IsEnum, IsBoolean, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, TemplateType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateNotificationPreferenceDto {
  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.EMAIL,
  })
  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @ApiPropertyOptional({
    description: 'Specific template type (optional)',
    enum: TemplateType,
    example: TemplateType.INVOICE,
  })
  @IsOptional()
  @IsEnum(TemplateType)
  templateType?: TemplateType;

  @ApiProperty({
    description: 'Whether this notification type is enabled',
    example: true,
  })
  @IsBoolean()
  isEnabled: boolean;

  @ApiProperty({
    description: 'Preferred delivery channels',
    example: ['email', 'push'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  deliveryChannels: string[];

  @ApiPropertyOptional({
    description: 'Quiet hours start time (HH:mm format)',
    example: '22:00',
  })
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @ApiPropertyOptional({
    description: 'Quiet hours end time (HH:mm format)',
    example: '08:00',
  })
  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @ApiPropertyOptional({
    description: 'User timezone',
    example: 'America/New_York',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Notification frequency',
    example: 'immediate',
    enum: ['immediate', 'daily_digest', 'weekly_digest'],
  })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { customSetting: 'value' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateNotificationPreferenceDto {
  @ApiPropertyOptional({
    description: 'Whether this notification type is enabled',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Preferred delivery channels',
    example: ['email'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliveryChannels?: string[];

  @ApiPropertyOptional({
    description: 'Quiet hours start time (HH:mm format)',
    example: '23:00',
  })
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @ApiPropertyOptional({
    description: 'Quiet hours end time (HH:mm format)',
    example: '07:00',
  })
  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @ApiPropertyOptional({
    description: 'User timezone',
    example: 'Europe/London',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Notification frequency',
    example: 'daily_digest',
    enum: ['immediate', 'daily_digest', 'weekly_digest'],
  })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { updatedSetting: 'newValue' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class NotificationPreferenceResponseDto {
  @ApiProperty({
    description: 'Preference ID',
    example: 'pref_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.EMAIL,
  })
  notificationType: NotificationType;

  @ApiPropertyOptional({
    description: 'Specific template type',
    enum: TemplateType,
    example: TemplateType.INVOICE,
  })
  templateType?: TemplateType;

  @ApiProperty({
    description: 'Whether this notification type is enabled',
    example: true,
  })
  isEnabled: boolean;

  @ApiProperty({
    description: 'Preferred delivery channels',
    example: ['email', 'push'],
    type: [String],
  })
  deliveryChannels: string[];

  @ApiPropertyOptional({
    description: 'Quiet hours start time',
    example: '22:00',
  })
  quietHoursStart?: string;

  @ApiPropertyOptional({
    description: 'Quiet hours end time',
    example: '08:00',
  })
  quietHoursEnd?: string;

  @ApiPropertyOptional({
    description: 'User timezone',
    example: 'America/New_York',
  })
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Notification frequency',
    example: 'immediate',
  })
  frequency?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { customSetting: 'value' },
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'When preference was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When preference was last updated',
    example: '2024-01-01T12:00:00.000Z',
  })
  updatedAt: Date;
}

export class BulkPreferenceUpdateDto {
  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.EMAIL,
  })
  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @ApiPropertyOptional({
    description: 'Specific template type',
    enum: TemplateType,
    example: TemplateType.INVOICE,
  })
  @IsOptional()
  @IsEnum(TemplateType)
  templateType?: TemplateType;

  @ApiProperty({
    description: 'Whether this notification type is enabled',
    example: true,
  })
  @IsBoolean()
  isEnabled: boolean;

  @ApiPropertyOptional({
    description: 'Preferred delivery channels',
    example: ['email'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliveryChannels?: string[];

  @ApiPropertyOptional({
    description: 'Notification frequency',
    example: 'immediate',
    enum: ['immediate', 'daily_digest', 'weekly_digest'],
  })
  @IsOptional()
  @IsString()
  frequency?: string;
}

export class BulkUpdatePreferencesDto {
  @ApiProperty({
    description: 'Array of preference updates',
    type: [BulkPreferenceUpdateDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPreferenceUpdateDto)
  preferences: BulkPreferenceUpdateDto[];
}

export class NotificationPreferencesSummaryDto {
  @ApiProperty({
    description: 'Total users in tenant',
    example: 150,
  })
  totalUsers: number;

  @ApiProperty({
    description: 'Number of users with each notification type enabled',
    example: {
      EMAIL: 140,
      SMS: 50,
      PUSH: 120,
      WEBSOCKET: 100,
      IN_APP: 145,
    },
  })
  enabledByType: Record<NotificationType, number>;

  @ApiProperty({
    description: 'Channel preferences distribution',
    example: {
      email: 140,
      sms: 50,
      push: 120,
      websocket: 100,
    },
  })
  channelPreferences: Record<string, number>;

  @ApiProperty({
    description: 'Frequency preferences distribution',
    example: {
      immediate: 120,
      daily_digest: 25,
      weekly_digest: 5,
    },
  })
  frequencyPreferences: Record<string, number>;
}

export class NotificationEligibilityDto {
  @ApiProperty({
    description: 'Whether user should receive the notification',
    example: true,
  })
  shouldReceive: boolean;

  @ApiProperty({
    description: 'Allowed delivery channels for this user',
    example: ['email', 'push'],
    type: [String],
  })
  allowedChannels: string[];

  @ApiPropertyOptional({
    description: 'Reason if notification should not be sent',
    example: 'Currently in quiet hours',
  })
  reason?: string;
}
