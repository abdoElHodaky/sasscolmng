import { IsOptional, IsDateString, IsEnum, IsString, IsNumber } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { BillingPlanType, SubscriptionStatus, PaymentStatus } from '@prisma/client';

export class BillingAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for analytics period',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for analytics period',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific plan type',
    enum: BillingPlanType,
    example: BillingPlanType.PROFESSIONAL,
  })
  @IsOptional()
  @IsEnum(BillingPlanType)
  planType?: BillingPlanType;

  @ApiPropertyOptional({
    description: 'Filter by subscription status',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'School ID to filter analytics',
    example: 'sch_1234567890',
  })
  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class RevenueMetricsDto {
  @ApiProperty({
    description: 'Total revenue in cents',
    example: 125000,
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Monthly recurring revenue (MRR) in cents',
    example: 45000,
  })
  monthlyRecurringRevenue: number;

  @ApiProperty({
    description: 'Annual recurring revenue (ARR) in cents',
    example: 540000,
  })
  annualRecurringRevenue: number;

  @ApiProperty({
    description: 'Average revenue per user (ARPU) in cents',
    example: 7999,
  })
  averageRevenuePerUser: number;

  @ApiProperty({
    description: 'Revenue growth rate as percentage',
    example: 15.5,
  })
  revenueGrowthRate: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;
}

export class SubscriptionMetricsDto {
  @ApiProperty({
    description: 'Total active subscriptions',
    example: 150,
  })
  totalActiveSubscriptions: number;

  @ApiProperty({
    description: 'New subscriptions this period',
    example: 25,
  })
  newSubscriptions: number;

  @ApiProperty({
    description: 'Canceled subscriptions this period',
    example: 5,
  })
  canceledSubscriptions: number;

  @ApiProperty({
    description: 'Churn rate as percentage',
    example: 3.3,
  })
  churnRate: number;

  @ApiProperty({
    description: 'Subscription growth rate as percentage',
    example: 13.3,
  })
  subscriptionGrowthRate: number;

  @ApiProperty({
    description: 'Subscriptions by plan type',
    example: {
      STARTER: 50,
      PROFESSIONAL: 75,
      ENTERPRISE: 25,
    },
  })
  subscriptionsByPlan: Record<string, number>;

  @ApiProperty({
    description: 'Trial conversion rate as percentage',
    example: 65.5,
  })
  trialConversionRate: number;
}

export class PaymentMetricsDto {
  @ApiProperty({
    description: 'Total payments processed',
    example: 180,
  })
  totalPayments: number;

  @ApiProperty({
    description: 'Successful payments',
    example: 175,
  })
  successfulPayments: number;

  @ApiProperty({
    description: 'Failed payments',
    example: 5,
  })
  failedPayments: number;

  @ApiProperty({
    description: 'Payment success rate as percentage',
    example: 97.2,
  })
  paymentSuccessRate: number;

  @ApiProperty({
    description: 'Total refunds processed',
    example: 3,
  })
  totalRefunds: number;

  @ApiProperty({
    description: 'Total refund amount in cents',
    example: 23997,
  })
  totalRefundAmount: number;

  @ApiProperty({
    description: 'Average payment amount in cents',
    example: 7999,
  })
  averagePaymentAmount: number;
}

export class UsageMetricsDto {
  @ApiProperty({
    description: 'Total students across all subscriptions',
    example: 5000,
  })
  totalStudents: number;

  @ApiProperty({
    description: 'Total teachers across all subscriptions',
    example: 250,
  })
  totalTeachers: number;

  @ApiProperty({
    description: 'Total classes across all subscriptions',
    example: 1200,
  })
  totalClasses: number;

  @ApiProperty({
    description: 'Average students per subscription',
    example: 33.3,
  })
  averageStudentsPerSubscription: number;

  @ApiProperty({
    description: 'Usage by plan type',
    example: {
      STARTER: { students: 1000, teachers: 50, classes: 200 },
      PROFESSIONAL: { students: 3000, teachers: 150, classes: 700 },
      ENTERPRISE: { students: 1000, teachers: 50, classes: 300 },
    },
  })
  usageByPlan: Record<string, Record<string, number>>;
}

export class BillingAnalyticsResponseDto {
  @ApiProperty({
    description: 'Analytics period start date',
    example: '2024-01-01T00:00:00.000Z',
  })
  periodStart: Date;

  @ApiProperty({
    description: 'Analytics period end date',
    example: '2024-12-31T23:59:59.000Z',
  })
  periodEnd: Date;

  @ApiProperty({
    description: 'Revenue metrics',
    type: RevenueMetricsDto,
  })
  revenue: RevenueMetricsDto;

  @ApiProperty({
    description: 'Subscription metrics',
    type: SubscriptionMetricsDto,
  })
  subscriptions: SubscriptionMetricsDto;

  @ApiProperty({
    description: 'Payment metrics',
    type: PaymentMetricsDto,
  })
  payments: PaymentMetricsDto;

  @ApiProperty({
    description: 'Usage metrics',
    type: UsageMetricsDto,
  })
  usage: UsageMetricsDto;

  @ApiProperty({
    description: 'When analytics were generated',
    example: '2024-01-01T12:00:00.000Z',
  })
  generatedAt: Date;
}
