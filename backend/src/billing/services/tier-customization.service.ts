import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentGateway } from '../interfaces/payment-types.interface';

export interface TierFeature {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'advanced' | 'premium' | 'addon';
  type: 'boolean' | 'numeric' | 'enum';
  defaultValue: any;
  options?: any[]; // For enum types
  pricing: {
    basePrice: number; // Monthly price in cents
    perUnitPrice?: number; // For numeric features
    currency: string;
  };
  dependencies?: string[]; // Feature IDs that must be enabled
  conflicts?: string[]; // Feature IDs that cannot be enabled together
  metadata?: Record<string, any>;
}

export interface CustomTierConfiguration {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  basePlan?: string; // Reference to existing plan
  features: Record<string, any>; // Feature ID -> value mapping
  pricing: {
    monthlyPrice: number;
    yearlyPrice?: number;
    currency: string;
    regionalPricing?: Record<string, { monthlyPrice: number; yearlyPrice?: number }>;
  };
  limits: {
    users?: number;
    storage?: number; // In GB
    apiCalls?: number;
    customFields?: number;
    integrations?: number;
    [key: string]: any;
  };
  supportedGateways: PaymentGateway[];
  isActive: boolean;
  validFrom?: Date;
  validUntil?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TierCustomizationRequest {
  tenantId: string;
  name: string;
  description?: string;
  basePlan?: string;
  features: Record<string, any>;
  customLimits?: Record<string, number>;
  currency?: string;
  region?: string;
}

export interface PricingCalculation {
  basePrice: number;
  featureAddons: Array<{
    featureId: string;
    featureName: string;
    price: number;
    quantity?: number;
  }>;
  totalMonthlyPrice: number;
  totalYearlyPrice: number;
  currency: string;
  discounts?: Array<{
    type: string;
    amount: number;
    description: string;
  }>;
  breakdown: {
    base: number;
    features: number;
    discounts: number;
    taxes?: number;
  };
}

@Injectable()
export class TierCustomizationService {
  private readonly logger = new Logger(TierCustomizationService.name);
  private availableFeatures: Map<string, TierFeature> = new Map();

  constructor(private readonly prisma: PrismaService) {
    this.initializeFeatures();
  }

  /**
   * Get all available features for tier customization
   */
  async getAvailableFeatures(): Promise<TierFeature[]> {
    return Array.from(this.availableFeatures.values());
  }

  /**
   * Get features by category
   */
  async getFeaturesByCategory(category: TierFeature['category']): Promise<TierFeature[]> {
    return Array.from(this.availableFeatures.values())
      .filter(feature => feature.category === category);
  }

  /**
   * Create a custom tier configuration
   */
  async createCustomTier(request: TierCustomizationRequest): Promise<CustomTierConfiguration> {
    this.logger.log(`Creating custom tier for tenant: ${request.tenantId}`);

    // Validate feature configuration
    await this.validateFeatureConfiguration(request.features);

    // Calculate pricing
    const pricing = await this.calculatePricing(request.features, request.currency || 'USD', request.region);

    // Determine supported gateways based on currency and region
    const supportedGateways = this.determineSupportedGateways(request.currency || 'USD', request.region);

    // Create custom tier configuration
    const customTier: CustomTierConfiguration = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId: request.tenantId,
      name: request.name,
      description: request.description,
      basePlan: request.basePlan,
      features: request.features,
      pricing: {
        monthlyPrice: pricing.totalMonthlyPrice,
        yearlyPrice: pricing.totalYearlyPrice,
        currency: pricing.currency,
        regionalPricing: await this.calculateRegionalPricing(request.features),
      },
      limits: await this.calculateLimits(request.features, request.customLimits),
      supportedGateways,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in database
    await this.storeCustomTier(customTier);

    this.logger.log(`Created custom tier: ${customTier.id} for tenant: ${request.tenantId}`);
    return customTier;
  }

  /**
   * Update an existing custom tier
   */
  async updateCustomTier(
    tierId: string,
    updates: Partial<TierCustomizationRequest>,
  ): Promise<CustomTierConfiguration> {
    const existingTier = await this.getCustomTier(tierId);
    if (!existingTier) {
      throw new NotFoundException(`Custom tier not found: ${tierId}`);
    }

    // Merge updates with existing configuration
    const updatedFeatures = { ...existingTier.features, ...updates.features };
    
    // Validate updated configuration
    await this.validateFeatureConfiguration(updatedFeatures);

    // Recalculate pricing if features changed
    let updatedPricing = existingTier.pricing;
    if (updates.features) {
      const pricing = await this.calculatePricing(
        updatedFeatures,
        updates.currency || existingTier.pricing.currency,
      );
      updatedPricing = {
        monthlyPrice: pricing.totalMonthlyPrice,
        yearlyPrice: pricing.totalYearlyPrice,
        currency: pricing.currency,
        regionalPricing: await this.calculateRegionalPricing(updatedFeatures),
      };
    }

    // Update configuration
    const updatedTier: CustomTierConfiguration = {
      ...existingTier,
      name: updates.name || existingTier.name,
      description: updates.description || existingTier.description,
      features: updatedFeatures,
      pricing: updatedPricing,
      limits: await this.calculateLimits(updatedFeatures, updates.customLimits),
      updatedAt: new Date(),
    };

    // Store updated configuration
    await this.storeCustomTier(updatedTier);

    this.logger.log(`Updated custom tier: ${tierId}`);
    return updatedTier;
  }

  /**
   * Get custom tier configuration
   */
  async getCustomTier(tierId: string): Promise<CustomTierConfiguration | null> {
    try {
      // In a real implementation, this would query the database
      // For now, we'll simulate with a placeholder
      return null;
    } catch (error) {
      this.logger.error(`Failed to get custom tier ${tierId}:`, error);
      return null;
    }
  }

  /**
   * Get all custom tiers for a tenant
   */
  async getCustomTiersForTenant(tenantId: string): Promise<CustomTierConfiguration[]> {
    try {
      // Query custom billing plans for the tenant
      const customPlans = await this.prisma.billingPlan.findMany({
        where: {
          tenantId,
          isCustom: true,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Convert to CustomTierConfiguration format
      return customPlans.map(plan => this.convertPlanToTierConfiguration(plan));
    } catch (error) {
      this.logger.error(`Failed to get custom tiers for tenant ${tenantId}:`, error);
      return [];
    }
  }

  /**
   * Calculate pricing for a feature configuration
   */
  async calculatePricing(
    features: Record<string, any>,
    currency: string = 'USD',
    region?: string,
  ): Promise<PricingCalculation> {
    let basePrice = 0;
    const featureAddons: PricingCalculation['featureAddons'] = [];
    let totalFeaturePrice = 0;

    // Calculate feature-based pricing
    for (const [featureId, value] of Object.entries(features)) {
      const feature = this.availableFeatures.get(featureId);
      if (!feature || !value) continue;

      let featurePrice = 0;
      let quantity = 1;

      if (feature.type === 'boolean' && value === true) {
        featurePrice = feature.pricing.basePrice;
      } else if (feature.type === 'numeric' && typeof value === 'number') {
        featurePrice = feature.pricing.basePrice;
        if (feature.pricing.perUnitPrice) {
          featurePrice += (value - 1) * feature.pricing.perUnitPrice;
          quantity = value;
        }
      } else if (feature.type === 'enum') {
        featurePrice = feature.pricing.basePrice;
      }

      if (featurePrice > 0) {
        featureAddons.push({
          featureId,
          featureName: feature.name,
          price: featurePrice,
          quantity: quantity > 1 ? quantity : undefined,
        });
        totalFeaturePrice += featurePrice;
      }
    }

    const totalMonthlyPrice = basePrice + totalFeaturePrice;
    const totalYearlyPrice = Math.round(totalMonthlyPrice * 12 * 0.9); // 10% yearly discount

    // Apply regional pricing adjustments
    const regionalMultiplier = this.getRegionalPricingMultiplier(currency, region);
    const adjustedMonthlyPrice = Math.round(totalMonthlyPrice * regionalMultiplier);
    const adjustedYearlyPrice = Math.round(totalYearlyPrice * regionalMultiplier);

    return {
      basePrice,
      featureAddons,
      totalMonthlyPrice: adjustedMonthlyPrice,
      totalYearlyPrice: adjustedYearlyPrice,
      currency,
      breakdown: {
        base: Math.round(basePrice * regionalMultiplier),
        features: Math.round(totalFeaturePrice * regionalMultiplier),
        discounts: adjustedYearlyPrice - (adjustedMonthlyPrice * 12),
      },
    };
  }

  /**
   * Validate feature configuration for conflicts and dependencies
   */
  private async validateFeatureConfiguration(features: Record<string, any>): Promise<void> {
    const enabledFeatures = Object.keys(features).filter(id => features[id]);

    for (const featureId of enabledFeatures) {
      const feature = this.availableFeatures.get(featureId);
      if (!feature) {
        throw new BadRequestException(`Unknown feature: ${featureId}`);
      }

      // Check dependencies
      if (feature.dependencies) {
        for (const dependency of feature.dependencies) {
          if (!features[dependency]) {
            throw new BadRequestException(
              `Feature "${feature.name}" requires "${this.availableFeatures.get(dependency)?.name}" to be enabled`,
            );
          }
        }
      }

      // Check conflicts
      if (feature.conflicts) {
        for (const conflict of feature.conflicts) {
          if (features[conflict]) {
            throw new BadRequestException(
              `Feature "${feature.name}" conflicts with "${this.availableFeatures.get(conflict)?.name}"`,
            );
          }
        }
      }

      // Validate feature value type
      this.validateFeatureValue(feature, features[featureId]);
    }
  }

  /**
   * Validate individual feature value
   */
  private validateFeatureValue(feature: TierFeature, value: any): void {
    switch (feature.type) {
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new BadRequestException(`Feature "${feature.name}" must be a boolean value`);
        }
        break;
      case 'numeric':
        if (typeof value !== 'number' || value < 0) {
          throw new BadRequestException(`Feature "${feature.name}" must be a positive number`);
        }
        break;
      case 'enum':
        if (!feature.options?.includes(value)) {
          throw new BadRequestException(
            `Feature "${feature.name}" must be one of: ${feature.options?.join(', ')}`,
          );
        }
        break;
    }
  }

  /**
   * Calculate limits based on features
   */
  private async calculateLimits(
    features: Record<string, any>,
    customLimits?: Record<string, number>,
  ): Promise<CustomTierConfiguration['limits']> {
    const limits: CustomTierConfiguration['limits'] = {
      users: 10, // Default
      storage: 5, // 5GB default
      apiCalls: 10000, // 10k per month default
      customFields: 10,
      integrations: 3,
    };

    // Apply feature-based limit modifications
    for (const [featureId, value] of Object.entries(features)) {
      const feature = this.availableFeatures.get(featureId);
      if (!feature || !value) continue;

      // Apply feature-specific limit modifications
      switch (featureId) {
        case 'unlimited_users':
          if (value === true) limits.users = -1; // Unlimited
          break;
        case 'extra_storage':
          if (typeof value === 'number') limits.storage = (limits.storage || 0) + value;
          break;
        case 'api_boost':
          if (value === true) limits.apiCalls = (limits.apiCalls || 0) * 5;
          break;
        case 'custom_fields_pack':
          if (typeof value === 'number') limits.customFields = value;
          break;
        case 'premium_integrations':
          if (value === true) limits.integrations = 20;
          break;
      }
    }

    // Apply custom limits (overrides)
    if (customLimits) {
      Object.assign(limits, customLimits);
    }

    return limits;
  }

  /**
   * Calculate regional pricing variations
   */
  private async calculateRegionalPricing(
    features: Record<string, any>,
  ): Promise<Record<string, { monthlyPrice: number; yearlyPrice?: number }>> {
    const regions = ['US', 'EU', 'MENA', 'EG'];
    const regionalPricing: Record<string, { monthlyPrice: number; yearlyPrice?: number }> = {};

    for (const region of regions) {
      const pricing = await this.calculatePricing(features, this.getRegionalCurrency(region), region);
      regionalPricing[region] = {
        monthlyPrice: pricing.totalMonthlyPrice,
        yearlyPrice: pricing.totalYearlyPrice,
      };
    }

    return regionalPricing;
  }

  /**
   * Determine supported payment gateways based on currency and region
   */
  private determineSupportedGateways(currency: string, region?: string): PaymentGateway[] {
    const gateways: PaymentGateway[] = [];

    // Stripe - Global support
    gateways.push(PaymentGateway.STRIPE);

    // PayTabs - Middle East
    if (['SAR', 'AED', 'KWD', 'QAR', 'BHD'].includes(currency) || 
        ['SA', 'AE', 'KW', 'QA', 'BH'].includes(region || '')) {
      gateways.push(PaymentGateway.PAYTABS);
    }

    // PayMob - Egypt
    if (currency === 'EGP' || region === 'EG') {
      gateways.push(PaymentGateway.PAYMOB);
    }

    return gateways;
  }

  /**
   * Get regional pricing multiplier
   */
  private getRegionalPricingMultiplier(currency: string, region?: string): number {
    // Simplified regional pricing adjustments
    const multipliers: Record<string, number> = {
      'USD': 1.0,
      'EUR': 1.1,
      'GBP': 1.15,
      'SAR': 0.8,
      'AED': 0.85,
      'EGP': 0.3,
    };

    return multipliers[currency] || 1.0;
  }

  /**
   * Get regional currency
   */
  private getRegionalCurrency(region: string): string {
    const currencies: Record<string, string> = {
      'US': 'USD',
      'EU': 'EUR',
      'MENA': 'SAR',
      'EG': 'EGP',
    };

    return currencies[region] || 'USD';
  }

  /**
   * Store custom tier in database
   */
  private async storeCustomTier(tier: CustomTierConfiguration): Promise<void> {
    try {
      await this.prisma.billingPlan.upsert({
        where: { id: tier.id },
        update: {
          name: tier.name,
          description: tier.description,
          monthlyPrice: tier.pricing.monthlyPrice,
          yearlyPrice: tier.pricing.yearlyPrice,
          currency: tier.pricing.currency,
          features: tier.features,
          limits: tier.limits,
          supportedGateways: tier.supportedGateways,
          regionalPricing: tier.pricing.regionalPricing,
          isActive: tier.isActive,
          updatedAt: tier.updatedAt,
        },
        create: {
          id: tier.id,
          name: tier.name,
          description: tier.description,
          type: 'CUSTOM',
          monthlyPrice: tier.pricing.monthlyPrice,
          yearlyPrice: tier.pricing.yearlyPrice,
          currency: tier.pricing.currency,
          features: tier.features,
          limits: tier.limits,
          isCustom: true,
          tenantId: tier.tenantId,
          supportedGateways: tier.supportedGateways,
          regionalPricing: tier.pricing.regionalPricing,
          isActive: tier.isActive,
          createdAt: tier.createdAt,
          updatedAt: tier.updatedAt,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to store custom tier ${tier.id}:`, error);
      throw error;
    }
  }

  /**
   * Convert database plan to tier configuration
   */
  private convertPlanToTierConfiguration(plan: any): CustomTierConfiguration {
    return {
      id: plan.id,
      tenantId: plan.tenantId,
      name: plan.name,
      description: plan.description,
      features: plan.features || {},
      pricing: {
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
        regionalPricing: plan.regionalPricing,
      },
      limits: plan.limits || {},
      supportedGateways: plan.supportedGateways || [PaymentGateway.STRIPE],
      isActive: plan.isActive,
      validFrom: plan.validFrom,
      validUntil: plan.validUntil,
      metadata: plan.metadata,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  /**
   * Initialize available features
   */
  private initializeFeatures(): void {
    const features: TierFeature[] = [
      // Core Features
      {
        id: 'unlimited_users',
        name: 'Unlimited Users',
        description: 'Remove user limits for your organization',
        category: 'core',
        type: 'boolean',
        defaultValue: false,
        pricing: { basePrice: 2000, currency: 'USD' }, // $20/month
      },
      {
        id: 'extra_storage',
        name: 'Extra Storage',
        description: 'Additional storage space in GB',
        category: 'core',
        type: 'numeric',
        defaultValue: 0,
        pricing: { basePrice: 500, perUnitPrice: 100, currency: 'USD' }, // $5 base + $1/GB
      },
      {
        id: 'priority_support',
        name: 'Priority Support',
        description: '24/7 priority customer support',
        category: 'core',
        type: 'boolean',
        defaultValue: false,
        pricing: { basePrice: 1500, currency: 'USD' }, // $15/month
      },

      // Advanced Features
      {
        id: 'api_boost',
        name: 'API Rate Boost',
        description: '5x increase in API rate limits',
        category: 'advanced',
        type: 'boolean',
        defaultValue: false,
        pricing: { basePrice: 1000, currency: 'USD' }, // $10/month
      },
      {
        id: 'custom_fields_pack',
        name: 'Custom Fields Pack',
        description: 'Number of custom fields allowed',
        category: 'advanced',
        type: 'numeric',
        defaultValue: 10,
        pricing: { basePrice: 800, perUnitPrice: 50, currency: 'USD' }, // $8 base + $0.50/field
      },
      {
        id: 'advanced_analytics',
        name: 'Advanced Analytics',
        description: 'Detailed analytics and reporting',
        category: 'advanced',
        type: 'boolean',
        defaultValue: false,
        pricing: { basePrice: 1200, currency: 'USD' }, // $12/month
      },

      // Premium Features
      {
        id: 'white_labeling',
        name: 'White Labeling',
        description: 'Remove branding and add your own',
        category: 'premium',
        type: 'boolean',
        defaultValue: false,
        pricing: { basePrice: 5000, currency: 'USD' }, // $50/month
      },
      {
        id: 'premium_integrations',
        name: 'Premium Integrations',
        description: 'Access to premium third-party integrations',
        category: 'premium',
        type: 'boolean',
        defaultValue: false,
        pricing: { basePrice: 2500, currency: 'USD' }, // $25/month
      },
      {
        id: 'sso_provider',
        name: 'SSO Provider',
        description: 'Single Sign-On provider type',
        category: 'premium',
        type: 'enum',
        defaultValue: null,
        options: ['saml', 'oauth', 'ldap'],
        pricing: { basePrice: 3000, currency: 'USD' }, // $30/month
      },

      // Add-on Features
      {
        id: 'backup_retention',
        name: 'Extended Backup Retention',
        description: 'Number of days to retain backups',
        category: 'addon',
        type: 'numeric',
        defaultValue: 30,
        pricing: { basePrice: 500, perUnitPrice: 10, currency: 'USD' }, // $5 base + $0.10/day
      },
      {
        id: 'audit_logs',
        name: 'Audit Logs',
        description: 'Detailed audit logging and compliance',
        category: 'addon',
        type: 'boolean',
        defaultValue: false,
        pricing: { basePrice: 1800, currency: 'USD' }, // $18/month
        dependencies: ['advanced_analytics'],
      },
    ];

    // Store features in map for quick lookup
    features.forEach(feature => {
      this.availableFeatures.set(feature.id, feature);
    });

    this.logger.log(`Initialized ${features.length} tier customization features`);
  }
}
