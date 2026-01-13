import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { IPaymentGateway } from '../interfaces/payment-gateway.interface';
import { CurrencyConversionService, CurrencyConversionResult } from './currency-conversion.service';
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
    private readonly currencyService: CurrencyConversionService,
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
    // Enhanced routing rules with load balancing and advanced conditions
    this.routingRules = [
      // High-value transaction rule (highest priority)
      {
        id: 'high-value-transactions',
        name: 'High Value Transactions',
        priority: 0,
        conditions: {
          currency: ['USD', 'EUR', 'GBP'],
          amount: { min: 1000000 }, // $10,000+
        },
        gateway: PaymentGateway.STRIPE,
        fallbackGateways: [],
        requiresApproval: true,
        loadBalancing: {
          enabled: false,
          weight: 100,
        },
        isEnabled: true,
        metadata: {
          description: 'High-value transactions requiring manual approval',
          riskLevel: 'high',
        },
      },
      // Stripe global with load balancing
      {
        id: 'stripe-global',
        name: 'Stripe Global',
        priority: 1,
        conditions: {
          currency: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
          amount: { min: 100, max: 1000000 }, // $1.00 to $10,000
        },
        gateway: PaymentGateway.STRIPE,
        fallbackGateways: [PaymentGateway.PAYTABS],
        loadBalancing: {
          enabled: true,
          weight: 80, // 80% of traffic
          alternatives: [
            { gateway: PaymentGateway.PAYTABS, weight: 20 }
          ]
        },
        timeRestrictions: {
          timezone: 'UTC',
          allowedHours: { start: 0, end: 24 }, // 24/7
        },
        isEnabled: true,
        metadata: {
          description: 'Primary global payment processing',
          supportedMethods: ['card', 'apple_pay', 'google_pay'],
        },
      },
      // PayTabs MENA with time restrictions
      {
        id: 'paytabs-mena',
        name: 'PayTabs MENA',
        priority: 1,
        conditions: {
          currency: ['SAR', 'AED', 'KWD', 'QAR', 'BHD'],
          country: ['SA', 'AE', 'KW', 'QA', 'BH'],
          paymentMethod: ['card', 'mada', 'stcpay'],
        },
        gateway: PaymentGateway.PAYTABS,
        fallbackGateways: [PaymentGateway.STRIPE],
        loadBalancing: {
          enabled: false,
          weight: 100,
        },
        timeRestrictions: {
          timezone: 'Asia/Riyadh',
          allowedHours: { start: 6, end: 23 }, // 6 AM to 11 PM local time
        },
        isEnabled: true,
        metadata: {
          description: 'Middle East payment processing',
          localMethods: ['mada', 'stcpay'],
        },
      },
      // PayMob Egypt with load balancing
      {
        id: 'paymob-egypt',
        name: 'PayMob Egypt',
        priority: 1,
        conditions: {
          currency: ['EGP'],
          country: ['EG'],
          paymentMethod: ['card', 'wallet', 'bank_installments'],
          amount: { max: 500000 }, // 5000 EGP maximum
        },
        gateway: PaymentGateway.PAYMOB,
        fallbackGateways: [PaymentGateway.STRIPE],
        loadBalancing: {
          enabled: true,
          weight: 90,
          alternatives: [
            { gateway: PaymentGateway.STRIPE, weight: 10 }
          ]
        },
        timeRestrictions: {
          timezone: 'Africa/Cairo',
          allowedHours: { start: 8, end: 22 }, // 8 AM to 10 PM local time
        },
        isEnabled: true,
        metadata: {
          description: 'Egypt payment processing with local methods',
          localMethods: ['wallet', 'bank_installments'],
        },
      },
      // Enterprise tier routing
      {
        id: 'enterprise-tier',
        name: 'Enterprise Tier Routing',
        priority: 2,
        conditions: {
          tenantTier: ['Enterprise'],
          currency: ['USD', 'EUR'],
        },
        gateway: PaymentGateway.STRIPE,
        fallbackGateways: [PaymentGateway.PAYTABS],
        loadBalancing: {
          enabled: false,
          weight: 100,
        },
        isEnabled: true,
        metadata: {
          description: 'Dedicated routing for enterprise customers',
          features: ['priority_processing', 'dedicated_support'],
        },
      },
      // VIP customer routing
      {
        id: 'vip-customers',
        name: 'VIP Customer Routing',
        priority: 2,
        conditions: {
          customerSegment: ['VIP'],
        },
        gateway: PaymentGateway.STRIPE,
        fallbackGateways: [],
        loadBalancing: {
          enabled: false,
          weight: 100,
        },
        isEnabled: true,
        metadata: {
          description: 'Premium routing for VIP customers',
          features: ['priority_processing', 'no_fallback'],
        },
      },
    ];

    this.logger.log(`Loaded ${this.routingRules.length} enhanced routing rules`);
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

  // ==================== MULTI-CURRENCY SUPPORT METHODS ====================

  /**
   * Create payment intent with currency conversion support
   */
  async createPaymentIntentWithConversion(
    options: CreatePaymentIntentOptions & {
      targetCurrency?: string;
      tenantRegion?: string;
    }
  ): Promise<PaymentGatewayResponse<PaymentIntentData & { conversionDetails?: CurrencyConversionResult }>> {
    try {
      const { targetCurrency, tenantRegion, ...paymentOptions } = options;
      let conversionDetails: CurrencyConversionResult | undefined;

      // If target currency is specified and different from original, convert
      if (targetCurrency && targetCurrency !== paymentOptions.currency) {
        this.logger.log(`Converting payment from ${paymentOptions.currency} to ${targetCurrency}`);
        
        conversionDetails = await this.currencyService.convertCurrency({
          amount: paymentOptions.amount,
          fromCurrency: paymentOptions.currency,
          toCurrency: targetCurrency,
          tenantId: options.tenantId,
        });

        // Update payment options with converted amount and currency
        paymentOptions.amount = conversionDetails.totalAmount;
        paymentOptions.currency = targetCurrency;
        
        // Add conversion metadata
        paymentOptions.metadata = {
          ...paymentOptions.metadata,
          originalAmount: conversionDetails.originalAmount,
          originalCurrency: conversionDetails.fromCurrency,
          exchangeRate: conversionDetails.exchangeRate,
          conversionFee: conversionDetails.conversionFee,
          conversionSource: conversionDetails.source,
        };
      }

      // Calculate tax if region is specified
      if (tenantRegion) {
        const taxInfo = this.currencyService.calculateTax(
          paymentOptions.amount,
          paymentOptions.currency,
          tenantRegion
        );

        if (taxInfo.taxAmount > 0) {
          paymentOptions.amount += taxInfo.taxAmount;
          paymentOptions.metadata = {
            ...paymentOptions.metadata,
            taxAmount: taxInfo.taxAmount,
            taxRate: taxInfo.taxRate,
            taxName: taxInfo.taxName,
            taxRegion: tenantRegion,
          };
        }
      }

      // Create payment context for gateway selection
      const context: PaymentContext = {
        amount: paymentOptions.amount,
        currency: paymentOptions.currency,
        country: this.getCountryFromRegion(tenantRegion),
        paymentMethod: 'card', // Default, could be passed in options
        tenantId: options.tenantId,
      };

      // Select appropriate gateway
      const gateway = await this.selectGateway(context);

      // Create payment intent
      const result = await gateway.createPaymentIntent(paymentOptions);

      if (result.success && conversionDetails) {
        return {
          ...result,
          data: {
            ...result.data!,
            conversionDetails,
          },
        };
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to create payment intent with conversion:', error);
      return {
        success: false,
        error: {
          code: 'PAYMENT_INTENT_CONVERSION_FAILED',
          message: error.message,
          details: error,
        },
      };
    }
  }

  /**
   * Get supported currencies for a specific gateway
   */
  async getSupportedCurrencies(gateway?: PaymentGateway): Promise<string[]> {
    if (gateway) {
      const gatewayInstance = this.gateways.get(gateway);
      if (gatewayInstance) {
        return gatewayInstance.getSupportedCurrencies();
      }
      return [];
    }

    // Return all supported currencies across all gateways
    const allCurrencies = new Set<string>();
    
    for (const gatewayInstance of this.gateways.values()) {
      const currencies = gatewayInstance.getSupportedCurrencies();
      currencies.forEach(currency => allCurrencies.add(currency));
    }

    return Array.from(allCurrencies);
  }

  /**
   * Get optimal gateway for a currency and region
   */
  async getOptimalGatewayForCurrency(
    currency: string,
    region?: string,
    amount?: number
  ): Promise<{
    gateway: PaymentGateway;
    reasoning: string;
    alternatives: PaymentGateway[];
  }> {
    const context: PaymentContext = {
      currency,
      country: this.getCountryFromRegion(region),
      amount: amount || 100, // Default amount for testing
    };

    try {
      const testResult = await this.testGatewaySelection(context);
      
      return {
        gateway: testResult.selectedGateway,
        reasoning: testResult.reasoning.join('; '),
        alternatives: testResult.alternativeGateways,
      };
    } catch (error) {
      this.logger.error(`Failed to get optimal gateway for ${currency}:`, error);
      
      // Fallback to first available gateway that supports the currency
      for (const [gatewayType, gatewayInstance] of this.gateways.entries()) {
        if (gatewayInstance.getSupportedCurrencies().includes(currency)) {
          return {
            gateway: gatewayType,
            reasoning: 'Fallback selection - first available gateway supporting currency',
            alternatives: [],
          };
        }
      }

      throw new Error(`No gateway supports currency: ${currency}`);
    }
  }

  /**
   * Get exchange rate between two currencies
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<{
    rate: number;
    source: string;
    timestamp: Date;
    validUntil: Date;
  }> {
    const exchangeRate = await this.currencyService.getExchangeRate(fromCurrency, toCurrency);
    
    return {
      rate: exchangeRate.rate,
      source: exchangeRate.source,
      timestamp: exchangeRate.timestamp,
      validUntil: exchangeRate.validUntil,
    };
  }

  /**
   * Calculate total cost including conversion and taxes
   */
  async calculateTotalCost(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    region?: string
  ): Promise<{
    originalAmount: number;
    convertedAmount: number;
    conversionFee: number;
    taxAmount: number;
    totalAmount: number;
    breakdown: {
      baseAmount: number;
      conversionFee: number;
      taxAmount: number;
      total: number;
    };
    currency: string;
  }> {
    let convertedAmount = amount;
    let conversionFee = 0;

    // Convert currency if needed
    if (fromCurrency !== toCurrency) {
      const conversion = await this.currencyService.convertCurrency({
        amount,
        fromCurrency,
        toCurrency,
      });
      
      convertedAmount = conversion.convertedAmount;
      conversionFee = conversion.conversionFee;
    }

    // Calculate tax
    let taxAmount = 0;
    if (region) {
      const taxInfo = this.currencyService.calculateTax(convertedAmount, toCurrency, region);
      taxAmount = taxInfo.taxAmount;
    }

    const totalAmount = convertedAmount + conversionFee + taxAmount;

    return {
      originalAmount: amount,
      convertedAmount,
      conversionFee,
      taxAmount,
      totalAmount,
      breakdown: {
        baseAmount: convertedAmount,
        conversionFee,
        taxAmount,
        total: totalAmount,
      },
      currency: toCurrency,
    };
  }

  /**
   * Get currency information
   */
  getCurrencyInfo(currencyCode: string) {
    return this.currencyService.getCurrencyInfo(currencyCode);
  }

  /**
   * Format amount according to currency rules
   */
  formatAmount(amount: number, currencyCode: string): string {
    return this.currencyService.formatAmount(amount, currencyCode);
  }

  /**
   * Get regional tax information
   */
  getRegionalTaxInfo() {
    return this.currencyService.getRegionalTaxInfo();
  }

  /**
   * Clear currency conversion cache
   */
  clearCurrencyCache(): void {
    this.currencyService.clearCache();
    this.logger.log('Currency conversion cache cleared');
  }

  /**
   * Get currency conversion cache statistics
   */
  getCurrencyCacheStats() {
    return this.currencyService.getCacheStats();
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Get country code from region
   */
  private getCountryFromRegion(region?: string): string | undefined {
    if (!region) return undefined;

    const regionToCountryMap: Record<string, string> = {
      'US': 'US',
      'EU': 'DE', // Default to Germany for EU
      'GB': 'GB',
      'SA': 'SA',
      'AE': 'AE',
      'KW': 'KW',
      'QA': 'QA',
      'BH': 'BH',
      'EG': 'EG',
      'CA': 'CA',
      'AU': 'AU',
      'JP': 'JP',
    };

    return regionToCountryMap[region];
  }
}
