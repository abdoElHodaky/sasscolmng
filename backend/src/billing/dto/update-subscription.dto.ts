import { IsString, IsEnum, IsOptional, IsBoolean, IsObject, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, SubscriptionStatus } from '@prisma/client';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: 'New billing plan ID to change to',
    example: 'clp123abc456def789',
  })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({
    description: 'New billing cycle',
    enum: BillingCycle,
    example: BillingCycle.YEARLY,
  })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({
    description: 'Whether to cancel at the end of current period',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata for the subscription',
    example: { reason: 'upgrade', source: 'admin_panel' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Whether to cancel immediately or at period end',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  immediately?: boolean;

  @ApiPropertyOptional({
    description: 'Reason for cancellation',
    example: 'Customer requested cancellation',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for cancellation',
    example: { feedback: 'Too expensive', rating: 3 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ChangePlanDto {
  @ApiPropertyOptional({
    description: 'New billing plan ID',
    example: 'clp123abc456def789',
  })
  @IsString()
  newPlanId: string;

  @ApiPropertyOptional({
    description: 'Whether to prorate the change',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  prorate?: boolean;

  @ApiPropertyOptional({
    description: 'Effective date for the plan change (defaults to now)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for plan change',
    example: { reason: 'upgrade', source: 'billing_page' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SubscriptionUpdateResponseDto {
  @ApiPropertyOptional({
    description: 'Updated subscription details',
  })
  subscription: {
    id: string;
    status: SubscriptionStatus;
    planId: string;
    billingCycle: BillingCycle;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt?: Date;
  };

  @ApiPropertyOptional({
    description: 'Proration details if applicable',
  })
  proration?: {
    amount: number;
    currency: string;
    description: string;
  };

  @ApiPropertyOptional({
    description: 'Next invoice preview if plan changed',
  })
  nextInvoice?: {
    amount: number;
    currency: string;
    dueDate: Date;
    lineItems: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
  };
}
