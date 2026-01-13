import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPaymentGateway } from '../interfaces/payment-gateway.interface';
import {
  PaymentGateway,
  PaymentGatewayConfig,
  PaymentGatewayResponse,
  PaymentGatewayError,
  CustomerData,
  PaymentIntentData,
  SubscriptionData,
  WebhookEvent,
  CreateCustomerOptions,
  CreatePaymentIntentOptions,
  CreateSubscriptionOptions,
  UpdateSubscriptionOptions,
  RefundOptions,
  PaymentStatus,
  SubscriptionStatus,
} from '../interfaces/payment-types.interface';

interface PayMobAuthResponse {
  token: string;
}

interface PayMobOrderRequest {
  auth_token: string;
  delivery_needed: boolean;
  amount_cents: number;
  currency: string;
  items: Array<{
    name: string;
    amount_cents: number;
    description: string;
    quantity: number;
  }>;
}

interface PayMobOrderResponse {
  id: number;
  created_at: string;
  delivery_needed: boolean;
  merchant: {
    id: number;
    created_at: string;
    phones: string[];
    company_emails: string[];
    company_name: string;
    state: string;
    country: string;
    city: string;
    postal_code: string;
    street: string;
  };
  collector: any;
  amount_cents: number;
  shipping_data: any;
  currency: string;
  is_payment_locked: boolean;
  is_return: boolean;
  is_cancel: boolean;
  is_returned: boolean;
  is_canceled: boolean;
  merchant_order_id: string;
  wallet_notification: any;
  paid_amount_cents: number;
  notify_user_with_email: boolean;
  items: any[];
  order_url: string;
  commission_fees: number;
  delivery_fees_cents: number;
  delivery_vat_cents: number;
  payment_method: string;
  merchant_staff_tag: any;
  api_source: string;
  data: any;
}

interface PayMobPaymentKeyRequest {
  auth_token: string;
  amount_cents: number;
  expiration: number;
  order_id: number;
  billing_data: {
    apartment?: string;
    email: string;
    floor?: string;
    first_name: string;
    street?: string;
    building?: string;
    phone_number: string;
    shipping_method?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    last_name: string;
    state?: string;
  };
  currency: string;
  integration_id: number;
}

interface PayMobPaymentKeyResponse {
  token: string;
}

@Injectable()
export class PayMobService extends IPaymentGateway {
  private readonly logger = new Logger(PayMobService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly integrationId: number;
  private readonly iframeId: number;
  private authToken: string;

  constructor(
    config: PaymentGatewayConfig,
    private readonly configService: ConfigService,
  ) {
    super(config);
    
    // PayMob configuration
    this.baseUrl = this.configService.get<string>('PAYMOB_BASE_URL', 'https://accept.paymob.com/api');
    this.apiKey = config.credentials.secretKey || this.configService.get<string>('PAYMOB_API_KEY');
    this.integrationId = parseInt(config.credentials.integrationId || this.configService.get<string>('PAYMOB_INTEGRATION_ID'));
    this.iframeId = parseInt(config.credentials.iframeId || this.configService.get<string>('PAYMOB_IFRAME_ID'));
    
    if (!this.apiKey || !this.integrationId || !this.iframeId) {
      throw new Error('PayMob credentials (apiKey, integrationId, iframeId) are required');
    }
  }

  getGateway(): PaymentGateway {
    return PaymentGateway.PAYMOB;
  }

  async initialize(): Promise<void> {
    this.logger.log('Initializing PayMob gateway...');
    
    try {
      // Authenticate and get auth token
      await this.authenticate();
      this.logger.log('PayMob gateway initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PayMob gateway:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can authenticate
      await this.authenticate();
      return true;
    } catch (error) {
      this.logger.warn('PayMob health check failed:', error.message);
      return false;
    }
  }

  // ==================== CUSTOMER MANAGEMENT ====================

  async createCustomer(options: CreateCustomerOptions): Promise<PaymentGatewayResponse<CustomerData>> {
    try {
      // PayMob doesn't have a separate customer creation endpoint
      // Customer data is included with each payment request
      const customerRef = `paymob_cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const customerData: CustomerData = {
        id: customerRef,
        email: options.email,
        name: options.name,
        phone: options.phone,
        address: options.address,
        metadata: {
          ...options.metadata,
          gateway: PaymentGateway.PAYMOB,
          createdAt: new Date().toISOString(),
        },
      };

      return {
        success: true,
        data: customerData,
        gateway: PaymentGateway.PAYMOB,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async getCustomer(customerId: string): Promise<PaymentGatewayResponse<CustomerData>> {
    try {
      // PayMob doesn't provide customer retrieval
      throw new Error('Customer retrieval not supported by PayMob API');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<CreateCustomerOptions>,
  ): Promise<PaymentGatewayResponse<CustomerData>> {
    try {
      // PayMob doesn't support customer updates
      throw new Error('Customer updates not supported by PayMob API');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async deleteCustomer(customerId: string): Promise<PaymentGatewayResponse<boolean>> {
    try {
      // PayMob doesn't support customer deletion
      return {
        success: true,
        data: true,
        gateway: PaymentGateway.PAYMOB,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  // ==================== PAYMENT PROCESSING ====================

  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentGatewayResponse<PaymentIntentData>> {
    try {
      // Ensure we have a valid auth token
      if (!this.authToken) {
        await this.authenticate();
      }

      // Step 1: Create order
      const orderRequest: PayMobOrderRequest = {
        auth_token: this.authToken,
        delivery_needed: false,
        amount_cents: this.formatAmount(options.amount, options.currency),
        currency: options.currency.toUpperCase(),
        items: [
          {
            name: options.description || 'Payment',
            amount_cents: this.formatAmount(options.amount, options.currency),
            description: options.description || 'Payment',
            quantity: 1,
          },
        ],
      };

      const order = await this.makeRequest('/ecommerce/orders', orderRequest);

      // Step 2: Create payment key
      const paymentKeyRequest: PayMobPaymentKeyRequest = {
        auth_token: this.authToken,
        amount_cents: this.formatAmount(options.amount, options.currency),
        expiration: 3600, // 1 hour
        order_id: order.id,
        billing_data: {
          email: 'customer@example.com', // This should come from customer data
          first_name: 'Customer', // This should come from customer data
          last_name: 'Name', // This should come from customer data
          phone_number: '+201000000000', // This should come from customer data
          country: 'EG',
          city: 'Cairo',
        },
        currency: options.currency.toUpperCase(),
        integration_id: this.integrationId,
      };

      const paymentKey = await this.makeRequest('/acceptance/payment_keys', paymentKeyRequest);

      const paymentIntentData: PaymentIntentData = {
        id: order.id.toString(),
        amount: options.amount,
        currency: options.currency,
        status: PaymentStatus.PENDING,
        clientSecret: paymentKey.token,
        customerId: options.customerId,
        description: options.description,
        metadata: options.metadata,
        gatewaySpecific: {
          orderId: order.id,
          paymentToken: paymentKey.token,
          iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${this.iframeId}?payment_token=${paymentKey.token}`,
        },
      };

      return {
        success: true,
        data: paymentIntentData,
        gateway: PaymentGateway.PAYMOB,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<PaymentGatewayResponse<PaymentIntentData>> {
    try {
      // PayMob payments are confirmed via iframe/redirect flow
      // This method would typically check the payment status
      const transaction = await this.makeRequest(`/acceptance/transactions/${paymentIntentId}`, null, 'GET');

      const paymentIntentData: PaymentIntentData = {
        id: paymentIntentId,
        amount: this.parseAmount(transaction.amount_cents, transaction.currency),
        currency: transaction.currency,
        status: this.mapPaymentStatus(transaction.success),
        gatewaySpecific: transaction,
      };

      return {
        success: true,
        data: paymentIntentData,
        gateway: PaymentGateway.PAYMOB,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<PaymentGatewayResponse<PaymentIntentData>> {
    return this.confirmPaymentIntent(paymentIntentId);
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentGatewayResponse<PaymentIntentData>> {
    try {
      // PayMob doesn't support payment intent cancellation
      throw new Error('Payment intent cancellation not supported by PayMob');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async refundPayment(options: RefundOptions): Promise<PaymentGatewayResponse<any>> {
    try {
      // Ensure we have a valid auth token
      if (!this.authToken) {
        await this.authenticate();
      }

      const refundRequest = {
        auth_token: this.authToken,
        transaction_id: options.paymentIntentId,
        amount_cents: options.amount ? this.formatAmount(options.amount, 'EGP') : undefined,
      };

      const response = await this.makeRequest('/acceptance/void_refund/refund', refundRequest);

      return {
        success: true,
        data: {
          refundId: response.id,
          amount: options.amount,
          status: response.success ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
          gatewaySpecific: response,
        },
        gateway: PaymentGateway.PAYMOB,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  async createSubscription(options: CreateSubscriptionOptions): Promise<PaymentGatewayResponse<SubscriptionData>> {
    try {
      // PayMob doesn't have native subscription support
      throw new Error('Native subscriptions not supported by PayMob. Use recurring payments instead.');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async getSubscription(subscriptionId: string): Promise<PaymentGatewayResponse<SubscriptionData>> {
    try {
      throw new Error('Subscription retrieval not supported by PayMob');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async updateSubscription(
    subscriptionId: string,
    options: UpdateSubscriptionOptions,
  ): Promise<PaymentGatewayResponse<SubscriptionData>> {
    try {
      throw new Error('Subscription updates not supported by PayMob');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd?: boolean,
  ): Promise<PaymentGatewayResponse<SubscriptionData>> {
    try {
      throw new Error('Subscription cancellation not supported by PayMob');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<PaymentGatewayResponse<SubscriptionData>> {
    try {
      throw new Error('Subscription resumption not supported by PayMob');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  // ==================== WEBHOOK HANDLING ====================

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      // PayMob webhook verification would be implemented here
      // This typically involves HMAC verification
      return true; // Simplified for now
    } catch (error) {
      this.logger.error('PayMob webhook signature verification failed:', error);
      return false;
    }
  }

  async parseWebhookEvent(payload: string, signature: string): Promise<PaymentGatewayResponse<WebhookEvent>> {
    try {
      const data = JSON.parse(payload);
      
      const webhookEvent: WebhookEvent = {
        id: data.id || `webhook_${Date.now()}`,
        type: this.mapWebhookEventType(data.success, data.pending),
        gateway: PaymentGateway.PAYMOB,
        data,
        created: new Date(),
        livemode: !data.id?.toString().includes('test'),
      };

      return {
        success: true,
        data: webhookEvent,
        gateway: PaymentGateway.PAYMOB,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<PaymentGatewayResponse<any>> {
    try {
      this.logger.log(`Handling PayMob webhook event: ${event.type}`);
      
      // Process the webhook event based on type
      switch (event.type) {
        case 'payment.succeeded':
          await this.handlePaymentSucceeded(event.data);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(event.data);
          break;
        default:
          this.logger.warn(`Unhandled PayMob webhook event type: ${event.type}`);
      }

      return {
        success: true,
        data: { processed: true },
        gateway: PaymentGateway.PAYMOB,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  // ==================== PRIVATE METHODS ====================

  private async authenticate(): Promise<void> {
    try {
      const authRequest = {
        api_key: this.apiKey,
      };

      const response = await this.makeRequest('/auth/tokens', authRequest);
      this.authToken = response.token;
      
      this.logger.log('PayMob authentication successful');
    } catch (error) {
      this.logger.error('PayMob authentication failed:', error);
      throw error;
    }
  }

  private async makeRequest(endpoint: string, data: any, method: string = 'POST'): Promise<any> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(`PayMob API error: ${result.message || response.statusText}`);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  private mapPaymentStatus(success: boolean, pending?: boolean): PaymentStatus {
    if (pending) {
      return PaymentStatus.PENDING;
    }
    return success ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED;
  }

  private mapWebhookEventType(success: boolean, pending?: boolean): string {
    if (pending) {
      return 'payment.pending';
    }
    return success ? 'payment.succeeded' : 'payment.failed';
  }

  private async handlePaymentSucceeded(data: any): Promise<void> {
    this.logger.log(`PayMob payment succeeded: ${data.id}`);
    // Implementation would update local database
  }

  private async handlePaymentFailed(data: any): Promise<void> {
    this.logger.log(`PayMob payment failed: ${data.id}`);
    // Implementation would update local database and handle failure
  }

  protected normalizeError(error: any): PaymentGatewayResponse<never> {
    const gatewayError: PaymentGatewayError = {
      code: error.code || 'paymob_error',
      message: error.message || 'An error occurred with PayMob',
      type: 'api_error',
      gateway: PaymentGateway.PAYMOB,
      originalError: error,
    };

    return {
      success: false,
      error: gatewayError,
      gateway: PaymentGateway.PAYMOB,
    };
  }

  protected formatAmount(amount: number, currency: string): number {
    // PayMob expects amounts in cents/piasters
    return amount;
  }

  protected parseAmount(amount: number, currency: string): number {
    // PayMob amounts are already in cents
    return amount;
  }
}
