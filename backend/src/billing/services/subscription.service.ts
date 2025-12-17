import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from './stripe.service';
import { 
  CreateSubscriptionDto, 
  UpdateSubscriptionDto, 
  CancelSubscriptionDto, 
  ChangePlanDto,
  SubscriptionResponseDto,
  SubscriptionUpdateResponseDto
} from '../dto';
import { 
  Subscription, 
  BillingPlan, 
  SubscriptionStatus, 
  BillingCycle,
  Prisma 
} from '@prisma/client';
import { addMonths, addYears, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Create a new subscription
   */
  async createSubscription(
    tenantId: string,
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const { planId, schoolId, billingCycle, startDate, startTrial, stripeCustomerId, metadata } = createSubscriptionDto;

    // Validate plan exists and is active
    const plan = await this.prisma.billingPlan.findFirst({
      where: { id: planId, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException('Billing plan not found or inactive');
    }

    // Validate school exists and belongs to tenant
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId, tenantId },
    });

    if (!school) {
      throw new NotFoundException('School not found or does not belong to tenant');
    }

    // Check if school already has an active subscription
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        schoolId,
        tenantId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      },
    });

    if (existingSubscription) {
      throw new ConflictException('School already has an active subscription');
    }

    const now = new Date();
    const subscriptionStart = startDate ? new Date(startDate) : now;
    
    // Calculate billing period
    const { periodStart, periodEnd } = this.calculateBillingPeriod(subscriptionStart, billingCycle);
    
    // Calculate trial period if applicable
    let trialStart: Date | null = null;
    let trialEnd: Date | null = null;
    let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;

    if (startTrial && plan.trialDays && plan.trialDays > 0) {
      trialStart = subscriptionStart;
      trialEnd = new Date(subscriptionStart);
      trialEnd.setDate(trialEnd.getDate() + plan.trialDays);
      status = SubscriptionStatus.TRIAL;
    }

    // Create Stripe subscription if Stripe integration is enabled
    let stripeSubscriptionId: string | undefined;
    let stripeCustomerIdToUse = stripeCustomerId;

    if (this.stripeService.getServiceStatus().enabled) {
      try {
        // Create or get Stripe customer
        if (!stripeCustomerIdToUse) {
          const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
          });
          
          const stripeCustomer = await this.stripeService.createCustomer({
            email: school.email || `${school.name.toLowerCase().replace(/\s+/g, '')}@${tenant?.subdomain}.com`,
            name: school.name,
            metadata: {
              tenantId,
              schoolId,
            },
          });
          stripeCustomerIdToUse = stripeCustomer.id;
        }

        // Create Stripe subscription
        const stripeSubscription = await this.stripeService.createSubscription({
          customerId: stripeCustomerIdToUse,
          priceId: plan.stripePriceId!,
          trialPeriodDays: startTrial ? plan.trialDays : undefined,
          metadata: {
            tenantId,
            schoolId,
            planId,
          },
        });

        stripeSubscriptionId = stripeSubscription.id;
      } catch (error) {
        console.error('Failed to create Stripe subscription:', error);
        // Continue with local subscription creation even if Stripe fails
      }
    }

    // Create subscription in database
    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId,
        schoolId,
        planId,
        status,
        billingCycle,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialStart,
        trialEnd,
        stripeSubscriptionId,
        stripeCustomerId: stripeCustomerIdToUse,
        metadata: metadata || {},
      },
      include: {
        plan: true,
        school: true,
      },
    });

    return this.formatSubscriptionResponse(subscription);
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    tenantId: string,
    subscriptionId: string,
    updateSubscriptionDto: UpdateSubscriptionDto,
  ): Promise<SubscriptionUpdateResponseDto> {
    const subscription = await this.findSubscriptionByIdAndTenant(subscriptionId, tenantId);
    
    const updateData: Prisma.SubscriptionUpdateInput = {};
    let proration: any = null;
    let nextInvoice: any = null;

    // Handle plan change
    if (updateSubscriptionDto.planId && updateSubscriptionDto.planId !== subscription.planId) {
      const newPlan = await this.prisma.billingPlan.findFirst({
        where: { id: updateSubscriptionDto.planId, isActive: true },
      });

      if (!newPlan) {
        throw new NotFoundException('New billing plan not found or inactive');
      }

      // Calculate proration
      proration = await this.calculateProration(subscription, newPlan);
      updateData.plan = { connect: { id: updateSubscriptionDto.planId } };

      // Update Stripe subscription if applicable
      if (subscription.stripeSubscriptionId && this.stripeService.getServiceStatus().enabled) {
        try {
          await this.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
            priceId: newPlan.stripePriceId!,
            prorationBehavior: 'create_prorations',
          });
        } catch (error) {
          console.error('Failed to update Stripe subscription:', error);
        }
      }
    }

    // Handle billing cycle change
    if (updateSubscriptionDto.billingCycle && updateSubscriptionDto.billingCycle !== subscription.billingCycle) {
      updateData.billingCycle = updateSubscriptionDto.billingCycle;
      
      // Recalculate billing period
      const { periodStart, periodEnd } = this.calculateBillingPeriod(
        subscription.currentPeriodEnd,
        updateSubscriptionDto.billingCycle,
      );
      updateData.currentPeriodEnd = periodEnd;
    }

    // Handle cancellation flag
    if (updateSubscriptionDto.cancelAtPeriodEnd !== undefined) {
      updateData.cancelAtPeriodEnd = updateSubscriptionDto.cancelAtPeriodEnd;

      if (subscription.stripeSubscriptionId && this.stripeService.getServiceStatus().enabled) {
        try {
          await this.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
            cancelAtPeriodEnd: updateSubscriptionDto.cancelAtPeriodEnd,
          });
        } catch (error) {
          console.error('Failed to update Stripe subscription cancellation:', error);
        }
      }
    }

    // Handle metadata update
    if (updateSubscriptionDto.metadata) {
      updateData.metadata = {
        ...(subscription.metadata as object || {}),
        ...updateSubscriptionDto.metadata,
      };
    }

    // Update subscription
    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
      include: {
        plan: true,
        school: true,
      },
    });

    return {
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        planId: updatedSubscription.planId,
        billingCycle: updatedSubscription.billingCycle,
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        canceledAt: updatedSubscription.canceledAt,
      },
      proration,
      nextInvoice,
    };
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    tenantId: string,
    subscriptionId: string,
    cancelSubscriptionDto: CancelSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.findSubscriptionByIdAndTenant(subscriptionId, tenantId);

    if (subscription.status === SubscriptionStatus.CANCELED) {
      throw new BadRequestException('Subscription is already canceled');
    }

    const { immediately = false, reason, metadata } = cancelSubscriptionDto;
    const now = new Date();

    let updateData: Prisma.SubscriptionUpdateInput = {
      canceledAt: now,
      metadata: {
        ...(subscription.metadata as object || {}),
        cancelReason: reason,
        ...(metadata || {}),
      },
    };

    if (immediately) {
      updateData.status = SubscriptionStatus.CANCELED;
      updateData.currentPeriodEnd = now;
    } else {
      updateData.cancelAtPeriodEnd = true;
    }

    // Cancel Stripe subscription if applicable
    if (subscription.stripeSubscriptionId && this.stripeService.getServiceStatus().enabled) {
      try {
        if (immediately) {
          await this.stripeService.cancelSubscription(subscription.stripeSubscriptionId);
        } else {
          await this.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
            cancelAtPeriodEnd: true,
          });
        }
      } catch (error) {
        console.error('Failed to cancel Stripe subscription:', error);
      }
    }

    const canceledSubscription = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
      include: {
        plan: true,
        school: true,
      },
    });

    return this.formatSubscriptionResponse(canceledSubscription);
  }

  /**
   * Change subscription plan
   */
  async changePlan(
    tenantId: string,
    subscriptionId: string,
    changePlanDto: ChangePlanDto,
  ): Promise<SubscriptionUpdateResponseDto> {
    const { newPlanId, prorate = true, effectiveDate, metadata } = changePlanDto;

    const subscription = await this.findSubscriptionByIdAndTenant(subscriptionId, tenantId);
    
    if (subscription.planId === newPlanId) {
      throw new BadRequestException('Subscription is already on the specified plan');
    }

    const newPlan = await this.prisma.billingPlan.findFirst({
      where: { id: newPlanId, isActive: true },
    });

    if (!newPlan) {
      throw new NotFoundException('New billing plan not found or inactive');
    }

    const changeDate = effectiveDate ? new Date(effectiveDate) : new Date();
    let proration: any = null;

    // Calculate proration if enabled
    if (prorate) {
      proration = await this.calculateProration(subscription, newPlan, changeDate);
    }

    // Update subscription
    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: newPlanId,
        metadata: {
          ...(subscription.metadata as object || {}),
          planChangeDate: changeDate.toISOString(),
          previousPlanId: subscription.planId,
          ...(metadata || {}),
        },
      },
      include: {
        plan: true,
        school: true,
      },
    });

    // Update Stripe subscription if applicable
    if (subscription.stripeSubscriptionId && this.stripeService.getServiceStatus().enabled) {
      try {
        await this.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
          priceId: newPlan.stripePriceId!,
          prorationBehavior: prorate ? 'create_prorations' : 'none',
        });
      } catch (error) {
        console.error('Failed to update Stripe subscription plan:', error);
      }
    }

    return {
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        planId: updatedSubscription.planId,
        billingCycle: updatedSubscription.billingCycle,
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        canceledAt: updatedSubscription.canceledAt,
      },
      proration,
    };
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(tenantId: string, subscriptionId: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.findSubscriptionByIdAndTenant(subscriptionId, tenantId);
    return this.formatSubscriptionResponse(subscription);
  }

  /**
   * Get subscriptions for a tenant
   */
  async getSubscriptions(
    tenantId: string,
    options: {
      schoolId?: string;
      status?: SubscriptionStatus;
      planType?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ subscriptions: SubscriptionResponseDto[]; total: number; page: number; limit: number }> {
    const { schoolId, status, planType, page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.SubscriptionWhereInput = {
      tenantId,
      ...(schoolId && { schoolId }),
      ...(status && { status }),
      ...(planType && { plan: { type: planType as any } }),
    };

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          plan: true,
          school: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      subscriptions: subscriptions.map(sub => this.formatSubscriptionResponse(sub)),
      total,
      page,
      limit,
    };
  }

  /**
   * Process subscription renewals (called by cron job)
   */
  async processRenewals(): Promise<void> {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find subscriptions that need renewal
    const subscriptionsToRenew = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
        currentPeriodEnd: {
          lte: tomorrow,
        },
        cancelAtPeriodEnd: false,
      },
      include: {
        plan: true,
        school: true,
      },
    });

    for (const subscription of subscriptionsToRenew) {
      try {
        await this.renewSubscription(subscription);
      } catch (error) {
        console.error(`Failed to renew subscription ${subscription.id}:`, error);
      }
    }
  }

  /**
   * Process trial expirations (called by cron job)
   */
  async processTrialExpirations(): Promise<void> {
    const now = new Date();

    // Find trial subscriptions that have expired
    const expiredTrials = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.TRIAL,
        trialEnd: {
          lte: now,
        },
      },
      include: {
        plan: true,
        school: true,
      },
    });

    for (const subscription of expiredTrials) {
      try {
        // Convert trial to active subscription or cancel if no payment method
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
          },
        });
      } catch (error) {
        console.error(`Failed to convert trial subscription ${subscription.id}:`, error);
      }
    }
  }

  // Private helper methods

  private async findSubscriptionByIdAndTenant(subscriptionId: string, tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, tenantId },
      include: {
        plan: true,
        school: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  private calculateBillingPeriod(startDate: Date, billingCycle: BillingCycle) {
    const periodStart = startOfDay(startDate);
    let periodEnd: Date;

    switch (billingCycle) {
      case BillingCycle.MONTHLY:
        periodEnd = endOfDay(addMonths(periodStart, 1));
        break;
      case BillingCycle.QUARTERLY:
        periodEnd = endOfDay(addMonths(periodStart, 3));
        break;
      case BillingCycle.YEARLY:
        periodEnd = endOfDay(addYears(periodStart, 1));
        break;
      default:
        throw new BadRequestException('Invalid billing cycle');
    }

    return { periodStart, periodEnd };
  }

  private async calculateProration(
    subscription: Subscription & { plan: BillingPlan },
    newPlan: BillingPlan,
    changeDate: Date = new Date(),
  ) {
    const currentPlan = subscription.plan;
    const remainingDays = Math.ceil(
      (subscription.currentPeriodEnd.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalDays = Math.ceil(
      (subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    const currentPlanPrice = subscription.billingCycle === BillingCycle.YEARLY 
      ? Number(currentPlan.yearlyPrice || Number(currentPlan.monthlyPrice) * 12)
      : Number(currentPlan.monthlyPrice);

    const newPlanPrice = subscription.billingCycle === BillingCycle.YEARLY
      ? Number(newPlan.yearlyPrice || Number(newPlan.monthlyPrice) * 12)
      : Number(newPlan.monthlyPrice);

    const unusedAmount = (currentPlanPrice * remainingDays) / totalDays;
    const newAmount = (newPlanPrice * remainingDays) / totalDays;
    const prorationAmount = newAmount - unusedAmount;

    return {
      amount: Math.round(prorationAmount),
      currency: currentPlan.currency,
      description: `Plan change from ${currentPlan.name} to ${newPlan.name}`,
    };
  }

  private async renewSubscription(subscription: Subscription & { plan: BillingPlan; school: any }) {
    const { periodStart, periodEnd } = this.calculateBillingPeriod(
      subscription.currentPeriodEnd,
      subscription.billingCycle,
    );

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    // Generate invoice for the new period
    // This would typically be handled by the InvoiceService
    console.log(`Renewed subscription ${subscription.id} for period ${periodStart} to ${periodEnd}`);
  }

  private formatSubscriptionResponse(
    subscription: Subscription & { plan: BillingPlan; school?: any },
  ): SubscriptionResponseDto {
    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        type: subscription.plan.type,
        monthlyPrice: Number(subscription.plan.monthlyPrice),
        yearlyPrice: subscription.plan.yearlyPrice ? Number(subscription.plan.yearlyPrice) : undefined,
      },
      trialEnd: subscription.trialEnd?.toISOString(),
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    };
  }
}
