import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum PayMobCurrency {
  EGP = 'EGP',
  USD = 'USD',
  EUR = 'EUR',
}

export class PayMobBillingDataDto {
  @ApiProperty({
    description: 'Customer email address',
    example: 'customer@example.com',
  })
  @IsString()
  email: string;

  @ApiProperty({
    description: 'Customer first name',
    example: 'Ahmed',
  })
  @IsString()
  first_name: string;

  @ApiProperty({
    description: 'Customer last name',
    example: 'Hassan',
  })
  @IsString()
  last_name: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '+201234567890',
  })
  @IsString()
  phone_number: string;

  @ApiProperty({
    description: 'Country code',
    example: 'EG',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description: 'City',
    example: 'Cairo',
    required: false,
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    description: 'State or governorate',
    example: 'Cairo Governorate',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Street address',
    example: 'Tahrir Square',
    required: false,
  })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiProperty({
    description: 'Building number',
    example: '123',
    required: false,
  })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiProperty({
    description: 'Floor number',
    example: '5',
    required: false,
  })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiProperty({
    description: 'Apartment number',
    example: '12A',
    required: false,
  })
  @IsOptional()
  @IsString()
  apartment?: string;

  @ApiProperty({
    description: 'Postal code',
    example: '11511',
    required: false,
  })
  @IsOptional()
  @IsString()
  postal_code?: string;

  @ApiProperty({
    description: 'Shipping method',
    example: 'standard',
    required: false,
  })
  @IsOptional()
  @IsString()
  shipping_method?: string;
}

export class PayMobOrderItemDto {
  @ApiProperty({
    description: 'Item name',
    example: 'School Management Subscription',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Item amount in cents',
    example: 29999,
  })
  @IsNumber()
  amount_cents: number;

  @ApiProperty({
    description: 'Item description',
    example: 'Professional Plan - Monthly Subscription',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Item quantity',
    example: 1,
  })
  @IsNumber()
  quantity: number;
}

export class CreatePayMobOrderDto {
  @ApiProperty({
    description: 'PayMob authentication token',
    example: 'ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5...',
  })
  @IsString()
  auth_token: string;

  @ApiProperty({
    description: 'Whether delivery is needed',
    example: false,
  })
  @IsBoolean()
  delivery_needed: boolean;

  @ApiProperty({
    description: 'Total amount in cents',
    example: 29999,
  })
  @IsNumber()
  amount_cents: number;

  @ApiProperty({
    description: 'Payment currency',
    enum: PayMobCurrency,
    example: PayMobCurrency.EGP,
  })
  @IsEnum(PayMobCurrency)
  currency: PayMobCurrency;

  @ApiProperty({
    description: 'Order items',
    type: [PayMobOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayMobOrderItemDto)
  items: PayMobOrderItemDto[];

  @ApiProperty({
    description: 'Merchant order ID',
    example: 'order_123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  merchant_order_id?: string;
}

export class CreatePayMobPaymentKeyDto {
  @ApiProperty({
    description: 'PayMob authentication token',
    example: 'ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5...',
  })
  @IsString()
  auth_token: string;

  @ApiProperty({
    description: 'Payment amount in cents',
    example: 29999,
  })
  @IsNumber()
  amount_cents: number;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 3600,
  })
  @IsNumber()
  expiration: number;

  @ApiProperty({
    description: 'Order ID from PayMob order creation',
    example: 123456,
  })
  @IsNumber()
  order_id: number;

  @ApiProperty({
    description: 'Customer billing data',
    type: PayMobBillingDataDto,
  })
  @ValidateNested()
  @Type(() => PayMobBillingDataDto)
  billing_data: PayMobBillingDataDto;

  @ApiProperty({
    description: 'Payment currency',
    enum: PayMobCurrency,
    example: PayMobCurrency.EGP,
  })
  @IsEnum(PayMobCurrency)
  currency: PayMobCurrency;

  @ApiProperty({
    description: 'PayMob integration ID',
    example: 12345,
  })
  @IsNumber()
  integration_id: number;
}

export class PayMobOrderResponseDto {
  @ApiProperty({
    description: 'Order ID',
    example: 123456,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Order creation timestamp',
    example: '2023-12-01T10:30:00Z',
  })
  @IsString()
  created_at: string;

  @ApiProperty({
    description: 'Whether delivery is needed',
    example: false,
  })
  @IsBoolean()
  delivery_needed: boolean;

  @ApiProperty({
    description: 'Order amount in cents',
    example: 29999,
  })
  @IsNumber()
  amount_cents: number;

  @ApiProperty({
    description: 'Order currency',
    example: 'EGP',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    description: 'Merchant order ID',
    example: 'order_123456',
  })
  @IsString()
  merchant_order_id: string;

  @ApiProperty({
    description: 'Order URL',
    example: 'https://accept.paymob.com/api/ecommerce/orders/123456',
  })
  @IsString()
  order_url: string;

  @ApiProperty({
    description: 'Payment status flags',
  })
  is_payment_locked: boolean;
  is_return: boolean;
  is_cancel: boolean;
  is_returned: boolean;
  is_canceled: boolean;

  @ApiProperty({
    description: 'Paid amount in cents',
    example: 0,
  })
  @IsNumber()
  paid_amount_cents: number;
}

export class PayMobPaymentKeyResponseDto {
  @ApiProperty({
    description: 'Payment token for iframe/API usage',
    example: 'ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5...',
  })
  @IsString()
  token: string;
}

export class PayMobTransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 123456789,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Transaction success status',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Transaction pending status',
    example: false,
  })
  @IsBoolean()
  pending: boolean;

  @ApiProperty({
    description: 'Transaction amount in cents',
    example: 29999,
  })
  @IsNumber()
  amount_cents: number;

  @ApiProperty({
    description: 'Transaction currency',
    example: 'EGP',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    description: 'Order ID',
    example: 123456,
  })
  @IsNumber()
  order_id: number;

  @ApiProperty({
    description: 'Transaction creation timestamp',
    example: '2023-12-01T10:30:00Z',
  })
  @IsString()
  created_at: string;

  @ApiProperty({
    description: 'Payment method used',
    example: 'card',
    required: false,
  })
  @IsOptional()
  @IsString()
  source_data_type?: string;

  @ApiProperty({
    description: 'Transaction reference',
    example: 'TXN_123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  txn_response_code?: string;
}

export class PayMobWebhookDto {
  @ApiProperty({
    description: 'Transaction details',
    type: PayMobTransactionDto,
  })
  @ValidateNested()
  @Type(() => PayMobTransactionDto)
  obj: PayMobTransactionDto;

  @ApiProperty({
    description: 'Webhook event type',
    example: 'transaction',
  })
  @IsString()
  type: string;
}

export class PayMobRefundDto {
  @ApiProperty({
    description: 'PayMob authentication token',
    example: 'ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5...',
  })
  @IsString()
  auth_token: string;

  @ApiProperty({
    description: 'Transaction ID to refund',
    example: 123456789,
  })
  @IsNumber()
  transaction_id: number;

  @ApiProperty({
    description: 'Refund amount in cents (optional for full refund)',
    example: 29999,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  amount_cents?: number;
}

export class PayMobConfigDto {
  @ApiProperty({
    description: 'PayMob API key',
    example: 'ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5...',
  })
  @IsString()
  apiKey: string;

  @ApiProperty({
    description: 'PayMob integration ID',
    example: 12345,
  })
  @IsNumber()
  integrationId: number;

  @ApiProperty({
    description: 'PayMob iframe ID',
    example: 67890,
  })
  @IsNumber()
  iframeId: number;

  @ApiProperty({
    description: 'PayMob base URL',
    example: 'https://accept.paymob.com/api',
    required: false,
  })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiProperty({
    description: 'Webhook endpoint URL',
    example: 'https://api.example.com/webhooks/paymob',
  })
  @IsString()
  webhookEndpoint: string;

  @ApiProperty({
    description: 'Supported currencies',
    example: ['EGP', 'USD'],
  })
  @IsString({ each: true })
  supportedCurrencies: string[];

  @ApiProperty({
    description: 'Supported countries',
    example: ['EG'],
  })
  @IsString({ each: true })
  supportedCountries: string[];

  @ApiProperty({
    description: 'Supported payment methods',
    example: ['card', 'wallet', 'bank_installments'],
  })
  @IsString({ each: true })
  supportedPaymentMethods: string[];
}
