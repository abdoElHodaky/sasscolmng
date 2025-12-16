import { IsString, IsEnum, IsOptional, IsDateString, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '@prisma/client';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'ID of the billing plan to subscribe to',
    example: 'clp123abc456def789',
  })
  @IsString()
  planId: string;

  @ApiProperty({
    description: 'ID of the school for this subscription',
    example: 'cls123abc456def789',
  })
  @IsString()
  schoolId: string;

  @ApiProperty({
    description: 'Billing cycle for the subscription',
    enum: BillingCycle,
    example: BillingCycle.MONTHLY,
  })
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiPropertyOptional({
    description: 'Start date for the subscription (defaults to now)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Whether to start with a trial period',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  startTrial?: boolean;

  @ApiPropertyOptional({
    description: 'Stripe customer ID if customer already exists',
    example: 'cus_1234567890',
  })
  @IsOptional()
  @IsString()
  stripeCustomerId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the subscription',
    example: { source: 'web', campaign: 'spring2024' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SubscriptionResponseDto {
  @ApiProperty({
    description: 'Subscription ID',
    example: 'sub_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Subscription status',
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    description: 'Current billing period start',
    example: '2024-01-01T00:00:00.000Z',
  })
  currentPeriodStart: string;

  @ApiProperty({
    description: 'Current billing period end',
    example: '2024-02-01T00:00:00.000Z',
  })
  currentPeriodEnd: string;

  @ApiProperty({
    description: 'Billing plan details',
  })
  plan: {
    id: string;
    name: string;
    type: string;
    monthlyPrice: number;
    yearlyPrice?: number;
  };

  @ApiPropertyOptional({
    description: 'Trial end date if in trial',
    example: '2024-01-15T00:00:00.000Z',
  })
  trialEnd?: string;

  @ApiPropertyOptional({
    description: 'Stripe subscription ID',
    example: 'sub_1234567890',
  })
  stripeSubscriptionId?: string;
}
