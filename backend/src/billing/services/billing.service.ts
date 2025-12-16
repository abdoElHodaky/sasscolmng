import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from './stripe.service';

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    schools: number;
    users: number;
    students: number;
    apiCalls: number;
    storage: number; // in GB
  };
  stripeProductId?: string;
  stripePriceId?: string;
  isActive: boolean;
  trialDays?: number;
}

export interface UsageMetrics {
  tenantId: string;
  schools: number;
  users: number;
  students: number;
  apiCalls: number;
  storage: number;
  lastUpdated: Date;
}

export interface BillingCycle {
  id: string;
  tenantId: string;
  planId: string;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'ended' | 'cancelled';
  usage: UsageMetrics;
  amount: number;
  currency: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  // Predefined billing plans
  private readonly plans: BillingPlan[] = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for small schools getting started',
      price: 29.99,
      currency: 'USD',
      interval: 'month',
      features: [
        'Basic scheduling',
        'Email notifications',
        'Up to 1 school',
        'Up to 50 users',
        'Up to 500 students',
        'Email support'
      ],
      limits: {
        schools: 1,
        users: 50,
        students: 500,
        apiCalls: 10000,
        storage: 5
      },
      stripePriceId: 'price_starter_monthly',
      isActive: true,
      trialDays: 14
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'Advanced features for growing institutions',
      price: 79.99,
      currency: 'USD',
      interval: 'month',
      features: [
        'Advanced scheduling',
        'SMS & Push notifications',
        'Up to 3 schools',
        'Up to 200 users',
        'Up to 2,000 students',
        'Priority support',
        'Analytics dashboard',
        'Custom reports'
      ],
      limits: {
        schools: 3,
        users: 200,
        students: 2000,
        apiCalls: 50000,
        storage: 25
      },
      stripePriceId: 'price_professional_monthly',
      isActive: true,
      trialDays: 14
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Complete solution for large organizations',
      price: 199.99,
      currency: 'USD',
      interval: 'month',
      features: [
        'All features included',
        'Unlimited schools',
        'Unlimited users',
        'Unlimited students',
        '24/7 support',
        'Custom integrations',
        'Advanced analytics',
        'API access',
        'White-label options'
      ],
      limits: {
        schools: -1, // unlimited
        users: -1,
        students: -1,
        apiCalls: -1,
        storage: -1
      },
      stripePriceId: 'price_enterprise_monthly',
      isActive: true,
      trialDays: 30
    }
  ];

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  /**
   * Get all available billing plans
   */
  async getPlans(): Promise<BillingPlan[]> {
    return this.plans.filter(plan => plan.isActive);
  }

  /**
   * Get a specific billing plan by ID
   */
  async getPlan(planId: string): Promise<BillingPlan> {
    const plan = this.plans.find(p => p.id === planId && p.isActive);
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }
    return plan;
  }

  /**
   * Get current usage metrics for a tenant
   */
  async getUsageMetrics(tenantId: string): Promise<UsageMetrics> {
    try {
      // Get schools count
      const schoolsCount = await this.prisma.school.count({
        where: { tenantId }
      });

      // Get users count
      const usersCount = await this.prisma.user.count({
        where: { tenantId }
      });

      // Get students count
      const studentsCount = await this.prisma.user.count({
        where: { 
          tenantId,
          role: 'STUDENT'
        }
      });

      // For now, simulate API calls and storage
      // In production, these would be tracked in separate tables
      const apiCalls = Math.floor(Math.random() * 1000); // Simulated
      const storage = Math.floor(Math.random() * 10); // Simulated GB

      return {
        tenantId,
        schools: schoolsCount,
        users: usersCount,
        students: studentsCount,
        apiCalls,
        storage,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error(`Failed to get usage metrics for tenant ${tenantId}`, error);
      throw new BadRequestException('Failed to retrieve usage metrics');
    }
  }

  /**
   * Check if tenant usage is within plan limits
   */
  async checkUsageLimits(tenantId: string, planId: string): Promise<{
    withinLimits: boolean;
    violations: string[];
    usage: UsageMetrics;
    plan: BillingPlan;
  }> {
    const plan = await this.getPlan(planId);
    const usage = await this.getUsageMetrics(tenantId);
    
    const violations: string[] = [];

    // Check each limit (unlimited = -1)
    if (plan.limits.schools !== -1 && usage.schools > plan.limits.schools) {
      violations.push(`Schools: ${usage.schools}/${plan.limits.schools}`);
    }
    
    if (plan.limits.users !== -1 && usage.users > plan.limits.users) {
      violations.push(`Users: ${usage.users}/${plan.limits.users}`);
    }
    
    if (plan.limits.students !== -1 && usage.students > plan.limits.students) {
      violations.push(`Students: ${usage.students}/${plan.limits.students}`);
    }
    
    if (plan.limits.apiCalls !== -1 && usage.apiCalls > plan.limits.apiCalls) {
      violations.push(`API Calls: ${usage.apiCalls}/${plan.limits.apiCalls}`);
    }
    
    if (plan.limits.storage !== -1 && usage.storage > plan.limits.storage) {
      violations.push(`Storage: ${usage.storage}GB/${plan.limits.storage}GB`);
    }

    return {
      withinLimits: violations.length === 0,
      violations,
      usage,
      plan
    };
  }

  /**
   * Calculate billing amount based on usage and plan
   */
  async calculateBillingAmount(
    tenantId: string, 
    planId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<{
    baseAmount: number;
    overageAmount: number;
    totalAmount: number;
    currency: string;
    breakdown: any[];
  }> {
    const plan = await this.getPlan(planId);
    const usage = await this.getUsageMetrics(tenantId);
    
    const breakdown: any[] = [];
    let baseAmount = plan.price;
    let overageAmount = 0;

    // Calculate pro-rated amount based on billing period
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const monthlyDays = 30; // Approximate
    const proRatedMultiplier = totalDays / monthlyDays;
    
    baseAmount = baseAmount * proRatedMultiplier;
    
    breakdown.push({
      item: `${plan.name} Plan`,
      description: `${totalDays} days (${startDate.toDateString()} - ${endDate.toDateString()})`,
      amount: baseAmount,
      currency: plan.currency
    });

    // Calculate overage charges (for plans with limits)
    if (plan.limits.schools !== -1 && usage.schools > plan.limits.schools) {
      const overage = usage.schools - plan.limits.schools;
      const overageCharge = overage * 10; // $10 per extra school
      overageAmount += overageCharge;
      breakdown.push({
        item: 'Extra Schools',
        description: `${overage} schools over limit`,
        amount: overageCharge,
        currency: plan.currency
      });
    }

    if (plan.limits.users !== -1 && usage.users > plan.limits.users) {
      const overage = usage.users - plan.limits.users;
      const overageCharge = overage * 2; // $2 per extra user
      overageAmount += overageCharge;
      breakdown.push({
        item: 'Extra Users',
        description: `${overage} users over limit`,
        amount: overageCharge,
        currency: plan.currency
      });
    }

    if (plan.limits.storage !== -1 && usage.storage > plan.limits.storage) {
      const overage = usage.storage - plan.limits.storage;
      const overageCharge = overage * 5; // $5 per extra GB
      overageAmount += overageCharge;
      breakdown.push({
        item: 'Extra Storage',
        description: `${overage}GB over limit`,
        amount: overageCharge,
        currency: plan.currency
      });
    }

    const totalAmount = baseAmount + overageAmount;

    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      overageAmount: Math.round(overageAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      currency: plan.currency,
      breakdown
    };
  }

  /**
   * Create a new billing cycle
   */
  async createBillingCycle(
    tenantId: string,
    planId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BillingCycle> {
    const plan = await this.getPlan(planId);
    const usage = await this.getUsageMetrics(tenantId);
    const billing = await this.calculateBillingAmount(tenantId, planId, startDate, endDate);

    const billingCycle: BillingCycle = {
      id: `cycle_${Date.now()}_${tenantId}`,
      tenantId,
      planId,
      startDate,
      endDate,
      status: 'active',
      usage,
      amount: billing.totalAmount,
      currency: billing.currency
    };

    this.logger.log(`Created billing cycle ${billingCycle.id} for tenant ${tenantId}`);
    
    return billingCycle;
  }

  /**
   * Get billing history for a tenant
   */
  async getBillingHistory(tenantId: string, limit = 10): Promise<BillingCycle[]> {
    // In a real implementation, this would query a billing_cycles table
    // For now, return simulated data
    const cycles: BillingCycle[] = [];
    
    for (let i = 0; i < Math.min(limit, 3); i++) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() - i);
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 1);
      
      const cycle = await this.createBillingCycle(tenantId, 'professional', startDate, endDate);
      cycle.status = i === 0 ? 'active' : 'ended';
      cycles.push(cycle);
    }
    
    return cycles;
  }

  /**
   * Upgrade/downgrade tenant plan
   */
  async changePlan(
    tenantId: string,
    newPlanId: string,
    effectiveDate?: Date
  ): Promise<{
    success: boolean;
    message: string;
    prorationAmount?: number;
    newPlan: BillingPlan;
  }> {
    const newPlan = await this.getPlan(newPlanId);
    const effectiveChangeDate = effectiveDate || new Date();
    
    // Check if usage is within new plan limits
    const limitsCheck = await this.checkUsageLimits(tenantId, newPlanId);
    
    if (!limitsCheck.withinLimits) {
      return {
        success: false,
        message: `Current usage exceeds new plan limits: ${limitsCheck.violations.join(', ')}`,
        newPlan
      };
    }

    // Calculate proration (simplified)
    const currentDate = new Date();
    const daysRemaining = Math.ceil((new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    const prorationAmount = (newPlan.price / 30) * daysRemaining;

    this.logger.log(`Plan change for tenant ${tenantId}: new plan ${newPlanId}, proration: $${prorationAmount}`);

    return {
      success: true,
      message: `Successfully changed to ${newPlan.name} plan`,
      prorationAmount: Math.round(prorationAmount * 100) / 100,
      newPlan
    };
  }

  /**
   * Get billing summary for dashboard
   */
  async getBillingSummary(tenantId: string): Promise<{
    currentPlan: BillingPlan;
    usage: UsageMetrics;
    limitsCheck: any;
    nextBillingDate: Date;
    currentAmount: number;
    currency: string;
  }> {
    // For demo, assume professional plan
    const currentPlan = await this.getPlan('professional');
    const usage = await this.getUsageMetrics(tenantId);
    const limitsCheck = await this.checkUsageLimits(tenantId, currentPlan.id);
    
    // Calculate next billing date (next month)
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    nextBillingDate.setDate(1);
    
    const billing = await this.calculateBillingAmount(
      tenantId,
      currentPlan.id,
      new Date(),
      nextBillingDate
    );

    return {
      currentPlan,
      usage,
      limitsCheck,
      nextBillingDate,
      currentAmount: billing.totalAmount,
      currency: currentPlan.currency
    };
  }

  /**
   * Enforce usage limits
   */
  async enforceUsageLimits(tenantId: string, planId: string): Promise<{
    allowed: boolean;
    reason?: string;
    currentUsage: UsageMetrics;
    planLimits: BillingPlan['limits'];
  }> {
    const limitsCheck = await this.checkUsageLimits(tenantId, planId);
    
    return {
      allowed: limitsCheck.withinLimits,
      reason: limitsCheck.violations.length > 0 ? 
        `Usage limits exceeded: ${limitsCheck.violations.join(', ')}` : 
        undefined,
      currentUsage: limitsCheck.usage,
      planLimits: limitsCheck.plan.limits
    };
  }
}
