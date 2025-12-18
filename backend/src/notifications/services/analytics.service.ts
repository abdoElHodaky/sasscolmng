import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';

export interface NotificationAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalRead: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
  averageDeliveryTime: number;
  channelBreakdown: {
    email: ChannelMetrics;
    sms: ChannelMetrics;
    push: ChannelMetrics;
    websocket: ChannelMetrics;
    inApp: ChannelMetrics;
  };
  timeSeriesData: TimeSeriesPoint[];
  topTemplates: TemplateMetrics[];
  userEngagement: UserEngagementMetrics;
}

export interface ChannelMetrics {
  sent: number;
  delivered: number;
  failed: number;
  read: number;
  deliveryRate: number;
  readRate: number;
  averageDeliveryTime: number;
  cost: number;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  sent: number;
  delivered: number;
  failed: number;
  read: number;
}

export interface TemplateMetrics {
  templateId: string;
  templateName: string;
  sent: number;
  delivered: number;
  read: number;
  deliveryRate: number;
  readRate: number;
  engagement: number;
}

export interface UserEngagementMetrics {
  activeUsers: number;
  engagementRate: number;
  averageNotificationsPerUser: number;
  topEngagedUsers: {
    userId: string;
    userName: string;
    notificationsReceived: number;
    notificationsRead: number;
    engagementRate: number;
  }[];
  segmentAnalysis: {
    segment: string;
    users: number;
    engagementRate: number;
    preferredChannel: string;
  }[];
}

export interface ABTestResult {
  testId: string;
  testName: string;
  status: 'running' | 'completed' | 'paused';
  variants: {
    name: string;
    sent: number;
    delivered: number;
    read: number;
    conversionRate: number;
  }[];
  winner?: string;
  confidence: number;
  startDate: Date;
  endDate?: Date;
}

@Injectable()
export class NotificationAnalyticsService {
  private readonly logger = new Logger(NotificationAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get comprehensive notification analytics for a tenant
   */
  async getAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    channels?: string[],
  ): Promise<NotificationAnalytics> {
    const cacheKey = `analytics:${tenantId}:${startDate.getTime()}:${endDate.getTime()}:${channels?.join(',')}`;
    
    // Try to get from cache first
    const cached = await this.cacheService.get<NotificationAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    this.logger.log(`Generating analytics for tenant: ${tenantId}`);

    // Get all notifications in the date range
    const notifications = await this.prisma.notification.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(channels && { channel: { in: channels } }),
      },
      include: {
        template: true,
        user: true,
      },
    });

    // Calculate basic metrics
    const totalSent = notifications.length;
    const totalDelivered = notifications.filter(n => n.status === 'DELIVERED').length;
    const totalFailed = notifications.filter(n => n.status === 'FAILED').length;
    const totalRead = notifications.filter(n => n.readAt !== null).length;

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const readRate = totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0;
    const failureRate = totalSent > 0 ? (totalFailed / totalSent) * 100 : 0;

    // Calculate average delivery time
    const deliveredNotifications = notifications.filter(n => n.deliveredAt);
    const averageDeliveryTime = deliveredNotifications.length > 0
      ? deliveredNotifications.reduce((sum, n) => {
          return sum + (n.deliveredAt!.getTime() - n.createdAt.getTime());
        }, 0) / deliveredNotifications.length
      : 0;

    // Generate channel breakdown
    const channelBreakdown = await this.generateChannelBreakdown(notifications);

    // Generate time series data
    const timeSeriesData = await this.generateTimeSeriesData(notifications, startDate, endDate);

    // Get top templates
    const topTemplates = await this.getTopTemplates(notifications);

    // Get user engagement metrics
    const userEngagement = await this.getUserEngagementMetrics(tenantId, notifications);

    const analytics: NotificationAnalytics = {
      totalSent,
      totalDelivered,
      totalFailed,
      totalRead,
      deliveryRate,
      readRate,
      failureRate,
      averageDeliveryTime,
      channelBreakdown,
      timeSeriesData,
      topTemplates,
      userEngagement,
    };

    // Cache the results for 15 minutes
    await this.cacheService.set(cacheKey, analytics, 900);

    return analytics;
  }

  /**
   * Get delivery rate analytics by channel
   */
  async getDeliveryRateByChannel(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ channel: string; deliveryRate: number; volume: number }[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        channel: true,
        status: true,
      },
    });

    const channelStats = notifications.reduce((acc, notification) => {
      if (!acc[notification.channel]) {
        acc[notification.channel] = { sent: 0, delivered: 0 };
      }
      acc[notification.channel].sent++;
      if (notification.status === 'DELIVERED') {
        acc[notification.channel].delivered++;
      }
      return acc;
    }, {} as Record<string, { sent: number; delivered: number }>);

    return Object.entries(channelStats).map(([channel, stats]) => ({
      channel,
      deliveryRate: stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0,
      volume: stats.sent,
    }));
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UserEngagementMetrics> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: true,
      },
    });

    return this.getUserEngagementMetrics(tenantId, notifications);
  }

  /**
   * Create A/B test for notification templates
   */
  async createABTest(
    tenantId: string,
    testName: string,
    variants: {
      name: string;
      templateId: string;
      percentage: number;
    }[],
    targetAudience: {
      userIds?: string[];
      roles?: string[];
      segments?: string[];
    },
    duration: number, // in days
  ): Promise<ABTestResult> {
    // Validate that percentages add up to 100
    const totalPercentage = variants.reduce((sum, v) => sum + v.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error('Variant percentages must add up to 100%');
    }

    const testId = `ab_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

    // Store A/B test configuration
    const testConfig = {
      testId,
      testName,
      tenantId,
      variants,
      targetAudience,
      startDate,
      endDate,
      status: 'running' as const,
    };

    await this.cacheService.set(`ab_test:${testId}`, testConfig, duration * 24 * 60 * 60);

    this.logger.log(`Created A/B test: ${testId} for tenant: ${tenantId}`);

    return {
      testId,
      testName,
      status: 'running',
      variants: variants.map(v => ({
        name: v.name,
        sent: 0,
        delivered: 0,
        read: 0,
        conversionRate: 0,
      })),
      confidence: 0,
      startDate,
      endDate,
    };
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<ABTestResult | null> {
    const testConfig = await this.cacheService.get(`ab_test:${testId}`);
    if (!testConfig) {
      return null;
    }

    // Get notifications sent as part of this test
    const testNotifications = await this.prisma.notification.findMany({
      where: {
        metadata: {
          path: ['abTestId'],
          equals: testId,
        },
      },
    });

    // Calculate results for each variant
    const variantResults = testConfig.variants.map(variant => {
      const variantNotifications = testNotifications.filter(
        n => n.metadata?.['variant'] === variant.name
      );

      const sent = variantNotifications.length;
      const delivered = variantNotifications.filter(n => n.status === 'DELIVERED').length;
      const read = variantNotifications.filter(n => n.readAt !== null).length;
      const conversionRate = delivered > 0 ? (read / delivered) * 100 : 0;

      return {
        name: variant.name,
        sent,
        delivered,
        read,
        conversionRate,
      };
    });

    // Calculate statistical confidence
    const confidence = this.calculateStatisticalConfidence(variantResults);

    // Determine winner if test is completed
    let winner: string | undefined;
    if (testConfig.status === 'completed' || new Date() > testConfig.endDate) {
      winner = variantResults.reduce((best, current) =>
        current.conversionRate > best.conversionRate ? current : best
      ).name;
    }

    return {
      testId,
      testName: testConfig.testName,
      status: new Date() > testConfig.endDate ? 'completed' : testConfig.status,
      variants: variantResults,
      winner,
      confidence,
      startDate: testConfig.startDate,
      endDate: testConfig.endDate,
    };
  }

  /**
   * Get notification performance by template
   */
  async getTemplatePerformance(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TemplateMetrics[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        templateId: { not: null },
      },
      include: {
        template: true,
      },
    });

    return this.getTopTemplates(notifications);
  }

  /**
   * Get real-time notification metrics
   */
  async getRealTimeMetrics(tenantId: string): Promise<{
    currentHourSent: number;
    currentHourDelivered: number;
    currentHourFailed: number;
    queueSize: number;
    averageProcessingTime: number;
    systemHealth: 'healthy' | 'warning' | 'critical';
  }> {
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);

    const hourlyNotifications = await this.prisma.notification.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: currentHour,
        },
      },
    });

    const currentHourSent = hourlyNotifications.length;
    const currentHourDelivered = hourlyNotifications.filter(n => n.status === 'DELIVERED').length;
    const currentHourFailed = hourlyNotifications.filter(n => n.status === 'FAILED').length;

    // Mock queue size and processing time (would come from actual queue service)
    const queueSize = Math.floor(Math.random() * 100);
    const averageProcessingTime = Math.random() * 5000; // milliseconds

    // Determine system health
    const failureRate = currentHourSent > 0 ? (currentHourFailed / currentHourSent) * 100 : 0;
    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (failureRate > 10 || queueSize > 1000) {
      systemHealth = 'critical';
    } else if (failureRate > 5 || queueSize > 500) {
      systemHealth = 'warning';
    }

    return {
      currentHourSent,
      currentHourDelivered,
      currentHourFailed,
      queueSize,
      averageProcessingTime,
      systemHealth,
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv',
  ): Promise<string> {
    const analytics = await this.getAnalytics(tenantId, startDate, endDate);

    if (format === 'json') {
      return JSON.stringify(analytics, null, 2);
    }

    // CSV format
    const headers = [
      'Date', 'Channel', 'Sent', 'Delivered', 'Failed', 'Read',
      'DeliveryRate', 'ReadRate', 'FailureRate'
    ];

    const rows = analytics.timeSeriesData.map(point => [
      point.timestamp.toISOString(),
      'All',
      point.sent,
      point.delivered,
      point.failed,
      point.read,
      point.sent > 0 ? ((point.delivered / point.sent) * 100).toFixed(2) : '0',
      point.delivered > 0 ? ((point.read / point.delivered) * 100).toFixed(2) : '0',
      point.sent > 0 ? ((point.failed / point.sent) * 100).toFixed(2) : '0',
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private async generateChannelBreakdown(notifications: any[]): Promise<NotificationAnalytics['channelBreakdown']> {
    const channels = ['email', 'sms', 'push', 'websocket', 'inApp'];
    const breakdown = {} as NotificationAnalytics['channelBreakdown'];

    for (const channel of channels) {
      const channelNotifications = notifications.filter(n => n.channel === channel);
      const sent = channelNotifications.length;
      const delivered = channelNotifications.filter(n => n.status === 'DELIVERED').length;
      const failed = channelNotifications.filter(n => n.status === 'FAILED').length;
      const read = channelNotifications.filter(n => n.readAt !== null).length;

      const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
      const readRate = delivered > 0 ? (read / delivered) * 100 : 0;

      // Calculate average delivery time
      const deliveredChannelNotifications = channelNotifications.filter(n => n.deliveredAt);
      const averageDeliveryTime = deliveredChannelNotifications.length > 0
        ? deliveredChannelNotifications.reduce((sum, n) => {
            return sum + (n.deliveredAt.getTime() - n.createdAt.getTime());
          }, 0) / deliveredChannelNotifications.length
        : 0;

      // Mock cost calculation (would be based on actual provider costs)
      const cost = this.calculateChannelCost(channel, sent);

      breakdown[channel] = {
        sent,
        delivered,
        failed,
        read,
        deliveryRate,
        readRate,
        averageDeliveryTime,
        cost,
      };
    }

    return breakdown;
  }

  private async generateTimeSeriesData(
    notifications: any[],
    startDate: Date,
    endDate: Date,
  ): Promise<TimeSeriesPoint[]> {
    const timeSeriesData: TimeSeriesPoint[] = [];
    const dayMs = 24 * 60 * 60 * 1000;

    for (let date = new Date(startDate); date <= endDate; date.setTime(date.getTime() + dayMs)) {
      const dayStart = new Date(date);
      const dayEnd = new Date(date.getTime() + dayMs);

      const dayNotifications = notifications.filter(n =>
        n.createdAt >= dayStart && n.createdAt < dayEnd
      );

      timeSeriesData.push({
        timestamp: new Date(date),
        sent: dayNotifications.length,
        delivered: dayNotifications.filter(n => n.status === 'DELIVERED').length,
        failed: dayNotifications.filter(n => n.status === 'FAILED').length,
        read: dayNotifications.filter(n => n.readAt !== null).length,
      });
    }

    return timeSeriesData;
  }

  private async getTopTemplates(notifications: any[]): Promise<TemplateMetrics[]> {
    const templateStats = notifications.reduce((acc, notification) => {
      if (!notification.templateId) return acc;

      const templateId = notification.templateId;
      if (!acc[templateId]) {
        acc[templateId] = {
          templateId,
          templateName: notification.template?.name || 'Unknown',
          sent: 0,
          delivered: 0,
          read: 0,
        };
      }

      acc[templateId].sent++;
      if (notification.status === 'DELIVERED') {
        acc[templateId].delivered++;
      }
      if (notification.readAt) {
        acc[templateId].read++;
      }

      return acc;
    }, {} as Record<string, any>);

    return Object.values(templateStats)
      .map(template => ({
        ...template,
        deliveryRate: template.sent > 0 ? (template.delivered / template.sent) * 100 : 0,
        readRate: template.delivered > 0 ? (template.read / template.delivered) * 100 : 0,
        engagement: template.sent > 0 ? (template.read / template.sent) * 100 : 0,
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10);
  }

  private async getUserEngagementMetrics(
    tenantId: string,
    notifications: any[],
  ): Promise<UserEngagementMetrics> {
    const userStats = notifications.reduce((acc, notification) => {
      const userId = notification.userId;
      if (!acc[userId]) {
        acc[userId] = {
          userId,
          userName: notification.user?.name || 'Unknown',
          notificationsReceived: 0,
          notificationsRead: 0,
        };
      }

      acc[userId].notificationsReceived++;
      if (notification.readAt) {
        acc[userId].notificationsRead++;
      }

      return acc;
    }, {} as Record<string, any>);

    const userMetrics = Object.values(userStats).map(user => ({
      ...user,
      engagementRate: user.notificationsReceived > 0
        ? (user.notificationsRead / user.notificationsReceived) * 100
        : 0,
    }));

    const activeUsers = userMetrics.filter(u => u.notificationsReceived > 0).length;
    const totalNotifications = notifications.length;
    const totalRead = notifications.filter(n => n.readAt).length;
    const engagementRate = totalNotifications > 0 ? (totalRead / totalNotifications) * 100 : 0;
    const averageNotificationsPerUser = activeUsers > 0 ? totalNotifications / activeUsers : 0;

    const topEngagedUsers = userMetrics
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 10);

    // Mock segment analysis
    const segmentAnalysis = [
      { segment: 'Teachers', users: Math.floor(activeUsers * 0.3), engagementRate: 85, preferredChannel: 'email' },
      { segment: 'Students', users: Math.floor(activeUsers * 0.6), engagementRate: 65, preferredChannel: 'push' },
      { segment: 'Admins', users: Math.floor(activeUsers * 0.1), engagementRate: 95, preferredChannel: 'email' },
    ];

    return {
      activeUsers,
      engagementRate,
      averageNotificationsPerUser,
      topEngagedUsers,
      segmentAnalysis,
    };
  }

  private calculateChannelCost(channel: string, sent: number): number {
    // Mock cost calculation based on typical provider pricing
    const costs = {
      email: 0.001, // $0.001 per email
      sms: 0.05,    // $0.05 per SMS
      push: 0.0001, // $0.0001 per push notification
      websocket: 0, // Free
      inApp: 0,     // Free
    };

    return (costs[channel] || 0) * sent;
  }

  private calculateStatisticalConfidence(variants: any[]): number {
    // Simplified statistical confidence calculation
    // In a real implementation, you'd use proper statistical tests
    if (variants.length < 2) return 0;

    const totalSamples = variants.reduce((sum, v) => sum + v.sent, 0);
    if (totalSamples < 100) return 0; // Need minimum sample size

    // Mock confidence calculation based on sample size and difference
    const maxRate = Math.max(...variants.map(v => v.conversionRate));
    const minRate = Math.min(...variants.map(v => v.conversionRate));
    const difference = maxRate - minRate;

    if (difference < 1) return 50; // Low confidence for small differences
    if (difference < 5) return 75;
    if (difference < 10) return 90;
    return 95;
  }
}
