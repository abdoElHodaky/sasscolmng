import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpStatus,
  ParseDatePipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetTenant } from '../../tenant/decorators/tenant.decorator';
import { NotificationAnalyticsService, NotificationAnalytics, ABTestResult } from '../services/analytics.service';
import { IsString, IsArray, IsNumber, IsOptional, IsDateString, Min, Max } from 'class-validator';

class GetAnalyticsDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[];
}

class CreateABTestDto {
  @IsString()
  testName: string;

  @IsArray()
  variants: {
    name: string;
    templateId: string;
    percentage: number;
  }[];

  @IsOptional()
  targetAudience?: {
    userIds?: string[];
    roles?: string[];
    segments?: string[];
  };

  @IsNumber()
  @Min(1)
  @Max(30)
  duration: number; // in days
}

@ApiTags('Notification Analytics')
@ApiBearerAuth()
@Controller('notifications/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationAnalyticsController {
  constructor(
    private readonly analyticsService: NotificationAnalyticsService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get comprehensive notification analytics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification analytics retrieved successfully',
  })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date (ISO string)' })
  @ApiQuery({ name: 'channels', type: [String], required: false, description: 'Filter by channels' })
  async getAnalytics(
    @GetTenant() tenantId: string,
    @Query(ValidationPipe) query: GetAnalyticsDto,
  ): Promise<NotificationAnalytics> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    return this.analyticsService.getAnalytics(
      tenantId,
      startDate,
      endDate,
      query.channels,
    );
  }

  @Get('delivery-rates')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get delivery rates by channel' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Delivery rates retrieved successfully',
  })
  async getDeliveryRates(
    @GetTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ channel: string; deliveryRate: number; volume: number }[]> {
    return this.analyticsService.getDeliveryRateByChannel(
      tenantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('user-engagement')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get user engagement analytics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User engagement analytics retrieved successfully',
  })
  async getUserEngagement(
    @GetTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getUserEngagementAnalytics(
      tenantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('templates/performance')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get template performance metrics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Template performance metrics retrieved successfully',
  })
  async getTemplatePerformance(
    @GetTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getTemplatePerformance(
      tenantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('real-time')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get real-time notification metrics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Real-time metrics retrieved successfully',
  })
  async getRealTimeMetrics(
    @GetTenant() tenantId: string,
  ) {
    return this.analyticsService.getRealTimeMetrics(tenantId);
  }

  @Post('ab-tests')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Create A/B test for notification templates' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'A/B test created successfully',
  })
  async createABTest(
    @GetTenant() tenantId: string,
    @Body(ValidationPipe) createABTestDto: CreateABTestDto,
  ): Promise<ABTestResult> {
    return this.analyticsService.createABTest(
      tenantId,
      createABTestDto.testName,
      createABTestDto.variants,
      createABTestDto.targetAudience || {},
      createABTestDto.duration,
    );
  }

  @Get('ab-tests/:testId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get A/B test results' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'A/B test results retrieved successfully',
  })
  async getABTestResults(
    @Param('testId') testId: string,
  ): Promise<ABTestResult | null> {
    return this.analyticsService.getABTestResults(testId);
  }

  @Get('export')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Export analytics data' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics data exported successfully',
  })
  @ApiQuery({ name: 'format', enum: ['json', 'csv'], description: 'Export format' })
  async exportAnalytics(
    @GetTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'json' | 'csv' = 'json',
  ): Promise<{ data: string; filename: string; contentType: string }> {
    const data = await this.analyticsService.exportAnalytics(
      tenantId,
      new Date(startDate),
      new Date(endDate),
      format,
    );

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `notification-analytics-${timestamp}.${format}`;
    const contentType = format === 'json' ? 'application/json' : 'text/csv';

    return {
      data,
      filename,
      contentType,
    };
  }

  @Get('dashboard')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get dashboard summary metrics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard metrics retrieved successfully',
  })
  async getDashboardMetrics(
    @GetTenant() tenantId: string,
  ) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    const [analytics, realTimeMetrics, deliveryRates] = await Promise.all([
      this.analyticsService.getAnalytics(tenantId, startDate, endDate),
      this.analyticsService.getRealTimeMetrics(tenantId),
      this.analyticsService.getDeliveryRateByChannel(tenantId, startDate, endDate),
    ]);

    return {
      summary: {
        totalSent: analytics.totalSent,
        deliveryRate: analytics.deliveryRate,
        readRate: analytics.readRate,
        failureRate: analytics.failureRate,
      },
      realTime: realTimeMetrics,
      channelPerformance: deliveryRates,
      topTemplates: analytics.topTemplates.slice(0, 5),
      userEngagement: {
        activeUsers: analytics.userEngagement.activeUsers,
        engagementRate: analytics.userEngagement.engagementRate,
      },
      trends: analytics.timeSeriesData.slice(-7), // Last 7 days
    };
  }

  @Get('health')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get notification system health status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System health status retrieved successfully',
  })
  async getSystemHealth(
    @GetTenant() tenantId: string,
  ) {
    const realTimeMetrics = await this.analyticsService.getRealTimeMetrics(tenantId);
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    const analytics = await this.analyticsService.getAnalytics(tenantId, startDate, endDate);

    return {
      status: realTimeMetrics.systemHealth,
      metrics: {
        deliveryRate: analytics.deliveryRate,
        failureRate: analytics.failureRate,
        averageDeliveryTime: analytics.averageDeliveryTime,
        queueSize: realTimeMetrics.queueSize,
        processingTime: realTimeMetrics.averageProcessingTime,
      },
      alerts: this.generateHealthAlerts(analytics, realTimeMetrics),
      recommendations: this.generateHealthRecommendations(analytics, realTimeMetrics),
    };
  }

  @Get('trends')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Get notification trends and insights' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification trends retrieved successfully',
  })
  async getTrends(
    @GetTenant() tenantId: string,
    @Query('period') period: '7d' | '30d' | '90d' = '30d',
  ) {
    const endDate = new Date();
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const analytics = await this.analyticsService.getAnalytics(tenantId, startDate, endDate);

    // Calculate trends
    const midPoint = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);
    const firstHalf = analytics.timeSeriesData.filter(point => point.timestamp < midPoint);
    const secondHalf = analytics.timeSeriesData.filter(point => point.timestamp >= midPoint);

    const firstHalfAvg = this.calculateAverage(firstHalf.map(p => p.sent));
    const secondHalfAvg = this.calculateAverage(secondHalf.map(p => p.sent));
    const volumeTrend = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

    const firstHalfDeliveryRate = this.calculateDeliveryRate(firstHalf);
    const secondHalfDeliveryRate = this.calculateDeliveryRate(secondHalf);
    const deliveryTrend = firstHalfDeliveryRate > 0 
      ? ((secondHalfDeliveryRate - firstHalfDeliveryRate) / firstHalfDeliveryRate) * 100 
      : 0;

    return {
      period,
      trends: {
        volume: {
          current: secondHalfAvg,
          previous: firstHalfAvg,
          change: volumeTrend,
          direction: volumeTrend > 0 ? 'up' : volumeTrend < 0 ? 'down' : 'stable',
        },
        deliveryRate: {
          current: secondHalfDeliveryRate,
          previous: firstHalfDeliveryRate,
          change: deliveryTrend,
          direction: deliveryTrend > 0 ? 'up' : deliveryTrend < 0 ? 'down' : 'stable',
        },
      },
      insights: this.generateInsights(analytics, volumeTrend, deliveryTrend),
      timeSeriesData: analytics.timeSeriesData,
    };
  }

  private generateHealthAlerts(analytics: NotificationAnalytics, realTimeMetrics: any): string[] {
    const alerts: string[] = [];

    if (analytics.failureRate > 10) {
      alerts.push(`High failure rate: ${analytics.failureRate.toFixed(1)}%`);
    }

    if (analytics.deliveryRate < 90) {
      alerts.push(`Low delivery rate: ${analytics.deliveryRate.toFixed(1)}%`);
    }

    if (realTimeMetrics.queueSize > 1000) {
      alerts.push(`High queue size: ${realTimeMetrics.queueSize} pending notifications`);
    }

    if (analytics.averageDeliveryTime > 60000) { // 1 minute
      alerts.push(`Slow delivery: ${(analytics.averageDeliveryTime / 1000).toFixed(1)}s average`);
    }

    return alerts;
  }

  private generateHealthRecommendations(analytics: NotificationAnalytics, realTimeMetrics: any): string[] {
    const recommendations: string[] = [];

    if (analytics.failureRate > 5) {
      recommendations.push('Review notification templates and recipient validation');
    }

    if (analytics.channelBreakdown.email.deliveryRate < 95) {
      recommendations.push('Check email service configuration and reputation');
    }

    if (analytics.channelBreakdown.sms.deliveryRate < 90) {
      recommendations.push('Verify SMS provider settings and phone number validation');
    }

    if (realTimeMetrics.queueSize > 500) {
      recommendations.push('Consider scaling notification processing workers');
    }

    if (analytics.userEngagement.engagementRate < 50) {
      recommendations.push('Review notification content and timing optimization');
    }

    return recommendations;
  }

  private generateInsights(analytics: NotificationAnalytics, volumeTrend: number, deliveryTrend: number): string[] {
    const insights: string[] = [];

    if (volumeTrend > 20) {
      insights.push('Notification volume is increasing significantly');
    } else if (volumeTrend < -20) {
      insights.push('Notification volume is decreasing significantly');
    }

    if (deliveryTrend > 5) {
      insights.push('Delivery performance is improving');
    } else if (deliveryTrend < -5) {
      insights.push('Delivery performance is declining');
    }

    const bestChannel = Object.entries(analytics.channelBreakdown)
      .reduce((best, [channel, metrics]) => 
        metrics.deliveryRate > best.rate ? { channel, rate: metrics.deliveryRate } : best,
        { channel: '', rate: 0 }
      );

    if (bestChannel.rate > 0) {
      insights.push(`${bestChannel.channel} has the highest delivery rate (${bestChannel.rate.toFixed(1)}%)`);
    }

    if (analytics.userEngagement.engagementRate > 70) {
      insights.push('User engagement is excellent');
    } else if (analytics.userEngagement.engagementRate < 30) {
      insights.push('User engagement needs improvement');
    }

    return insights;
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private calculateDeliveryRate(timeSeriesData: any[]): number {
    const totalSent = timeSeriesData.reduce((sum, point) => sum + point.sent, 0);
    const totalDelivered = timeSeriesData.reduce((sum, point) => sum + point.delivered, 0);
    return totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  }
}
