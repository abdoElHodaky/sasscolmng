import { IsString, IsNumber, IsOptional, IsEnum, IsObject, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class ProcessPaymentDto {
  @ApiProperty({
    description: 'Subscription ID for the payment',
    example: 'sub_1234567890',
  })
  @IsString()
  subscriptionId: string;

  @ApiPropertyOptional({
    description: 'Invoice ID if paying for specific invoice',
    example: 'inv_1234567890',
  })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiProperty({
    description: 'Payment amount in cents',
    example: 2999,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsString()
  currency: string = 'USD';

  @ApiPropertyOptional({
    description: 'Payment method (card, bank_transfer, etc.)',
    example: 'card',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Stripe payment method ID',
    example: 'pm_1234567890',
  })
  @IsOptional()
  @IsString()
  stripePaymentMethodId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the payment',
    example: { source: 'manual_payment', admin_id: 'usr_123' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class RefundPaymentDto {
  @ApiProperty({
    description: 'Payment ID to refund',
    example: 'pay_1234567890',
  })
  @IsString()
  paymentId: string;

  @ApiPropertyOptional({
    description: 'Refund amount in cents (defaults to full amount)',
    example: 1500,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Reason for refund',
    example: 'Customer requested refund',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the refund',
    example: { admin_id: 'usr_123', ticket_id: 'tkt_456' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: 'pay_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.COMPLETED,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: 'Payment amount in cents',
    example: 2999,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Payment method used',
    example: 'card',
  })
  paymentMethod: string;

  @ApiPropertyOptional({
    description: 'Stripe payment intent ID',
    example: 'pi_1234567890',
  })
  stripePaymentId?: string;

  @ApiPropertyOptional({
    description: 'Stripe charge ID',
    example: 'ch_1234567890',
  })
  stripeChargeId?: string;

  @ApiPropertyOptional({
    description: 'Failure reason if payment failed',
    example: 'Your card was declined.',
  })
  failureReason?: string;

  @ApiProperty({
    description: 'When payment was processed',
    example: '2024-01-01T12:00:00.000Z',
  })
  processedAt: Date;

  @ApiProperty({
    description: 'When payment was created',
    example: '2024-01-01T12:00:00.000Z',
  })
  createdAt: Date;
}

export class RefundResponseDto {
  @ApiProperty({
    description: 'Original payment ID',
    example: 'pay_1234567890',
  })
  paymentId: string;

  @ApiProperty({
    description: 'Refund amount in cents',
    example: 1500,
  })
  refundAmount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Refund status',
    example: 'succeeded',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Stripe refund ID',
    example: 're_1234567890',
  })
  stripeRefundId?: string;

  @ApiPropertyOptional({
    description: 'Reason for refund',
    example: 'Customer requested refund',
  })
  reason?: string;

  @ApiProperty({
    description: 'When refund was processed',
    example: '2024-01-01T12:00:00.000Z',
  })
  processedAt: Date;
}
