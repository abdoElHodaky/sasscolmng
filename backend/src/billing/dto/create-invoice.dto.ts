import { IsString, IsNumber, IsOptional, IsArray, IsDateString, IsObject, IsPositive, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';

export class InvoiceLineItemDto {
  @ApiProperty({
    description: 'Description of the line item',
    example: 'Professional Plan - Monthly',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Quantity of the item',
    example: 1,
  })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    description: 'Unit price in cents',
    example: 7999,
  })
  @IsNumber()
  @IsPositive()
  unitPrice: number;

  @ApiProperty({
    description: 'Total amount for this line item in cents',
    example: 7999,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for the line item',
    example: { planId: 'plan_123', period: '2024-01' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'Subscription ID for the invoice',
    example: 'sub_1234567890',
  })
  @IsString()
  subscriptionId: string;

  @ApiProperty({
    description: 'Billing period start date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  billingPeriodStart: string;

  @ApiProperty({
    description: 'Billing period end date',
    example: '2024-02-01T00:00:00.000Z',
  })
  @IsDateString()
  billingPeriodEnd: string;

  @ApiProperty({
    description: 'Invoice due date',
    example: '2024-01-15T00:00:00.000Z',
  })
  @IsDateString()
  dueDate: string;

  @ApiProperty({
    description: 'Line items for the invoice',
    type: [InvoiceLineItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems: InvoiceLineItemDto[];

  @ApiPropertyOptional({
    description: 'Tax amount in cents',
    example: 800,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  @ApiPropertyOptional({
    description: 'Discount amount in cents',
    example: 500,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Tax details breakdown',
    example: { rate: 0.1, type: 'VAT', jurisdiction: 'US-CA' },
  })
  @IsOptional()
  @IsObject()
  taxDetails?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Discount details',
    example: { code: 'SAVE10', type: 'percentage', value: 10 },
  })
  @IsOptional()
  @IsObject()
  discountDetails?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Additional metadata for the invoice',
    example: { source: 'automatic', billing_cycle: 'monthly' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class InvoiceResponseDto {
  @ApiProperty({
    description: 'Invoice ID',
    example: 'inv_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Invoice number',
    example: 'INV-2024-001',
  })
  invoiceNumber: string;

  @ApiProperty({
    description: 'Invoice status',
    enum: InvoiceStatus,
    example: InvoiceStatus.PENDING,
  })
  status: InvoiceStatus;

  @ApiProperty({
    description: 'Subtotal amount in cents',
    example: 7999,
  })
  subtotal: number;

  @ApiProperty({
    description: 'Tax amount in cents',
    example: 800,
  })
  taxAmount: number;

  @ApiProperty({
    description: 'Discount amount in cents',
    example: 500,
  })
  discountAmount: number;

  @ApiProperty({
    description: 'Total amount in cents',
    example: 8299,
  })
  total: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Billing period start',
    example: '2024-01-01T00:00:00.000Z',
  })
  billingPeriodStart: Date;

  @ApiProperty({
    description: 'Billing period end',
    example: '2024-02-01T00:00:00.000Z',
  })
  billingPeriodEnd: Date;

  @ApiProperty({
    description: 'Invoice due date',
    example: '2024-01-15T00:00:00.000Z',
  })
  dueDate: Date;

  @ApiProperty({
    description: 'Line items',
    type: [InvoiceLineItemDto],
  })
  lineItems: InvoiceLineItemDto[];

  @ApiPropertyOptional({
    description: 'Date when invoice was paid',
    example: '2024-01-10T12:00:00.000Z',
  })
  paidAt?: Date;

  @ApiPropertyOptional({
    description: 'Date when invoice was sent',
    example: '2024-01-01T09:00:00.000Z',
  })
  sentAt?: Date;

  @ApiPropertyOptional({
    description: 'URL to PDF invoice',
    example: 'https://example.com/invoices/inv_123.pdf',
  })
  pdfUrl?: string;

  @ApiPropertyOptional({
    description: 'Stripe invoice ID',
    example: 'in_1234567890',
  })
  stripeInvoiceId?: string;

  @ApiProperty({
    description: 'When invoice was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When invoice was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}
