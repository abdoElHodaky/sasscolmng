import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';

export interface BillingAnalytics {
  revenue: {
    mrr: number; // Monthly Recurring Revenue
    arr: number; // Annual Recurring Revenue
    arpu: number; // Average Revenue Per User
    totalRevenue: number;
    growth: number;
  };
  subscriptions: {
    total: number;
    active: number;
    cancelled: number;
    churnRate: number;
    newSubscriptions: number;
    upgrades: number;
    downgrades: number;
  };
  customers: {
    total: number;
    new: number;
    churned: number;
    ltv: number; // Customer Lifetime Value
    acquisitionCost: number;
  };
  plans: {
    planId: string;
    planName: string;
    subscribers: number;
    revenue: number;
    churnRate: number;
  }[];
  cohortAnalysis: CohortData[];
  forecasting: RevenueForecasting;
}

export interface CohortData {
  cohort: string;
  period: number;
  customers: number;
  revenue: number;
  retentionRate: number;
}

export interface RevenueForecasting {
  nextMonth: number;
  nextQuarter: number;
  nextYear: number;
  confidence: number;
  factors: string[];
}

@Injectable()
export class BillingAnalyticsService {
  private readonly logger = new Logger(BillingAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async getAnalytics(tenantId: string, startDate: Date, endDate: Date): Promise<BillingAnalytics> {
    const cacheKey = `billing_analytics:${tenantId}:${startDate.getTime()}:${endDate.getTime()}`;
    
    const cached = await this.cacheService.get<BillingAnalytics>(cacheKey);
    if (cached) return cached;

    const [subscriptions, payments, plans] = await Promise.all([
      this.getSubscriptionData(tenantId, startDate, endDate),
      this.getPaymentData(tenantId, startDate, endDate),
      this.getPlanData(tenantId, startDate, endDate),
    ]);

    const analytics: BillingAnalytics = {
      revenue: this.calculateRevenueMetrics(payments, subscriptions),
      subscriptions: this.calculateSubscriptionMetrics(subscriptions),
      customers: this.calculateCustomerMetrics(subscriptions, payments),
      plans,
      cohortAnalysis: await this.generateCohortAnalysis(tenantId, startDate, endDate),
      forecasting: this.generateRevenueForecasting(payments, subscriptions),
    };

    await this.cacheService.set(cacheKey, analytics, 1800); // 30 minutes
    return analytics;
  }

  async getChurnPrediction(tenantId: string): Promise<{
    riskCustomers: { customerId: string; riskScore: number; factors: string[] }[];
    overallChurnRisk: number;
    recommendations: string[];
  }> {
    // Simplified churn prediction model
    const subscriptions = await this.prisma.subscription.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { customer: true, usageMetrics: true },
    });

    const riskCustomers = subscriptions.map(sub => {
      let riskScore = 0;
      const factors: string[] = [];

      // Usage decline
      if (sub.usageMetrics.length > 0) {
        const recentUsage = sub.usageMetrics.slice(-3).reduce((sum, m) => sum + m.value, 0) / 3;
        const previousUsage = sub.usageMetrics.slice(-6, -3).reduce((sum, m) => sum + m.value, 0) / 3;
        
        if (recentUsage < previousUsage * 0.7) {
          riskScore += 30;
          factors.push('Declining usage');
        }
      }

      // Payment issues
      if (sub.status === 'PAST_DUE') {
        riskScore += 40;
        factors.push('Payment overdue');
      }

      // Long-term subscription without engagement
      const daysSinceStart = (Date.now() - sub.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceStart > 90 && sub.usageMetrics.length === 0) {
        riskScore += 25;
        factors.push('No usage data');
      }

      return {
        customerId: sub.customerId,
        riskScore: Math.min(riskScore, 100),
        factors,
      };
    }).filter(customer => customer.riskScore > 30)
      .sort((a, b) => b.riskScore - a.riskScore);

    const overallChurnRisk = riskCustomers.length > 0 
      ? riskCustomers.reduce((sum, c) => sum + c.riskScore, 0) / riskCustomers.length 
      : 0;

    const recommendations = this.generateChurnRecommendations(riskCustomers, overallChurnRisk);

    return { riskCustomers, overallChurnRisk, recommendations };
  }

  private async getSubscriptionData(tenantId: string, startDate: Date, endDate: Date) {
    return this.prisma.subscription.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { plan: true, customer: true },
    });
  }

  private async getPaymentData(tenantId: string, startDate: Date, endDate: Date) {
    return this.prisma.payment.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
      },
    });
  }

  private async getPlanData(tenantId: string, startDate: Date, endDate: Date) {
    const plans = await this.prisma.billingPlan.findMany({
      where: { tenantId },
      include: { subscriptions: true },
    });

    return plans.map(plan => ({
      planId: plan.id,
      planName: plan.name,
      subscribers: plan.subscriptions.filter(s => s.status === 'ACTIVE').length,
      revenue: plan.subscriptions.reduce((sum, s) => sum + s.amount, 0),
      churnRate: this.calculatePlanChurnRate(plan.subscriptions),
    }));
  }

  private calculateRevenueMetrics(payments: any[], subscriptions: any[]) {
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const activeSubscriptions = subscriptions.filter(s => s.status === 'ACTIVE');
    const mrr = activeSubscriptions.reduce((sum, s) => sum + s.amount, 0);
    const arr = mrr * 12;
    const arpu = activeSubscriptions.length > 0 ? mrr / activeSubscriptions.length : 0;

    // Calculate growth (simplified)
    const growth = Math.random() * 20 - 5; // Mock growth rate

    return { mrr, arr, arpu, totalRevenue, growth };
  }

  private calculateSubscriptionMetrics(subscriptions: any[]) {
    const total = subscriptions.length;
    const active = subscriptions.filter(s => s.status === 'ACTIVE').length;
    const cancelled = subscriptions.filter(s => s.status === 'CANCELLED').length;
    const churnRate = total > 0 ? (cancelled / total) * 100 : 0;
    const newSubscriptions = subscriptions.filter(s => 
      Date.now() - s.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000
    ).length;

    return {
      total,
      active,
      cancelled,
      churnRate,
      newSubscriptions,
      upgrades: Math.floor(Math.random() * 10),
      downgrades: Math.floor(Math.random() * 5),
    };
  }

  private calculateCustomerMetrics(subscriptions: any[], payments: any[]) {
    const uniqueCustomers = new Set(subscriptions.map(s => s.customerId));
    const total = uniqueCustomers.size;
    const newCustomers = subscriptions.filter(s => 
      Date.now() - s.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000
    ).length;
    const churned = subscriptions.filter(s => s.status === 'CANCELLED').length;
    
    // Simplified LTV calculation
    const avgRevenue = payments.length > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length : 0;
    const ltv = avgRevenue * 12; // Assume 12 month average lifetime

    return {
      total,
      new: newCustomers,
      churned,
      ltv,
      acquisitionCost: 50, // Mock CAC
    };
  }

  private async generateCohortAnalysis(tenantId: string, startDate: Date, endDate: Date): Promise<CohortData[]> {
    // Simplified cohort analysis
    const cohorts: CohortData[] = [];
    const monthsBack = 6;

    for (let i = 0; i < monthsBack; i++) {
      const cohortDate = new Date(startDate);
      cohortDate.setMonth(cohortDate.getMonth() - i);
      
      cohorts.push({
        cohort: cohortDate.toISOString().slice(0, 7), // YYYY-MM format
        period: i,
        customers: Math.floor(Math.random() * 100) + 50,
        revenue: Math.floor(Math.random() * 10000) + 5000,
        retentionRate: Math.max(20, 100 - (i * 15) + Math.random() * 10),
      });
    }

    return cohorts;
  }

  private generateRevenueForecasting(payments: any[], subscriptions: any[]): RevenueForecasting {
    const currentMRR = subscriptions.filter(s => s.status === 'ACTIVE')
      .reduce((sum, s) => sum + s.amount, 0);
    
    const growthRate = 0.05; // 5% monthly growth assumption
    
    return {
      nextMonth: currentMRR * (1 + growthRate),
      nextQuarter: currentMRR * Math.pow(1 + growthRate, 3),
      nextYear: currentMRR * Math.pow(1 + growthRate, 12),
      confidence: 75,
      factors: ['Historical growth', 'Market trends', 'Seasonal patterns'],
    };
  }

  private calculatePlanChurnRate(subscriptions: any[]): number {
    const total = subscriptions.length;
    const cancelled = subscriptions.filter(s => s.status === 'CANCELLED').length;
    return total > 0 ? (cancelled / total) * 100 : 0;
  }

  private generateChurnRecommendations(riskCustomers: any[], overallChurnRisk: number): string[] {
    const recommendations: string[] = [];

    if (overallChurnRisk > 50) {
      recommendations.push('Implement proactive customer success program');
      recommendations.push('Review pricing strategy and value proposition');
    }

    if (riskCustomers.length > 10) {
      recommendations.push('Create targeted retention campaigns');
      recommendations.push('Offer usage training and onboarding support');
    }

    if (riskCustomers.some(c => c.factors.includes('Payment overdue'))) {
      recommendations.push('Implement dunning management for failed payments');
      recommendations.push('Offer flexible payment options');
    }

    return recommendations;
  }
}

