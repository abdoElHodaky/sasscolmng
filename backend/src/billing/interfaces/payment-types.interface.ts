export enum PaymentGateway {
  STRIPE = 'stripe',
  PAYTABS = 'paytabs',
  PAYMOB = 'paymob',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
  REQUIRES_ACTION = 'requires_action',
  REQUIRES_PAYMENT_METHOD = 'requires_payment_method',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
}

export interface PaymentGatewayConfig {
  gateway: PaymentGateway;
  isEnabled: boolean;
  priority: number;
  supportedCurrencies: string[];
  supportedCountries: string[];
  supportedPaymentMethods: string[];
  webhookEndpoint: string;
  credentials: {
    publicKey?: string;
    secretKey?: string;
    merchantId?: string;
    profileId?: string;
    serverKey?: string;
    [key: string]: any;
  };
}

export interface CustomerData {
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentMethodData {
  id?: string;
  type: string;
  card?: {
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
  };
  metadata?: Record<string, any>;
}

export interface PaymentIntentData {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  clientSecret?: string;
  paymentMethodId?: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, any>;
  gatewaySpecific?: Record<string, any>;
}

export interface SubscriptionData {
  id: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  metadata?: Record<string, any>;
  gatewaySpecific?: Record<string, any>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  gateway: PaymentGateway;
  data: any;
  created: Date;
  livemode: boolean;
}

export interface PaymentGatewayError {
  code: string;
  message: string;
  type: 'card_error' | 'invalid_request_error' | 'api_error' | 'authentication_error' | 'rate_limit_error';
  gateway: PaymentGateway;
  originalError?: any;
}

export interface CreateCustomerOptions {
  email: string;
  name?: string;
  phone?: string;
  address?: CustomerData['address'];
  metadata?: Record<string, any>;
}

export interface CreatePaymentIntentOptions {
  amount: number;
  currency: string;
  customerId?: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, any>;
  automaticPaymentMethods?: boolean;
}

export interface CreateSubscriptionOptions {
  customerId: string;
  planId: string;
  paymentMethodId?: string;
  trialPeriodDays?: number;
  metadata?: Record<string, any>;
}

export interface UpdateSubscriptionOptions {
  planId?: string;
  paymentMethodId?: string;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, any>;
}

export interface RefundOptions {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface PaymentGatewayResponse<T = any> {
  success: boolean;
  data?: T;
  error?: PaymentGatewayError;
  gateway: PaymentGateway;
}
