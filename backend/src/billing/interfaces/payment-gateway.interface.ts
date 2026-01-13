import {
  PaymentGateway,
  PaymentGatewayConfig,
  PaymentGatewayResponse,
  CustomerData,
  PaymentIntentData,
  SubscriptionData,
  WebhookEvent,
  CreateCustomerOptions,
  CreatePaymentIntentOptions,
  CreateSubscriptionOptions,
  UpdateSubscriptionOptions,
  RefundOptions,
} from './payment-types.interface';

/**
 * Abstract interface that all payment gateway implementations must follow
 * This ensures consistent behavior across different payment providers
 */
export abstract class IPaymentGateway {
  protected config: PaymentGatewayConfig;
  
  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  /**
   * Get the gateway type
   */
  abstract getGateway(): PaymentGateway;

  /**
   * Initialize the gateway with configuration
   */
  abstract initialize(): Promise<void>;

  /**
   * Check if the gateway is healthy and operational
   */
  abstract healthCheck(): Promise<boolean>;

  // ==================== CUSTOMER MANAGEMENT ====================

  /**
   * Create a new customer in the payment gateway
   */
  abstract createCustomer(
    options: CreateCustomerOptions,
  ): Promise<PaymentGatewayResponse<CustomerData>>;

  /**
   * Retrieve customer information
   */
  abstract getCustomer(
    customerId: string,
  ): Promise<PaymentGatewayResponse<CustomerData>>;

  /**
   * Update customer information
   */
  abstract updateCustomer(
    customerId: string,
    updates: Partial<CreateCustomerOptions>,
  ): Promise<PaymentGatewayResponse<CustomerData>>;

  /**
   * Delete a customer
   */
  abstract deleteCustomer(
    customerId: string,
  ): Promise<PaymentGatewayResponse<boolean>>;

  // ==================== PAYMENT PROCESSING ====================

  /**
   * Create a payment intent for one-time payments
   */
  abstract createPaymentIntent(
    options: CreatePaymentIntentOptions,
  ): Promise<PaymentGatewayResponse<PaymentIntentData>>;

  /**
   * Confirm a payment intent
   */
  abstract confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<PaymentGatewayResponse<PaymentIntentData>>;

  /**
   * Retrieve payment intent information
   */
  abstract getPaymentIntent(
    paymentIntentId: string,
  ): Promise<PaymentGatewayResponse<PaymentIntentData>>;

  /**
   * Cancel a payment intent
   */
  abstract cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<PaymentGatewayResponse<PaymentIntentData>>;

  /**
   * Process a refund
   */
  abstract refundPayment(
    options: RefundOptions,
  ): Promise<PaymentGatewayResponse<any>>;

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  /**
   * Create a new subscription
   */
  abstract createSubscription(
    options: CreateSubscriptionOptions,
  ): Promise<PaymentGatewayResponse<SubscriptionData>>;

  /**
   * Retrieve subscription information
   */
  abstract getSubscription(
    subscriptionId: string,
  ): Promise<PaymentGatewayResponse<SubscriptionData>>;

  /**
   * Update an existing subscription
   */
  abstract updateSubscription(
    subscriptionId: string,
    options: UpdateSubscriptionOptions,
  ): Promise<PaymentGatewayResponse<SubscriptionData>>;

  /**
   * Cancel a subscription
   */
  abstract cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd?: boolean,
  ): Promise<PaymentGatewayResponse<SubscriptionData>>;

  /**
   * Resume a canceled subscription
   */
  abstract resumeSubscription(
    subscriptionId: string,
  ): Promise<PaymentGatewayResponse<SubscriptionData>>;

  // ==================== WEBHOOK HANDLING ====================

  /**
   * Verify webhook signature
   */
  abstract verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean;

  /**
   * Parse webhook event
   */
  abstract parseWebhookEvent(
    payload: string,
    signature: string,
  ): Promise<PaymentGatewayResponse<WebhookEvent>>;

  /**
   * Handle webhook event
   */
  abstract handleWebhookEvent(
    event: WebhookEvent,
  ): Promise<PaymentGatewayResponse<any>>;

  // ==================== UTILITY METHODS ====================

  /**
   * Get supported currencies for this gateway
   */
  getSupportedCurrencies(): string[] {
    return this.config.supportedCurrencies;
  }

  /**
   * Get supported countries for this gateway
   */
  getSupportedCountries(): string[] {
    return this.config.supportedCountries;
  }

  /**
   * Get supported payment methods for this gateway
   */
  getSupportedPaymentMethods(): string[] {
    return this.config.supportedPaymentMethods;
  }

  /**
   * Check if gateway supports a specific currency
   */
  supportsCurrency(currency: string): boolean {
    return this.config.supportedCurrencies.includes(currency.toUpperCase());
  }

  /**
   * Check if gateway supports a specific country
   */
  supportsCountry(country: string): boolean {
    return this.config.supportedCountries.includes(country.toUpperCase());
  }

  /**
   * Check if gateway is enabled
   */
  isEnabled(): boolean {
    return this.config.isEnabled;
  }

  /**
   * Get gateway priority (lower number = higher priority)
   */
  getPriority(): number {
    return this.config.priority;
  }

  /**
   * Convert gateway-specific error to standardized format
   */
  protected abstract normalizeError(error: any): PaymentGatewayResponse<never>;

  /**
   * Convert amount to gateway-specific format (e.g., cents for Stripe)
   */
  protected abstract formatAmount(amount: number, currency: string): number;

  /**
   * Convert amount from gateway-specific format to standard format
   */
  protected abstract parseAmount(amount: number, currency: string): number;
}

/**
 * Factory interface for creating payment gateway instances
 */
export interface IPaymentGatewayFactory {
  createGateway(
    gateway: PaymentGateway,
    config: PaymentGatewayConfig,
  ): IPaymentGateway;
  
  getSupportedGateways(): PaymentGateway[];
}
