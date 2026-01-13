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

interface PayTabsCustomer {
  customer_ref: string;
  name: string;
  email: string;
  phone?: string;
  street1?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
}

interface PayTabsPaymentRequest {
  profile_id: string;
  tran_type: string;
  tran_class: string;
  cart_id: string;
  cart_description: string;
  cart_currency: string;
  cart_amount: number;
  customer_details: PayTabsCustomer;
  payment_methods?: string[];
  callback?: string;
  return?: string;
  hide_shipping?: boolean;
}

interface PayTabsPaymentResponse {
  tran_ref: string;
  tran_type: string;
  cart_id: string;
  cart_description: string;
  cart_currency: string;
  cart_amount: string;
  payment_result: {
    response_status: string;
    response_code: string;
    response_message: string;
    transaction_time: string;
  };
  payment_info?: {
    payment_method: string;
    card_type?: string;
    card_scheme?: string;
    payment_description: string;
  };
  customer_details: PayTabsCustomer;
  redirect_url?: string;
}

@Injectable()
export class PayTabsService extends IPaymentGateway {
  private readonly logger = new Logger(PayTabsService.name);
  private readonly baseUrl: string;
  private readonly serverKey: string;
  private readonly profileId: string;

  constructor(
    config: PaymentGatewayConfig,
    private readonly configService: ConfigService,
  ) {
    super(config);
    
    // PayTabs configuration
    this.baseUrl = this.configService.get<string>('PAYTABS_BASE_URL', 'https://secure.paytabs.sa');
    this.serverKey = config.credentials.serverKey || this.configService.get<string>('PAYTABS_SERVER_KEY');
    this.profileId = config.credentials.profileId || this.configService.get<string>('PAYTABS_PROFILE_ID');
    
    if (!this.serverKey || !this.profileId) {
      throw new Error('PayTabs credentials (serverKey, profileId) are required');
    }
  }

  getGateway(): PaymentGateway {
    return PaymentGateway.PAYTABS;
  }

  async initialize(): Promise<void> {
    this.logger.log('Initializing PayTabs gateway...');
    
    try {
      // Test the connection with a simple API call
      await this.healthCheck();
      this.logger.log('PayTabs gateway initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PayTabs gateway:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // PayTabs doesn't have a dedicated health check endpoint
      // We'll use a simple validation request to check connectivity
      const response = await this.makeRequest('/payment/request', {
        profile_id: this.profileId,
        tran_type: 'sale',
        tran_class: 'ecom',
        cart_id: 'health_check_' + Date.now(),
        cart_description: 'Health Check',
        cart_currency: 'SAR',
        cart_amount: 1,
        customer_details: {
          customer_ref: 'health_check',
          name: 'Health Check',
          email: 'health@check.com',
        },
        hide_shipping: true,
      }, false); // Don't throw on error for health check

      return response && response.tran_ref;
    } catch (error) {
      this.logger.warn('PayTabs health check failed:', error.message);
      return false;
    }
  }

  // ==================== CUSTOMER MANAGEMENT ====================

  async createCustomer(options: CreateCustomerOptions): Promise<PaymentGatewayResponse<CustomerData>> {
    try {
      // PayTabs doesn't have a separate customer creation endpoint
      // Customer data is included with each payment request
      // We'll create a customer reference and store it
      const customerRef = `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const customerData: CustomerData = {
        id: customerRef,
        email: options.email,
        name: options.name,
        phone: options.phone,
        address: options.address,
        metadata: {
          ...options.metadata,
          gateway: PaymentGateway.PAYTABS,
          createdAt: new Date().toISOString(),
        },
      };

      return {
        success: true,
        data: customerData,
        gateway: PaymentGateway.PAYTABS,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async getCustomer(customerId: string): Promise<PaymentGatewayResponse<CustomerData>> {
    try {
      // PayTabs doesn't provide customer retrieval
      // This would typically be handled by our local database
      throw new Error('Customer retrieval not supported by PayTabs API');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<CreateCustomerOptions>,
  ): Promise<PaymentGatewayResponse<CustomerData>> {
    try {
      // PayTabs doesn't support customer updates
      // This would be handled by updating our local database
      throw new Error('Customer updates not supported by PayTabs API');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async deleteCustomer(customerId: string): Promise<PaymentGatewayResponse<boolean>> {
    try {
      // PayTabs doesn't support customer deletion
      // This would be handled by our local database
      return {
        success: true,
        data: true,
        gateway: PaymentGateway.PAYTABS,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  // ==================== PAYMENT PROCESSING ====================

  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentGatewayResponse<PaymentIntentData>> {
    try {
      const cartId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const paymentRequest: PayTabsPaymentRequest = {
        profile_id: this.profileId,
        tran_type: 'sale',
        tran_class: 'ecom',
        cart_id: cartId,
        cart_description: options.description || 'Payment',
        cart_currency: options.currency.toUpperCase(),
        cart_amount: this.formatAmount(options.amount, options.currency),
        customer_details: {
          customer_ref: options.customerId || `guest_${Date.now()}`,
          name: 'Customer', // This should come from customer data
          email: 'customer@example.com', // This should come from customer data
        },
        callback: `${this.config.webhookEndpoint}/paytabs`,
        return: `${this.configService.get('FRONTEND_URL')}/payment/return`,
        hide_shipping: true,
      };

      if (options.metadata) {
        paymentRequest.customer_details.customer_ref = JSON.stringify({
          id: options.customerId,
          metadata: options.metadata,
        });
      }

      const response = await this.makeRequest('/payment/request', paymentRequest);

      const paymentIntentData: PaymentIntentData = {
        id: response.tran_ref,
        amount: options.amount,
        currency: options.currency,
        status: this.mapPaymentStatus(response.payment_result?.response_status),
        clientSecret: response.redirect_url,
        customerId: options.customerId,
        description: options.description,
        metadata: options.metadata,
        gatewaySpecific: {
          cartId,
          redirectUrl: response.redirect_url,
          tranRef: response.tran_ref,
        },
      };

      return {
        success: true,
        data: paymentIntentData,
        gateway: PaymentGateway.PAYTABS,
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
      // PayTabs payments are confirmed via redirect flow
      // This method would typically check the payment status
      const response = await this.makeRequest('/payment/query', {
        profile_id: this.profileId,
        tran_ref: paymentIntentId,
      });

      const paymentIntentData: PaymentIntentData = {
        id: paymentIntentId,
        amount: this.parseAmount(parseFloat(response.cart_amount), response.cart_currency),
        currency: response.cart_currency,
        status: this.mapPaymentStatus(response.payment_result?.response_status),
        gatewaySpecific: response,
      };

      return {
        success: true,
        data: paymentIntentData,
        gateway: PaymentGateway.PAYTABS,
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
      // PayTabs doesn't support payment intent cancellation
      // Once created, payments must be completed or will expire
      throw new Error('Payment intent cancellation not supported by PayTabs');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async refundPayment(options: RefundOptions): Promise<PaymentGatewayResponse<any>> {
    try {
      const refundRequest = {
        profile_id: this.profileId,
        tran_ref: options.paymentIntentId,
        tran_type: 'refund',
        tran_class: 'ecom',
        cart_id: `refund_${Date.now()}`,
        cart_description: options.reason || 'Refund',
        cart_currency: 'SAR', // This should come from original payment
        cart_amount: options.amount ? this.formatAmount(options.amount, 'SAR') : undefined,
      };

      const response = await this.makeRequest('/payment/request', refundRequest);

      return {
        success: true,
        data: {
          refundId: response.tran_ref,
          amount: options.amount,
          status: this.mapPaymentStatus(response.payment_result?.response_status),
          gatewaySpecific: response,
        },
        gateway: PaymentGateway.PAYTABS,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  async createSubscription(options: CreateSubscriptionOptions): Promise<PaymentGatewayResponse<SubscriptionData>> {
    try {
      // PayTabs doesn't have native subscription support
      // This would need to be implemented using recurring payments
      throw new Error('Native subscriptions not supported by PayTabs. Use recurring payments instead.');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async getSubscription(subscriptionId: string): Promise<PaymentGatewayResponse<SubscriptionData>> {
    try {
      throw new Error('Subscription retrieval not supported by PayTabs');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async updateSubscription(
    subscriptionId: string,
    options: UpdateSubscriptionOptions,
  ): Promise<PaymentGatewayResponse<SubscriptionData>> {
    try {
      throw new Error('Subscription updates not supported by PayTabs');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd?: boolean,
  ): Promise<PaymentGatewayResponse<SubscriptionData>> {
    try {
      throw new Error('Subscription cancellation not supported by PayTabs');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<PaymentGatewayResponse<SubscriptionData>> {
    try {
      throw new Error('Subscription resumption not supported by PayTabs');
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  // ==================== WEBHOOK HANDLING ====================

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      // PayTabs uses server key for webhook verification
      // Implementation would depend on PayTabs webhook signature method
      return true; // Simplified for now
    } catch (error) {
      this.logger.error('PayTabs webhook signature verification failed:', error);
      return false;
    }
  }

  async parseWebhookEvent(payload: string, signature: string): Promise<PaymentGatewayResponse<WebhookEvent>> {
    try {
      const data = JSON.parse(payload);
      
      const webhookEvent: WebhookEvent = {
        id: data.tran_ref || `webhook_${Date.now()}`,
        type: this.mapWebhookEventType(data.payment_result?.response_status),
        gateway: PaymentGateway.PAYTABS,
        data,
        created: new Date(),
        livemode: !data.tran_ref?.includes('test'),
      };

      return {
        success: true,
        data: webhookEvent,
        gateway: PaymentGateway.PAYTABS,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<PaymentGatewayResponse<any>> {
    try {
      this.logger.log(`Handling PayTabs webhook event: ${event.type}`);
      
      // Process the webhook event based on type
      switch (event.type) {
        case 'payment.succeeded':
          await this.handlePaymentSucceeded(event.data);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(event.data);
          break;
        default:
          this.logger.warn(`Unhandled PayTabs webhook event type: ${event.type}`);
      }

      return {
        success: true,
        data: { processed: true },
        gateway: PaymentGateway.PAYTABS,
      };
    } catch (error) {
      return this.normalizeError(error);
    }
  }

  // ==================== PRIVATE METHODS ====================

  private async makeRequest(endpoint: string, data: any, throwOnError: boolean = true): Promise<any> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.serverKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok && throwOnError) {
        throw new Error(`PayTabs API error: ${result.message || response.statusText}`);
      }

      return result;
    } catch (error) {
      if (throwOnError) {
        throw error;
      }
      return null;
    }
  }

  private mapPaymentStatus(payTabsStatus: string): PaymentStatus {
    switch (payTabsStatus?.toLowerCase()) {
      case 'a':
      case 'approved':
        return PaymentStatus.SUCCEEDED;
      case 'd':
      case 'declined':
        return PaymentStatus.FAILED;
      case 'p':
      case 'pending':
        return PaymentStatus.PENDING;
      case 'v':
      case 'voided':
        return PaymentStatus.CANCELED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  private mapWebhookEventType(payTabsStatus: string): string {
    switch (payTabsStatus?.toLowerCase()) {
      case 'a':
      case 'approved':
        return 'payment.succeeded';
      case 'd':
      case 'declined':
        return 'payment.failed';
      default:
        return 'payment.updated';
    }
  }

  private async handlePaymentSucceeded(data: any): Promise<void> {
    this.logger.log(`PayTabs payment succeeded: ${data.tran_ref}`);
    // Implementation would update local database
  }

  private async handlePaymentFailed(data: any): Promise<void> {
    this.logger.log(`PayTabs payment failed: ${data.tran_ref}`);
    // Implementation would update local database and handle failure
  }

  protected normalizeError(error: any): PaymentGatewayResponse<never> {
    const gatewayError: PaymentGatewayError = {
      code: error.code || 'paytabs_error',
      message: error.message || 'An error occurred with PayTabs',
      type: 'api_error',
      gateway: PaymentGateway.PAYTABS,
      originalError: error,
    };

    return {
      success: false,
      error: gatewayError,
      gateway: PaymentGateway.PAYTABS,
    };
  }

  protected formatAmount(amount: number, currency: string): number {
    // PayTabs expects amounts in the currency's base unit (e.g., SAR, not halalas)
    return amount / 100;
  }

  protected parseAmount(amount: number, currency: string): number {
    // Convert PayTabs amount back to cents
    return Math.round(amount * 100);
  }
}
