import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum PayTabsTransactionType {
  SALE = 'sale',
  AUTHORIZE = 'auth',
  CAPTURE = 'capture',
  VOID = 'void',
  REFUND = 'refund',
}

export enum PayTabsTransactionClass {
  ECOM = 'ecom',
  MOTO = 'moto',
  RECURRING = 'recurring',
}

export enum PayTabsCurrency {
  SAR = 'SAR',
  AED = 'AED',
  KWD = 'KWD',
  QAR = 'QAR',
  BHD = 'BHD',
  OMR = 'OMR',
  JOD = 'JOD',
  EGP = 'EGP',
  USD = 'USD',
  EUR = 'EUR',
}

export class PayTabsCustomerDto {
  @ApiProperty({
    description: 'Customer reference ID',
    example: 'cust_123456',
  })
  @IsString()
  customer_ref: string;

  @ApiProperty({
    description: 'Customer name',
    example: 'Ahmed Al-Rashid',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Customer email address',
    example: 'ahmed@example.com',
  })
  @IsString()
  email: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '+966501234567',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Street address line 1',
    example: 'King Fahd Road',
    required: false,
  })
  @IsOptional()
  @IsString()
  street1?: string;

  @ApiProperty({
    description: 'City',
    example: 'Riyadh',
    required: false,
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    description: 'State or province',
    example: 'Riyadh Province',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'SA',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    description: 'Postal/ZIP code',
    example: '12345',
    required: false,
  })
  @IsOptional()
  @IsString()
  zip?: string;
}

export class CreatePayTabsPaymentDto {
  @ApiProperty({
    description: 'PayTabs profile ID',
    example: '12345',
  })
  @IsString()
  profile_id: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: PayTabsTransactionType,
    example: PayTabsTransactionType.SALE,
  })
  @IsEnum(PayTabsTransactionType)
  tran_type: PayTabsTransactionType;

  @ApiProperty({
    description: 'Transaction class',
    enum: PayTabsTransactionClass,
    example: PayTabsTransactionClass.ECOM,
  })
  @IsEnum(PayTabsTransactionClass)
  tran_class: PayTabsTransactionClass;

  @ApiProperty({
    description: 'Unique cart/order ID',
    example: 'cart_123456789',
  })
  @IsString()
  cart_id: string;

  @ApiProperty({
    description: 'Cart/order description',
    example: 'School Management Subscription - Professional Plan',
  })
  @IsString()
  cart_description: string;

  @ApiProperty({
    description: 'Payment currency',
    enum: PayTabsCurrency,
    example: PayTabsCurrency.SAR,
  })
  @IsEnum(PayTabsCurrency)
  cart_currency: PayTabsCurrency;

  @ApiProperty({
    description: 'Payment amount in currency base unit',
    example: 299.99,
  })
  @IsNumber()
  cart_amount: number;

  @ApiProperty({
    description: 'Customer details',
    type: PayTabsCustomerDto,
  })
  @ValidateNested()
  @Type(() => PayTabsCustomerDto)
  customer_details: PayTabsCustomerDto;

  @ApiProperty({
    description: 'Allowed payment methods',
    example: ['creditcard', 'mada', 'stcpay'],
    required: false,
  })
  @IsOptional()
  @IsString({ each: true })
  payment_methods?: string[];

  @ApiProperty({
    description: 'Webhook callback URL',
    example: 'https://api.example.com/webhooks/paytabs',
    required: false,
  })
  @IsOptional()
  @IsString()
  callback?: string;

  @ApiProperty({
    description: 'Return URL after payment',
    example: 'https://app.example.com/payment/return',
    required: false,
  })
  @IsOptional()
  @IsString()
  return?: string;

  @ApiProperty({
    description: 'Hide shipping address form',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  hide_shipping?: boolean;
}

export class PayTabsPaymentResponseDto {
  @ApiProperty({
    description: 'PayTabs transaction reference',
    example: 'TST2109200000084',
  })
  @IsString()
  tran_ref: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'sale',
  })
  @IsString()
  tran_type: string;

  @ApiProperty({
    description: 'Cart ID',
    example: 'cart_123456789',
  })
  @IsString()
  cart_id: string;

  @ApiProperty({
    description: 'Cart description',
    example: 'School Management Subscription',
  })
  @IsString()
  cart_description: string;

  @ApiProperty({
    description: 'Payment currency',
    example: 'SAR',
  })
  @IsString()
  cart_currency: string;

  @ApiProperty({
    description: 'Payment amount',
    example: '299.99',
  })
  @IsString()
  cart_amount: string;

  @ApiProperty({
    description: 'Payment result details',
  })
  payment_result: {
    response_status: string;
    response_code: string;
    response_message: string;
    transaction_time: string;
  };

  @ApiProperty({
    description: 'Payment method information',
    required: false,
  })
  @IsOptional()
  payment_info?: {
    payment_method: string;
    card_type?: string;
    card_scheme?: string;
    payment_description: string;
  };

  @ApiProperty({
    description: 'Customer details',
    type: PayTabsCustomerDto,
  })
  customer_details: PayTabsCustomerDto;

  @ApiProperty({
    description: 'Payment page redirect URL',
    example: 'https://secure.paytabs.sa/payment/page/...',
    required: false,
  })
  @IsOptional()
  @IsString()
  redirect_url?: string;
}

export class PayTabsRefundDto {
  @ApiProperty({
    description: 'PayTabs profile ID',
    example: '12345',
  })
  @IsString()
  profile_id: string;

  @ApiProperty({
    description: 'Original transaction reference to refund',
    example: 'TST2109200000084',
  })
  @IsString()
  tran_ref: string;

  @ApiProperty({
    description: 'Transaction type (refund)',
    example: 'refund',
  })
  @IsString()
  tran_type: string;

  @ApiProperty({
    description: 'Transaction class',
    enum: PayTabsTransactionClass,
    example: PayTabsTransactionClass.ECOM,
  })
  @IsEnum(PayTabsTransactionClass)
  tran_class: PayTabsTransactionClass;

  @ApiProperty({
    description: 'Refund cart ID',
    example: 'refund_123456789',
  })
  @IsString()
  cart_id: string;

  @ApiProperty({
    description: 'Refund description',
    example: 'Customer requested refund',
  })
  @IsString()
  cart_description: string;

  @ApiProperty({
    description: 'Refund currency',
    enum: PayTabsCurrency,
    example: PayTabsCurrency.SAR,
  })
  @IsEnum(PayTabsCurrency)
  cart_currency: PayTabsCurrency;

  @ApiProperty({
    description: 'Refund amount (optional for full refund)',
    example: 299.99,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  cart_amount?: number;
}

export class PayTabsQueryDto {
  @ApiProperty({
    description: 'PayTabs profile ID',
    example: '12345',
  })
  @IsString()
  profile_id: string;

  @ApiProperty({
    description: 'Transaction reference to query',
    example: 'TST2109200000084',
  })
  @IsString()
  tran_ref: string;
}

export class PayTabsWebhookDto {
  @ApiProperty({
    description: 'PayTabs transaction reference',
    example: 'TST2109200000084',
  })
  @IsString()
  tran_ref: string;

  @ApiProperty({
    description: 'Cart ID',
    example: 'cart_123456789',
  })
  @IsString()
  cart_id: string;

  @ApiProperty({
    description: 'Payment result',
  })
  payment_result: {
    response_status: string;
    response_code: string;
    response_message: string;
    transaction_time: string;
  };

  @ApiProperty({
    description: 'Payment information',
    required: false,
  })
  @IsOptional()
  payment_info?: {
    payment_method: string;
    card_type?: string;
    card_scheme?: string;
    payment_description: string;
  };

  @ApiProperty({
    description: 'Customer details',
    type: PayTabsCustomerDto,
  })
  customer_details: PayTabsCustomerDto;
}

export class PayTabsConfigDto {
  @ApiProperty({
    description: 'PayTabs server key',
    example: 'SBJHXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  serverKey: string;

  @ApiProperty({
    description: 'PayTabs profile ID',
    example: '12345',
  })
  @IsString()
  profileId: string;

  @ApiProperty({
    description: 'PayTabs base URL',
    example: 'https://secure.paytabs.sa',
    required: false,
  })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiProperty({
    description: 'Webhook endpoint URL',
    example: 'https://api.example.com/webhooks/paytabs',
  })
  @IsString()
  webhookEndpoint: string;

  @ApiProperty({
    description: 'Return URL after payment',
    example: 'https://app.example.com/payment/return',
  })
  @IsString()
  returnUrl: string;

  @ApiProperty({
    description: 'Supported currencies',
    example: ['SAR', 'AED', 'KWD', 'QAR', 'BHD'],
  })
  @IsString({ each: true })
  supportedCurrencies: string[];

  @ApiProperty({
    description: 'Supported countries',
    example: ['SA', 'AE', 'KW', 'QA', 'BH'],
  })
  @IsString({ each: true })
  supportedCountries: string[];

  @ApiProperty({
    description: 'Supported payment methods',
    example: ['creditcard', 'mada', 'stcpay', 'applepay'],
  })
  @IsString({ each: true })
  supportedPaymentMethods: string[];
}
