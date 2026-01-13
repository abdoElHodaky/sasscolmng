import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { IPaymentGateway } from '../interfaces/payment-gateway.interface';
import {
  PaymentGateway,
  PaymentGatewayResponse,
  CustomerData,
  PaymentIntentData,
  SubscriptionData,
  CreateCustomerOptions,
  CreatePaymentIntentOptions,
  CreateSubscriptionOptions,
  UpdateSubscriptionOptions,
  RefundOptions,
} from '../interfaces/payment-types.interface';

export interface GatewayRoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: {
    currency?: string[];
    country?: string[];
    amount?: { min?: number; max?: number };
    paymentMethod?: string[];
  };
  gateway: PaymentGateway;
  fallbackGateways?: PaymentGateway[];
  isEnabled: boolean;
}

export interface PaymentContext {
  tenantId: string;
  customerId?: string;
  currency: string;
  country?: string;
  amount?: number;
  paymentMethod?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PaymentOrchestratorService {
  private readonly logger = new Logger(PaymentOrchestratorService.name);
  private gateways = new Map<PaymentGateway, IPaymentGateway>();
  private routingRules: GatewayRoutingRule[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.loadRoutingRules();
  }

  /**
   * Register a payment gateway
   */
  registerGateway(gateway: IPaymentGateway): void {
    this.gateways.set(gateway.getGateway(), gateway);
    this.logger.log(`Registered payment gateway: ${gateway.getGateway()}`);
  }

  /**
   * Get the best gateway for a given context
   */
  async selectGateway(context: PaymentContext): Promise<IPaymentGateway> {
    this.logger.debug(`Selecting gateway for context: ${JSON.stringify(context)}`);

    // Find matching routing rules
    const matchingRules = this.routingRules
      .filter(rule => rule.isEnabled && this.ruleMatches(rule, context))
      .sort((a, b) => a.priority - b.priority);

    if (matchingRules.length === 0) {
      throw new BadRequestException('No suitable payment gateway found for the given context');
    }

    // Try primary gateway first
    for (const rule of matchingRules) {
      const gateway = this.gateways.get(rule.gateway);
      if (gateway && gateway.isEnabled() && await this.isGatewayHealthy(gateway)) {
        this.logger.debug(`Selected primary gateway: ${rule.gateway}`);
        return gateway;
      }

      // Try fallback gateways
      if (rule.fallbackGateways) {
        for (const fallbackGateway of rule.fallbackGateways) {
          const fallback = this.gateways.get(fallbackGateway);
          if (fallback && fallback.isEnabled() && await this.isGatewayHealthy(fallback)) {
            this.logger.warn(`Using fallback gateway: ${fallbackGateway} (primary: ${rule.gateway} failed)`);
            return fallback;
          }
        }
      }
    }

    throw new BadRequestException('All suitable payment gateways are currently unavailable');
  }

  /**
   * Create customer with automatic gateway selection
   */
  async createCustomer(
    context: PaymentContext,
    options: CreateCustomerOptions,
  ): Promise<PaymentGatewayResponse<CustomerData>> {
    const gateway = await this.selectGateway(context);
    
    try {
      const result = await gateway.createCustomer(options);
      
      // Store gateway mapping for future reference
      if (result.success && result.data) {
        await this.storeCustomerGatewayMapping(
          context.tenantId,
          options.email,
          gateway.getGateway(),
          result.data.id,
        );
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to create customer with ${gateway.getGateway()}:`, error);
      throw error;
    }
  }

  /**
   * Create payment intent with automatic gateway selection and fallback
   */
  async createPaymentIntent(
    context: PaymentContext,
    options: CreatePaymentIntentOptions,
  ): Promise<PaymentGatewayResponse<PaymentIntentData>> {
    const gateway = await this.selectGateway({
      ...context,
      amount: options.amount,
    });

    try {
      const result = await gateway.createPaymentIntent(options);
      
      // Log payment attempt
      await this.logPaymentAttempt(
        context.tenantId,
        gateway.getGateway(),
        'payment_intent_created',
        result.success,
        result.error?.message,
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to create payment intent with ${gateway.getGateway()}:`, error);
      
      // Log failed attempt
      await this.logPaymentAttempt(
        context.tenantId,
        gateway.getGateway(),
        'payment_intent_failed',
        false,
        error.message,
      );
      
      throw error;
    }
  }

  /**
   * Create subscription with automatic gateway selection
   */
  async createSubscription(
    context: PaymentContext,
    options: CreateSubscriptionOptions,
  ): Promise<PaymentGatewayResponse<SubscriptionData>> {
    const gateway = await this.selectGateway(context);

    try {
      const result = await gateway.createSubscription(options);
      
      // Store subscription gateway mapping
      if (result.success && result.data) {
        await this.storeSubscriptionGatewayMapping(
          context.tenantId,
          result.data.id,
          gateway.getGateway(),
        );
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to create subscription with ${gateway.getGateway()}:`, error);
      throw error;
    }
  }

  /**
   * Process refund using the original payment gateway
   */
  async refundPayment(
    tenantId: string,
    options: RefundOptions,
  ): Promise<PaymentGatewayResponse<any>> {
    // Find the original payment gateway
    const paymentGateway = await this.getPaymentGateway(tenantId, options.paymentIntentId);
    
    if (!paymentGateway) {
      throw new BadRequestException('Original payment gateway not found');
    }

    const gateway = this.gateways.get(paymentGateway);
    if (!gateway) {
      throw new BadRequestException(`Gateway ${paymentGateway} is not available`);
    }

    try {
      return await gateway.refundPayment(options);
    } catch (error) {
      this.logger.error(`Failed to process refund with ${paymentGateway}:`, error);
      throw error;
    }
  }

  /**
   * Get all available gateways with their status
   */
  async getGatewayStatus(): Promise<Array<{
    gateway: PaymentGateway;
    isEnabled: boolean;
    isHealthy: boolean;
    supportedCurrencies: string[];
    supportedCountries: string[];
  }>> {
    const statuses = [];
    
    for (const [gatewayType, gateway] of this.gateways) {
      const isHealthy = await this.isGatewayHealthy(gateway);
      
      statuses.push({
        gateway: gatewayType,
        isEnabled: gateway.isEnabled(),
        isHealthy,
        supportedCurrencies: gateway.getSupportedCurrencies(),
        supportedCountries: gateway.getSupportedCountries(),
      });
    }
    
    return statuses;
  }

  /**
   * Update routing rules
   */
  updateRoutingRules(rules: GatewayRoutingRule[]): void {
    this.routingRules = rules.sort((a, b) => a.priority - b.priority);
    this.logger.log(`Updated routing rules: ${rules.length} rules loaded`);
  }

  // ==================== PRIVATE METHODS ====================

  private ruleMatches(rule: GatewayRoutingRule, context: PaymentContext): boolean {
    const { conditions } = rule;

    // Check currency
    if (conditions.currency && !conditions.currency.includes(context.currency)) {
      return false;
    }

    // Check country
    if (conditions.country && context.country && !conditions.country.includes(context.country)) {
      return false;
    }

    // Check amount range
    if (conditions.amount && context.amount) {
      if (conditions.amount.min && context.amount < conditions.amount.min) {
        return false;
      }
      if (conditions.amount.max && context.amount > conditions.amount.max) {
        return false;
      }
    }

    // Check payment method
    if (conditions.paymentMethod && context.paymentMethod && 
        !conditions.paymentMethod.includes(context.paymentMethod)) {
      return false;
    }

    return true;
  }

  private async isGatewayHealthy(gateway: IPaymentGateway): Promise<boolean> {
    try {
      return await gateway.healthCheck();
    } catch (error) {
      this.logger.warn(`Health check failed for ${gateway.getGateway()}:`, error.message);
      return false;
    }
  }

  private async storeCustomerGatewayMapping(
    tenantId: string,
    email: string,
    gateway: PaymentGateway,
    gatewayCustomerId: string,
  ): Promise<void> {
    try {
      // This would typically be stored in a dedicated table
      // For now, we'll use metadata in the user record
      await this.prisma.user.updateMany({
        where: {
          email,
          tenantId,
        },
        data: {
          metadata: {
            paymentGateway: gateway,
            gatewayCustomerId,
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to store customer gateway mapping:', error);
    }
  }

  private async storeSubscriptionGatewayMapping(
    tenantId: string,
    subscriptionId: string,
    gateway: PaymentGateway,
  ): Promise<void> {
    try {
      // Store in subscription metadata
      await this.prisma.subscription.updateMany({
        where: {
          stripeSubscriptionId: subscriptionId,
          tenantId,
        },
        data: {
          metadata: {
            paymentGateway: gateway,
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to store subscription gateway mapping:', error);
    }
  }

  private async getPaymentGateway(tenantId: string, paymentIntentId: string): Promise<PaymentGateway | null> {
    try {
      // Look up the payment record to find the original gateway
      const payment = await this.prisma.payment.findFirst({
        where: {
          stripePaymentId: paymentIntentId,
          subscription: {
            tenantId,
          },
        },
        include: {
          subscription: true,
        },
      });

      if (payment?.subscription?.metadata && 
          typeof payment.subscription.metadata === 'object' &&
          'paymentGateway' in payment.subscription.metadata) {
        return payment.subscription.metadata.paymentGateway as PaymentGateway;
      }

      // Default to Stripe for existing payments
      return PaymentGateway.STRIPE;
    } catch (error) {
      this.logger.error('Failed to get payment gateway:', error);
      return null;
    }
  }

  private async logPaymentAttempt(
    tenantId: string,
    gateway: PaymentGateway,
    event: string,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    try {
      // This would typically be stored in a dedicated audit log table
      this.logger.log(`Payment attempt: ${tenantId} | ${gateway} | ${event} | ${success ? 'SUCCESS' : 'FAILED'} ${errorMessage ? `| ${errorMessage}` : ''}`);
    } catch (error) {
      this.logger.error('Failed to log payment attempt:', error);
    }
  }

  private loadRoutingRules(): void {
    // Default routing rules - these would typically be loaded from database or config
    this.routingRules = [
      {
        id: 'stripe-global',
        name: 'Stripe Global',
        priority: 1,
        conditions: {
          currency: ['USD', 'EUR', 'GBP'],
        },
        gateway: PaymentGateway.STRIPE,
        fallbackGateways: [PaymentGateway.PAYTABS],
        isEnabled: true,
      },
      {
        id: 'paytabs-mena',
        name: 'PayTabs MENA',
        priority: 1,
        conditions: {
          currency: ['SAR', 'AED', 'KWD', 'QAR', 'BHD'],
          country: ['SA', 'AE', 'KW', 'QA', 'BH'],
        },
        gateway: PaymentGateway.PAYTABS,
        fallbackGateways: [PaymentGateway.STRIPE],
        isEnabled: true,
      },
      {
        id: 'paymob-egypt',
        name: 'PayMob Egypt',
        priority: 1,
        conditions: {
          currency: ['EGP'],
          country: ['EG'],
        },
        gateway: PaymentGateway.PAYMOB,
        fallbackGateways: [PaymentGateway.STRIPE],
        isEnabled: true,
      },
    ];

    this.logger.log(`Loaded ${this.routingRules.length} default routing rules`);
  }
}
