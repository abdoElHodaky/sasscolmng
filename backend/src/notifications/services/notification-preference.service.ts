import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { 
  NotificationPreference, 
  NotificationType, 
  TemplateType,
  Prisma 
} from '@prisma/client';

export interface CreateNotificationPreferenceDto {
  notificationType: NotificationType;
  templateType?: TemplateType;
  isEnabled: boolean;
  deliveryChannels: string[]; // ['email', 'sms', 'push', 'websocket']
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string; // HH:mm format
  timezone?: string;
  frequency?: string; // 'immediate', 'daily_digest', 'weekly_digest'
  metadata?: Record<string, any>;
}

export interface UpdateNotificationPreferenceDto {
  isEnabled?: boolean;
  deliveryChannels?: string[];
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  frequency?: string;
  metadata?: Record<string, any>;
}

export interface NotificationPreferenceResponseDto {
  id: string;
  notificationType: NotificationType;
  templateType?: TemplateType;
  isEnabled: boolean;
  deliveryChannels: string[];
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  frequency?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkUpdatePreferencesDto {
  preferences: Array<{
    notificationType: NotificationType;
    templateType?: TemplateType;
    isEnabled: boolean;
    deliveryChannels?: string[];
    frequency?: string;
  }>;
}

@Injectable()
export class NotificationPreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create or update notification preference
   */
  async createOrUpdatePreference(
    tenantId: string,
    userId: string,
    createDto: CreateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    const { notificationType, templateType, ...preferenceData } = createDto;

    // Validate delivery channels
    this.validateDeliveryChannels(preferenceData.deliveryChannels);

    // Validate quiet hours
    if (preferenceData.quietHoursStart && preferenceData.quietHoursEnd) {
      this.validateQuietHours(preferenceData.quietHoursStart, preferenceData.quietHoursEnd);
    }

    // Check if preference already exists
    const existingPreference = await this.prisma.notificationPreference.findFirst({
      where: {
        userId,
        tenantId,
        notificationType,
        templateType: templateType || null,
      },
    });

    let preference: NotificationPreference;

    if (existingPreference) {
      // Update existing preference
      preference = await this.prisma.notificationPreference.update({
        where: { id: existingPreference.id },
        data: {
          ...preferenceData,
          deliveryChannels: preferenceData.deliveryChannels,
          metadata: preferenceData.metadata || {},
        },
      });
    } else {
      // Create new preference
      preference = await this.prisma.notificationPreference.create({
        data: {
          userId,
          tenantId,
          notificationType,
          templateType,
          ...preferenceData,
          deliveryChannels: preferenceData.deliveryChannels,
          metadata: preferenceData.metadata || {},
        },
      });
    }

    return this.formatPreferenceResponse(preference);
  }

  /**
   * Get user's notification preferences
   */
  async getUserPreferences(
    tenantId: string,
    userId: string,
    options: {
      notificationType?: NotificationType;
      templateType?: TemplateType;
    } = {},
  ): Promise<NotificationPreferenceResponseDto[]> {
    const { notificationType, templateType } = options;

    const where: Prisma.NotificationPreferenceWhereInput = {
      userId,
      tenantId,
      ...(notificationType && { notificationType }),
      ...(templateType && { templateType }),
    };

    const preferences = await this.prisma.notificationPreference.findMany({
      where,
      orderBy: [
        { notificationType: 'asc' },
        { templateType: 'asc' },
      ],
    });

    return preferences.map(this.formatPreferenceResponse);
  }

  /**
   * Get specific preference
   */
  async getPreference(
    tenantId: string,
    userId: string,
    notificationType: NotificationType,
    templateType?: TemplateType,
  ): Promise<NotificationPreferenceResponseDto | null> {
    const preference = await this.prisma.notificationPreference.findFirst({
      where: {
        userId,
        tenantId,
        notificationType,
        templateType: templateType || null,
      },
    });

    return preference ? this.formatPreferenceResponse(preference) : null;
  }

  /**
   * Update notification preference
   */
  async updatePreference(
    tenantId: string,
    userId: string,
    preferenceId: string,
    updateDto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    // Verify preference belongs to user
    const existingPreference = await this.prisma.notificationPreference.findFirst({
      where: {
        id: preferenceId,
        userId,
        tenantId,
      },
    });

    if (!existingPreference) {
      throw new NotFoundException('Notification preference not found');
    }

    // Validate delivery channels if provided
    if (updateDto.deliveryChannels) {
      this.validateDeliveryChannels(updateDto.deliveryChannels);
    }

    // Validate quiet hours if provided
    if (updateDto.quietHoursStart && updateDto.quietHoursEnd) {
      this.validateQuietHours(updateDto.quietHoursStart, updateDto.quietHoursEnd);
    }

    const updatedPreference = await this.prisma.notificationPreference.update({
      where: { id: preferenceId },
      data: {
        ...updateDto,
        ...(updateDto.deliveryChannels && { deliveryChannels: updateDto.deliveryChannels }),
        ...(updateDto.metadata && {
          metadata: {
            ...(existingPreference.metadata as object || {}),
            ...updateDto.metadata,
          },
        }),
      },
    });

    return this.formatPreferenceResponse(updatedPreference);
  }

  /**
   * Bulk update preferences
   */
  async bulkUpdatePreferences(
    tenantId: string,
    userId: string,
    bulkUpdateDto: BulkUpdatePreferencesDto,
  ): Promise<NotificationPreferenceResponseDto[]> {
    const { preferences } = bulkUpdateDto;
    const updatedPreferences: NotificationPreferenceResponseDto[] = [];

    // Process each preference update
    for (const prefUpdate of preferences) {
      try {
        const preference = await this.createOrUpdatePreference(tenantId, userId, {
          notificationType: prefUpdate.notificationType,
          templateType: prefUpdate.templateType,
          isEnabled: prefUpdate.isEnabled,
          deliveryChannels: prefUpdate.deliveryChannels || ['email'],
          frequency: prefUpdate.frequency || 'immediate',
        });
        updatedPreferences.push(preference);
      } catch (error) {
        console.error(`Failed to update preference for ${prefUpdate.notificationType}:`, error);
      }
    }

    return updatedPreferences;
  }

  /**
   * Delete notification preference
   */
  async deletePreference(
    tenantId: string,
    userId: string,
    preferenceId: string,
  ): Promise<void> {
    const preference = await this.prisma.notificationPreference.findFirst({
      where: {
        id: preferenceId,
        userId,
        tenantId,
      },
    });

    if (!preference) {
      throw new NotFoundException('Notification preference not found');
    }

    await this.prisma.notificationPreference.delete({
      where: { id: preferenceId },
    });
  }

  /**
   * Reset preferences to defaults
   */
  async resetToDefaults(
    tenantId: string,
    userId: string,
  ): Promise<NotificationPreferenceResponseDto[]> {
    // Delete all existing preferences
    await this.prisma.notificationPreference.deleteMany({
      where: { userId, tenantId },
    });

    // Create default preferences
    const defaultPreferences = this.getDefaultPreferences();
    const createdPreferences: NotificationPreferenceResponseDto[] = [];

    for (const defaultPref of defaultPreferences) {
      const preference = await this.createOrUpdatePreference(tenantId, userId, defaultPref);
      createdPreferences.push(preference);
    }

    return createdPreferences;
  }

  /**
   * Check if user should receive notification based on preferences
   */
  async shouldReceiveNotification(
    tenantId: string,
    userId: string,
    notificationType: NotificationType,
    templateType?: TemplateType,
    deliveryChannel?: string,
  ): Promise<{
    shouldReceive: boolean;
    allowedChannels: string[];
    reason?: string;
  }> {
    // Get user preference
    const preference = await this.getPreference(tenantId, userId, notificationType, templateType);

    // If no preference exists, use defaults
    if (!preference) {
      const defaultPref = this.getDefaultPreferenceForType(notificationType);
      return {
        shouldReceive: defaultPref.isEnabled,
        allowedChannels: defaultPref.deliveryChannels,
        reason: 'Using default preferences',
      };
    }

    // Check if notification type is enabled
    if (!preference.isEnabled) {
      return {
        shouldReceive: false,
        allowedChannels: [],
        reason: 'Notification type disabled by user',
      };
    }

    // Check quiet hours
    if (preference.quietHoursStart && preference.quietHoursEnd && preference.timezone) {
      const isInQuietHours = this.isInQuietHours(
        preference.quietHoursStart,
        preference.quietHoursEnd,
        preference.timezone,
      );

      if (isInQuietHours) {
        return {
          shouldReceive: false,
          allowedChannels: preference.deliveryChannels,
          reason: 'Currently in quiet hours',
        };
      }
    }

    // Check delivery channel
    if (deliveryChannel && !preference.deliveryChannels.includes(deliveryChannel)) {
      return {
        shouldReceive: false,
        allowedChannels: preference.deliveryChannels,
        reason: `Delivery channel '${deliveryChannel}' not allowed`,
      };
    }

    return {
      shouldReceive: true,
      allowedChannels: preference.deliveryChannels,
    };
  }

  /**
   * Get notification preferences summary for tenant
   */
  async getPreferencesSummary(tenantId: string): Promise<{
    totalUsers: number;
    enabledByType: Record<NotificationType, number>;
    channelPreferences: Record<string, number>;
    frequencyPreferences: Record<string, number>;
  }> {
    // Get total users in tenant
    const totalUsers = await this.prisma.user.count({
      where: { tenantId },
    });

    // Get preferences grouped by type
    const enabledByTypeResults = await this.prisma.notificationPreference.groupBy({
      by: ['notificationType'],
      where: {
        tenantId,
        isEnabled: true,
      },
      _count: { id: true },
    });

    const enabledByType = Object.values(NotificationType).reduce((acc, type) => {
      acc[type] = enabledByTypeResults.find(r => r.notificationType === type)?._count.id || 0;
      return acc;
    }, {} as Record<NotificationType, number>);

    // Get channel preferences (this is simplified - in reality you'd need to parse JSON arrays)
    const channelPreferences: Record<string, number> = {
      email: 0,
      sms: 0,
      push: 0,
      websocket: 0,
    };

    // Get frequency preferences
    const frequencyResults = await this.prisma.notificationPreference.groupBy({
      by: ['frequency'],
      where: { tenantId },
      _count: { id: true },
    });

    const frequencyPreferences = frequencyResults.reduce((acc, result) => {
      if (result.frequency) {
        acc[result.frequency] = result._count.id;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsers,
      enabledByType,
      channelPreferences,
      frequencyPreferences,
    };
  }

  // Private helper methods

  private validateDeliveryChannels(channels: string[]): void {
    const validChannels = ['email', 'sms', 'push', 'websocket', 'in_app'];
    const invalidChannels = channels.filter(channel => !validChannels.includes(channel));

    if (invalidChannels.length > 0) {
      throw new BadRequestException(`Invalid delivery channels: ${invalidChannels.join(', ')}`);
    }
  }

  private validateQuietHours(start: string, end: string): void {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!timeRegex.test(start) || !timeRegex.test(end)) {
      throw new BadRequestException('Quiet hours must be in HH:mm format');
    }
  }

  private isInQuietHours(start: string, end: string, timezone: string): boolean {
    try {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      const [startHour, startMinute] = start.split(':').map(Number);
      const [endHour, endMinute] = end.split(':').map(Number);

      const currentMinutes = currentHour * 60 + currentMinute;
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      // Handle overnight quiet hours (e.g., 22:00 to 06:00)
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      }

      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  private getDefaultPreferences(): CreateNotificationPreferenceDto[] {
    return [
      {
        notificationType: NotificationType.EMAIL,
        isEnabled: true,
        deliveryChannels: ['email'],
        frequency: 'immediate',
      },
      {
        notificationType: NotificationType.SMS,
        isEnabled: false,
        deliveryChannels: ['sms'],
        frequency: 'immediate',
      },
      {
        notificationType: NotificationType.PUSH,
        isEnabled: true,
        deliveryChannels: ['push'],
        frequency: 'immediate',
      },
      {
        notificationType: NotificationType.WEBSOCKET,
        isEnabled: true,
        deliveryChannels: ['websocket'],
        frequency: 'immediate',
      },
      {
        notificationType: NotificationType.IN_APP,
        isEnabled: true,
        deliveryChannels: ['in_app'],
        frequency: 'immediate',
      },
    ];
  }

  private getDefaultPreferenceForType(type: NotificationType): CreateNotificationPreferenceDto {
    const defaults = this.getDefaultPreferences();
    return defaults.find(pref => pref.notificationType === type) || {
      notificationType: type,
      isEnabled: true,
      deliveryChannels: ['email'],
      frequency: 'immediate',
    };
  }

  private formatPreferenceResponse(preference: NotificationPreference): NotificationPreferenceResponseDto {
    return {
      id: preference.id,
      notificationType: preference.notificationType,
      templateType: preference.templateType || undefined,
      isEnabled: preference.isEnabled,
      deliveryChannels: preference.deliveryChannels as string[],
      quietHoursStart: preference.quietHoursStart || undefined,
      quietHoursEnd: preference.quietHoursEnd || undefined,
      timezone: preference.timezone || undefined,
      frequency: preference.frequency || undefined,
      metadata: preference.metadata as Record<string, any> || undefined,
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
  }
}
