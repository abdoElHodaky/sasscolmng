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

export interface LoadBalancingConfig {
  enabled: boolean;
  weight: number;
  alternatives?: Array<{
    gateway: PaymentGateway;
    weight: number;
  }>;
}

export interface TimeRestrictions {
  timezone: string;
  allowedHours: {
    start: number; // 0-23
    end: number;   // 0-23
  };
  allowedDays?: number[]; // 0-6 (Sunday-Saturday)
}

export interface GatewayRoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: {
    currency?: string[];
    country?: string[];
    amount?: { min?: number; max?: number };
    paymentMethod?: string[];
    tenantTier?: string[]; // For tier-based routing
    customerSegment?: string[]; // VIP, regular, etc.
  };
  gateway: PaymentGateway;
  fallbackGateways?: PaymentGateway[];
  loadBalancing?: LoadBalancingConfig;
  timeRestrictions?: TimeRestrictions;
  requiresApproval?: boolean;
  isEnabled: boolean;
  metadata?: Record<string, any>;
}

export interface PaymentAttemptLog {
  id: string;
  tenantId: string;
  gateway: PaymentGateway;
  event: string;
  success: boolean;
  errorMessage?: string;
  amount?: number;
  currency?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface GatewayPerformanceMetrics {
  gateway: PaymentGateway;
  successRate: number;
  averageResponseTime: number;
  totalTransactions: number;
  failureReasons: Record<string, number>;
  lastUpdated: Date;
}

export interface PaymentContext {
  tenantId: string;
  customerId?: string;
  currency: string;
  country?: string;
  amount?: number;
  paymentMethod?: string;
  tenantTier?: string; // Starter, Professional, Enterprise
  customerSegment?: string; // VIP, regular, new
  timezone?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PaymentOrchestratorService {
  private readonly logger = new Logger(PaymentOrchestratorService.name);
  private gateways = new Map<PaymentGateway, IPaymentGateway>();
  private routingRules: GatewayRoutingRule[] = [];
  private performanceMetrics = new Map<PaymentGateway, GatewayPerformanceMetrics>();
  private paymentAttempts: PaymentAttemptLog[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.loadRoutingRules();
    this.initializePerformanceTracking();
  }

  /**
   * Register a payment gateway
   */
  registerGateway(gateway: IPaymentGateway): void {
    this.gateways.set(gateway.getGateway(), gateway);
    this.logger.log(`Registered payment gateway: ${gateway.getGateway()}`);
  }

  /**
   * Get the best gateway for a given context with enhanced routing
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

    // Try each matching rule
    for (const rule of matchingRules) {
      // Check time restrictions
      if (rule.timeRestrictions && !this.isWithinTimeRestrictions(rule.timeRestrictions)) {
        this.logger.debug(`Rule ${rule.id} skipped due to time restrictions`);
        continue;
      }

      // Check if approval is required for high-value transactions
      if (rule.requiresApproval && context.amount && context.amount > 1000000) {
        this.logger.warn(`High-value transaction requires approval: ${context.amount}`);
        // In a real implementation, this would trigger an approval workflow
        continue;
      }

      // Apply load balancing if enabled
      const selectedGateway = this.applyLoadBalancing(rule);
      const gateway = this.gateways.get(selectedGateway);
      
      if (gateway && gateway.isEnabled() && await this.isGatewayHealthy(gateway)) {
        this.logger.debug(`Selected gateway: ${selectedGateway} (rule: ${rule.id})`);
        await this.updatePerformanceMetrics(selectedGateway, true);
        return gateway;
      }

      // Try fallback gateways
      if (rule.fallbackGateways) {
        for (const fallbackGateway of rule.fallbackGateways) {
          const fallback = this.gateways.get(fallbackGateway);
          if (fallback && fallback.isEnabled() && await this.isGatewayHealthy(fallback)) {
            this.logger.warn(`Using fallback gateway: ${fallbackGateway} (primary: ${selectedGateway} failed)`);
            await this.updatePerformanceMetrics(fallbackGateway, true);
            await this.updatePerformanceMetrics(selectedGateway, false);
            return fallback;
          }
        }
      }

      await this.updatePerformanceMetrics(selectedGateway, false);
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

    // Check tenant tier
    if (conditions.tenantTier && context.tenantTier && 
        !conditions.tenantTier.includes(context.tenantTier)) {
      return false;
    }

    // Check customer segment
    if (conditions.customerSegment && context.customerSegment && 
        !conditions.customerSegment.includes(context.customerSegment)) {
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

  // ==================== ENHANCED ORCHESTRATION METHODS ====================

  /**
   * Apply load balancing to select gateway based on weights
   */
  private applyLoadBalancing(rule: GatewayRoutingRule): PaymentGateway {
    if (!rule.loadBalancing?.enabled || !rule.loadBalancing.alternatives) {
      return rule.gateway;
    }

    const random = Math.random() * 100;
    let currentWeight = 0;

    // Check primary gateway weight
    currentWeight += rule.loadBalancing.weight;
    if (random <= currentWeight) {
      return rule.gateway;
    }

    // Check alternative gateways
    for (const alternative of rule.loadBalancing.alternatives) {
      currentWeight += alternative.weight;
      if (random <= currentWeight) {
        return alternative.gateway;
      }
    }

    // Fallback to primary gateway
    return rule.gateway;
  }

  /**
   * Check if current time is within allowed time restrictions
   */
  private isWithinTimeRestrictions(restrictions: TimeRestrictions): boolean {
    const now = new Date();
    const timezone = restrictions.timezone || 'UTC';
    
    // Convert to specified timezone
    const timeInZone = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const currentHour = timeInZone.getHours();
    const currentDay = timeInZone.getDay();

    // Check allowed hours
    const { start, end } = restrictions.allowedHours;
    const isWithinHours = start <= end 
      ? currentHour >= start && currentHour <= end
      : currentHour >= start || currentHour <= end; // Handle overnight ranges

    // Check allowed days (if specified)
    const isWithinDays = !restrictions.allowedDays || 
      restrictions.allowedDays.includes(currentDay);

    return isWithinHours && isWithinDays;
  }

  /**
   * Initialize performance tracking for all gateways
   */
  private initializePerformanceTracking(): void {
    const gateways = [PaymentGateway.STRIPE, PaymentGateway.PAYTABS, PaymentGateway.PAYMOB];
    
    gateways.forEach(gateway => {
      this.performanceMetrics.set(gateway, {
        gateway,
        successRate: 100,
        averageResponseTime: 0,
        totalTransactions: 0,
        failureReasons: {},
        lastUpdated: new Date(),
      });
    });
  }

  /**
   * Update performance metrics for a gateway
   */
  private async updatePerformanceMetrics(gateway: PaymentGateway, success: boolean, responseTime?: number): Promise<void> {
    const metrics = this.performanceMetrics.get(gateway);
    if (!metrics) return;

    metrics.totalTransactions++;
    
    if (success) {
      metrics.successRate = ((metrics.successRate * (metrics.totalTransactions - 1)) + 100) / metrics.totalTransactions;
    } else {
      metrics.successRate = ((metrics.successRate * (metrics.totalTransactions - 1)) + 0) / metrics.totalTransactions;
    }

    if (responseTime) {
      metrics.averageResponseTime = ((metrics.averageResponseTime * (metrics.totalTransactions - 1)) + responseTime) / metrics.totalTransactions;
    }

    metrics.lastUpdated = new Date();
    this.performanceMetrics.set(gateway, metrics);
  }

  /**
   * Get performance metrics for all gateways
   */
  async getPerformanceMetrics(): Promise<GatewayPerformanceMetrics[]> {
    return Array.from(this.performanceMetrics.values());
  }

  /**
   * Get payment attempt logs
   */
  async getPaymentAttemptLogs(tenantId?: string, limit: number = 100): Promise<PaymentAttemptLog[]> {
    let logs = this.paymentAttempts;
    
    if (tenantId) {
      logs = logs.filter(log => log.tenantId === tenantId);
    }
    
    return logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Enhanced routing rule management
   */
  async createRoutingRule(rule: Omit<GatewayRoutingRule, 'id'>): Promise<GatewayRoutingRule> {
    const newRule: GatewayRoutingRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.routingRules.push(newRule);
    this.routingRules.sort((a, b) => a.priority - b.priority);
    
    this.logger.log(`Created new routing rule: ${newRule.id}`);
    return newRule;
  }

  /**
   * Update existing routing rule
   */
  async updateRoutingRule(ruleId: string, updates: Partial<GatewayRoutingRule>): Promise<GatewayRoutingRule | null> {
    const ruleIndex = this.routingRules.findIndex(rule => rule.id === ruleId);
    
    if (ruleIndex === -1) {
      return null;
    }

    this.routingRules[ruleIndex] = { ...this.routingRules[ruleIndex], ...updates };
    this.routingRules.sort((a, b) => a.priority - b.priority);
    
    this.logger.log(`Updated routing rule: ${ruleId}`);
    return this.routingRules[ruleIndex];
  }

  /**
   * Delete routing rule
   */
  async deleteRoutingRule(ruleId: string): Promise<boolean> {
    const ruleIndex = this.routingRules.findIndex(rule => rule.id === ruleId);
    
    if (ruleIndex === -1) {
      return false;
    }

    this.routingRules.splice(ruleIndex, 1);
    this.logger.log(`Deleted routing rule: ${ruleId}`);
    return true;
  }

  /**
   * Get all routing rules
   */
  async getRoutingRules(): Promise<GatewayRoutingRule[]> {
    return [...this.routingRules];
  }

  /**
   * Test gateway selection for a given context without executing
   */
  async testGatewaySelection(context: PaymentContext): Promise<{
    selectedGateway: PaymentGateway;
    matchedRule: GatewayRoutingRule;
    alternativeGateways: PaymentGateway[];
    reasoning: string[];
  }> {
    const reasoning: string[] = [];
    
    // Find matching routing rules
    const matchingRules = this.routingRules
      .filter(rule => {
        const matches = rule.isEnabled && this.ruleMatches(rule, context);
        if (matches) {
          reasoning.push(`Rule "${rule.name}" matches context`);
        }
        return matches;
      })
      .sort((a, b) => a.priority - b.priority);

    if (matchingRules.length === 0) {
      throw new BadRequestException('No suitable payment gateway found for the given context');
    }

    const selectedRule = matchingRules[0];
    reasoning.push(`Selected rule: "${selectedRule.name}" (priority: ${selectedRule.priority})`);

    // Apply load balancing
    const selectedGateway = this.applyLoadBalancing(selectedRule);
    reasoning.push(`Load balancing selected: ${selectedGateway}`);

    // Get alternative gateways
    const alternativeGateways = selectedRule.fallbackGateways || [];

    return {
      selectedGateway,
      matchedRule: selectedRule,
      alternativeGateways,
      reasoning,
    };
  }

  /**
   * Enhanced payment attempt logging
   */
  private async logPaymentAttempt(
    tenantId: string,
    gateway: PaymentGateway,
    event: string,
    success: boolean,
    errorMessage?: string,
    amount?: number,
    currency?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const logEntry: PaymentAttemptLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        gateway,
        event,
        success,
        errorMessage,
        amount,
        currency,
        timestamp: new Date(),
        metadata,
      };

      this.paymentAttempts.push(logEntry);
      
      // Keep only last 1000 logs in memory
      if (this.paymentAttempts.length > 1000) {
        this.paymentAttempts = this.paymentAttempts.slice(-1000);
      }

      this.logger.log(`Payment attempt: ${tenantId} | ${gateway} | ${event} | ${success ? 'SUCCESS' : 'FAILED'} ${errorMessage ? `| ${errorMessage}` : ''}`);
    } catch (error) {
      this.logger.error('Failed to log payment attempt:', error);
    }
  }
}
