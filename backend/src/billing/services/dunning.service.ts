import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface DunningRule {
  id: string;
  name: string;
  triggerDays: number; // Days after failed payment
  action: 'EMAIL' | 'SMS' | 'SUSPEND' | 'CANCEL';
  templateId?: string;
  isActive: boolean;
}

export interface DunningCampaign {
  id: string;
  subscriptionId: string;
  customerId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  currentStep: number;
  totalSteps: number;
  nextActionDate: Date;
  createdAt: Date;
  completedAt?: Date;
}

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  // Default dunning rules
  private readonly defaultRules: Omit<DunningRule, 'id'>[] = [
    {
      name: 'First Reminder',
      triggerDays: 1,
      action: 'EMAIL',
      isActive: true,
    },
    {
      name: 'Second Reminder',
      triggerDays: 3,
      action: 'EMAIL',
      isActive: true,
    },
    {
      name: 'Final Notice',
      triggerDays: 7,
      action: 'EMAIL',
      isActive: true,
    },
    {
      name: 'Service Suspension',
      triggerDays: 14,
      action: 'SUSPEND',
      isActive: true,
    },
    {
      name: 'Subscription Cancellation',
      triggerDays: 30,
      action: 'CANCEL',
      isActive: true,
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Initialize dunning rules for a tenant
   */
  async initializeDunningRules(tenantId: string): Promise<DunningRule[]> {
    const existingRules = await this.getDunningRules(tenantId);
    
    if (existingRules.length === 0) {
      const rules: DunningRule[] = [];
      
      for (const rule of this.defaultRules) {
        const newRule: DunningRule = {
          id: `dunning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...rule,
        };
        rules.push(newRule);
      }

      // Store rules in cache/database
      await this.storeDunningRules(tenantId, rules);
      return rules;
    }

    return existingRules;
  }

  /**
   * Start dunning process for a failed payment
   */
  async startDunningProcess(
    tenantId: string,
    subscriptionId: string,
    customerId: string,
    failedPaymentId: string,
  ): Promise<DunningCampaign> {
    const rules = await this.getDunningRules(tenantId);
    const activeRules = rules.filter(r => r.isActive).sort((a, b) => a.triggerDays - b.triggerDays);

    if (activeRules.length === 0) {
      throw new Error('No active dunning rules configured');
    }

    const campaign: DunningCampaign = {
      id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      subscriptionId,
      customerId,
      status: 'ACTIVE',
      currentStep: 0,
      totalSteps: activeRules.length,
      nextActionDate: new Date(Date.now() + activeRules[0].triggerDays * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    await this.storeDunningCampaign(tenantId, campaign);

    this.logger.log(`Started dunning campaign ${campaign.id} for subscription ${subscriptionId}`);

    return campaign;
  }

  /**
   * Process dunning campaigns (called by cron job)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processDunningCampaigns(): Promise<void> {
    this.logger.log('Processing dunning campaigns...');

    try {
      // Get all active campaigns that are due for action
      const dueCampaigns = await this.getDueCampaigns();

      for (const campaign of dueCampaigns) {
        await this.executeDunningAction(campaign);
      }

      this.logger.log(`Processed ${dueCampaigns.length} dunning campaigns`);
    } catch (error) {
      this.logger.error('Error processing dunning campaigns:', error);
    }
  }

  /**
   * Execute a dunning action for a campaign
   */
  private async executeDunningAction(campaign: DunningCampaign): Promise<void> {
    try {
      const tenantId = await this.getTenantIdForCampaign(campaign.id);
      const rules = await this.getDunningRules(tenantId);
      const activeRules = rules.filter(r => r.isActive).sort((a, b) => a.triggerDays - b.triggerDays);
      
      if (campaign.currentStep >= activeRules.length) {
        await this.completeCampaign(campaign.id);
        return;
      }

      const currentRule = activeRules[campaign.currentStep];
      
      switch (currentRule.action) {
        case 'EMAIL':
          await this.sendDunningEmail(campaign, currentRule);
          break;
        case 'SMS':
          await this.sendDunningSMS(campaign, currentRule);
          break;
        case 'SUSPEND':
          await this.suspendSubscription(campaign);
          break;
        case 'CANCEL':
          await this.cancelSubscription(campaign);
          break;
      }

      // Move to next step
      campaign.currentStep++;
      
      if (campaign.currentStep < activeRules.length) {
        const nextRule = activeRules[campaign.currentStep];
        campaign.nextActionDate = new Date(
          Date.now() + nextRule.triggerDays * 24 * 60 * 60 * 1000
        );
        await this.updateDunningCampaign(campaign);
      } else {
        await this.completeCampaign(campaign.id);
      }

      this.logger.log(`Executed dunning action ${currentRule.action} for campaign ${campaign.id}`);

    } catch (error) {
      this.logger.error(`Error executing dunning action for campaign ${campaign.id}:`, error);
    }
  }

  /**
   * Send dunning email
   */
  private async sendDunningEmail(campaign: DunningCampaign, rule: DunningRule): Promise<void> {
    const subscription = await this.getSubscriptionDetails(campaign.subscriptionId);
    const customer = await this.getCustomerDetails(campaign.customerId);

    const templateData = {
      customerName: customer.name,
      subscriptionPlan: subscription.plan.name,
      amount: subscription.amount,
      daysOverdue: Math.floor((Date.now() - subscription.lastPaymentAttempt.getTime()) / (1000 * 60 * 60 * 24)),
      paymentUrl: `${process.env.FRONTEND_URL}/billing/payment/${subscription.id}`,
    };

    await this.notificationService.sendNotification({
      tenantId: subscription.tenantId,
      userId: customer.userId,
      channel: 'email',
      type: 'BILLING_REMINDER',
      title: this.getDunningEmailSubject(rule.name),
      message: this.getDunningEmailContent(rule.name, templateData),
      templateId: rule.templateId,
      metadata: {
        dunningCampaignId: campaign.id,
        dunningStep: campaign.currentStep + 1,
        subscriptionId: campaign.subscriptionId,
      },
    });
  }

  /**
   * Send dunning SMS
   */
  private async sendDunningSMS(campaign: DunningCampaign, rule: DunningRule): Promise<void> {
    const subscription = await this.getSubscriptionDetails(campaign.subscriptionId);
    const customer = await this.getCustomerDetails(campaign.customerId);

    const message = `Payment reminder: Your ${subscription.plan.name} subscription payment of $${subscription.amount} is overdue. Please update your payment method to avoid service interruption.`;

    await this.notificationService.sendNotification({
      tenantId: subscription.tenantId,
      userId: customer.userId,
      channel: 'sms',
      type: 'BILLING_REMINDER',
      title: 'Payment Reminder',
      message,
      metadata: {
        dunningCampaignId: campaign.id,
        dunningStep: campaign.currentStep + 1,
      },
    });
  }

  /**
   * Suspend subscription
   */
  private async suspendSubscription(campaign: DunningCampaign): Promise<void> {
    await this.prisma.subscription.update({
      where: { id: campaign.subscriptionId },
      data: { 
        status: 'SUSPENDED',
        suspendedAt: new Date(),
      },
    });

    // Send suspension notification
    const subscription = await this.getSubscriptionDetails(campaign.subscriptionId);
    const customer = await this.getCustomerDetails(campaign.customerId);

    await this.notificationService.sendNotification({
      tenantId: subscription.tenantId,
      userId: customer.userId,
      channel: 'email',
      type: 'SUBSCRIPTION_SUSPENDED',
      title: 'Service Suspended - Payment Required',
      message: `Your ${subscription.plan.name} subscription has been suspended due to non-payment. Please update your payment method to restore service.`,
      metadata: {
        dunningCampaignId: campaign.id,
        subscriptionId: campaign.subscriptionId,
      },
    });

    this.logger.log(`Suspended subscription ${campaign.subscriptionId}`);
  }

  /**
   * Cancel subscription
   */
  private async cancelSubscription(campaign: DunningCampaign): Promise<void> {
    await this.prisma.subscription.update({
      where: { id: campaign.subscriptionId },
      data: { 
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'NON_PAYMENT',
      },
    });

    // Send cancellation notification
    const subscription = await this.getSubscriptionDetails(campaign.subscriptionId);
    const customer = await this.getCustomerDetails(campaign.customerId);

    await this.notificationService.sendNotification({
      tenantId: subscription.tenantId,
      userId: customer.userId,
      channel: 'email',
      type: 'SUBSCRIPTION_CANCELLED',
      title: 'Subscription Cancelled',
      message: `Your ${subscription.plan.name} subscription has been cancelled due to non-payment. You can reactivate your subscription at any time.`,
      metadata: {
        dunningCampaignId: campaign.id,
        subscriptionId: campaign.subscriptionId,
      },
    });

    this.logger.log(`Cancelled subscription ${campaign.subscriptionId}`);
  }

  /**
   * Stop dunning process (when payment is successful)
   */
  async stopDunningProcess(subscriptionId: string): Promise<void> {
    const campaigns = await this.getActiveCampaignsForSubscription(subscriptionId);
    
    for (const campaign of campaigns) {
      campaign.status = 'COMPLETED';
      campaign.completedAt = new Date();
      await this.updateDunningCampaign(campaign);
    }

    this.logger.log(`Stopped dunning process for subscription ${subscriptionId}`);
  }

  /**
   * Get dunning statistics for a tenant
   */
  async getDunningStatistics(tenantId: string): Promise<{
    activeCampaigns: number;
    completedCampaigns: number;
    suspendedSubscriptions: number;
    cancelledSubscriptions: number;
    recoveredRevenue: number;
    averageRecoveryTime: number;
  }> {
    // This would query actual data from your database
    // For now, returning mock data
    return {
      activeCampaigns: Math.floor(Math.random() * 20),
      completedCampaigns: Math.floor(Math.random() * 100),
      suspendedSubscriptions: Math.floor(Math.random() * 10),
      cancelledSubscriptions: Math.floor(Math.random() * 15),
      recoveredRevenue: Math.floor(Math.random() * 10000),
      averageRecoveryTime: Math.floor(Math.random() * 7) + 1, // days
    };
  }

  // Helper methods
  private async getDunningRules(tenantId: string): Promise<DunningRule[]> {
    // Implementation would fetch from database/cache
    return this.defaultRules.map((rule, index) => ({
      id: `rule_${index}`,
      ...rule,
    }));
  }

  private async storeDunningRules(tenantId: string, rules: DunningRule[]): Promise<void> {
    // Implementation would store in database/cache
    this.logger.debug(`Stored ${rules.length} dunning rules for tenant ${tenantId}`);
  }

  private async storeDunningCampaign(tenantId: string, campaign: DunningCampaign): Promise<void> {
    // Implementation would store in database
    this.logger.debug(`Stored dunning campaign ${campaign.id} for tenant ${tenantId}`);
  }

  private async getDueCampaigns(): Promise<DunningCampaign[]> {
    // Implementation would query database for due campaigns
    return [];
  }

  private async getTenantIdForCampaign(campaignId: string): Promise<string> {
    // Implementation would fetch tenant ID from database
    return 'mock_tenant_id';
  }

  private async completeCampaign(campaignId: string): Promise<void> {
    // Implementation would update campaign status
    this.logger.debug(`Completed dunning campaign ${campaignId}`);
  }

  private async updateDunningCampaign(campaign: DunningCampaign): Promise<void> {
    // Implementation would update campaign in database
    this.logger.debug(`Updated dunning campaign ${campaign.id}`);
  }

  private async getSubscriptionDetails(subscriptionId: string): Promise<any> {
    return this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });
  }

  private async getCustomerDetails(customerId: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { id: customerId },
    });
  }

  private async getActiveCampaignsForSubscription(subscriptionId: string): Promise<DunningCampaign[]> {
    // Implementation would query database
    return [];
  }

  private getDunningEmailSubject(ruleName: string): string {
    const subjects = {
      'First Reminder': 'Payment Reminder - Action Required',
      'Second Reminder': 'Urgent: Payment Overdue',
      'Final Notice': 'Final Notice - Service Suspension Pending',
    };
    return subjects[ruleName] || 'Payment Reminder';
  }

  private getDunningEmailContent(ruleName: string, data: any): string {
    const templates = {
      'First Reminder': `Hi ${data.customerName}, your payment for ${data.subscriptionPlan} ($${data.amount}) is ${data.daysOverdue} day(s) overdue. Please update your payment method.`,
      'Second Reminder': `Hi ${data.customerName}, your payment is still overdue. Please pay immediately to avoid service interruption.`,
      'Final Notice': `Hi ${data.customerName}, this is your final notice. Your service will be suspended if payment is not received within 24 hours.`,
    };
    return templates[ruleName] || 'Please update your payment method.';
  }
}

