import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
  Logger,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BillingService, BillingPlan, UsageMetrics } from '../services/billing.service';
import { InvoiceService, Invoice } from '../services/invoice.service';
import { StripeService } from '../services/stripe.service';

// DTOs for request/response
export class CreateSubscriptionDto {
  planId: string;
  paymentMethodId?: string;
  trialDays?: number;
}

export class UpdateSubscriptionDto {
  planId?: string;
  cancelAtPeriodEnd?: boolean;
}

export class ProcessPaymentDto {
  amount: number;
  currency: string;
  paymentMethodId: string;
  description?: string;
}

export class WebhookDto {
  type: string;
  data: any;
}

@ApiTags('Billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private billingService: BillingService,
    private invoiceService: InvoiceService,
    private stripeService: StripeService,
  ) {}

  // ==================== PLANS ====================

  @Get('plans')
  @ApiOperation({ summary: 'Get all available billing plans' })
  @ApiResponse({ status: 200, description: 'List of billing plans' })
  async getPlans(): Promise<{
    success: boolean;
    data: BillingPlan[];
    message: string;
  }> {
    try {
      const plans = await this.billingService.getPlans();
      
      return {
        success: true,
        data: plans,
        message: `Retrieved ${plans.length} billing plans`
      };
    } catch (error) {
      this.logger.error('Failed to get billing plans', error);
      throw new HttpException(
        'Failed to retrieve billing plans',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('plans/:planId')
  @ApiOperation({ summary: 'Get specific billing plan details' })
  @ApiResponse({ status: 200, description: 'Billing plan details' })
  async getPlan(@Param('planId') planId: string): Promise<{
    success: boolean;
    data: BillingPlan;
    message: string;
  }> {
    try {
      const plan = await this.billingService.getPlan(planId);
      
      return {
        success: true,
        data: plan,
        message: `Retrieved plan ${plan.name}`
      };
    } catch (error) {
      this.logger.error(`Failed to get plan ${planId}`, error);
      throw new HttpException(
        error.message || 'Failed to retrieve plan',
        HttpStatus.NOT_FOUND
      );
    }
  }

  // ==================== SUBSCRIPTIONS ====================

  @Post('subscribe')
  @ApiOperation({ summary: 'Create new subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async createSubscription(
    @Request() req: any,
    @Body() createSubscriptionDto: CreateSubscriptionDto
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    try {
      const tenantId = req.user.tenantId;
      const { planId, paymentMethodId, trialDays } = createSubscriptionDto;

      // Check usage limits for the plan
      const limitsCheck = await this.billingService.checkUsageLimits(tenantId, planId);
      if (!limitsCheck.withinLimits) {
        throw new HttpException(
          `Current usage exceeds plan limits: ${limitsCheck.violations.join(', ')}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Get plan details
      const plan = await this.billingService.getPlan(planId);

      // Create Stripe customer if needed
      const customer = await this.stripeService.createCustomer({
        email: req.user.email,
        name: req.user.name,
        metadata: { tenantId, planId }
      });

      // Create Stripe subscription
      const subscription = await this.stripeService.createSubscription({
        customerId: customer.id,
        priceId: plan.stripePriceId || 'price_default',
        trialPeriodDays: trialDays || plan.trialDays,
        metadata: { tenantId, planId }
      });

      this.logger.log(`Created subscription for tenant ${tenantId}, plan ${planId}`);

      return {
        success: true,
        data: {
          subscriptionId: subscription.id,
          customerId: customer.id,
          plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialEnd: trialDays ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null
        },
        message: `Successfully subscribed to ${plan.name} plan`
      };
    } catch (error) {
      this.logger.error('Failed to create subscription', error);
      throw new HttpException(
        error.message || 'Failed to create subscription',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('subscription/:subscriptionId')
  @ApiOperation({ summary: 'Update existing subscription' })
  @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async updateSubscription(
    @Request() req: any,
    @Param('subscriptionId') subscriptionId: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    try {
      const tenantId = req.user.tenantId;
      const { planId, cancelAtPeriodEnd } = updateSubscriptionDto;

      if (planId) {
        // Plan change
        const result = await this.billingService.changePlan(tenantId, planId);
        
        if (!result.success) {
          throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
        }

        return {
          success: true,
          data: {
            newPlan: result.newPlan,
            prorationAmount: result.prorationAmount
          },
          message: result.message
        };
      }

      if (cancelAtPeriodEnd !== undefined) {
        // Subscription cancellation
        const subscription = await this.stripeService.cancelSubscription(
          subscriptionId,
          cancelAtPeriodEnd
        );

        return {
          success: true,
          data: {
            subscriptionId: subscription.id,
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            currentPeriodEnd: subscription.currentPeriodEnd
          },
          message: cancelAtPeriodEnd 
            ? 'Subscription will be cancelled at period end'
            : 'Subscription cancelled immediately'
        };
      }

      throw new HttpException('No valid update parameters provided', HttpStatus.BAD_REQUEST);
    } catch (error) {
      this.logger.error(`Failed to update subscription ${subscriptionId}`, error);
      throw new HttpException(
        error.message || 'Failed to update subscription',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription details' })
  @ApiResponse({ status: 200, description: 'Current subscription details' })
  async getCurrentSubscription(@Request() req: any): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    try {
      const tenantId = req.user.tenantId;
      const summary = await this.billingService.getBillingSummary(tenantId);

      return {
        success: true,
        data: summary,
        message: 'Retrieved current subscription details'
      };
    } catch (error) {
      this.logger.error('Failed to get subscription details', error);
      throw new HttpException(
        'Failed to retrieve subscription details',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ==================== PAYMENTS ====================

  @Post('payment')
  @ApiOperation({ summary: 'Process one-time payment' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully' })
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  async processPayment(
    @Request() req: any,
    @Body() processPaymentDto: ProcessPaymentDto
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    try {
      const { amount, currency, paymentMethodId, description } = processPaymentDto;

      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        description,
        metadata: {
          tenantId: req.user.tenantId,
          userId: req.user.id
        }
      });

      return {
        success: true,
        data: {
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.clientSecret,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        },
        message: 'Payment intent created successfully'
      };
    } catch (error) {
      this.logger.error('Failed to process payment', error);
      throw new HttpException(
        'Failed to process payment',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ==================== INVOICES ====================

  @Get('invoices')
  @ApiOperation({ summary: 'Get invoices for current tenant' })
  @ApiResponse({ status: 200, description: 'List of invoices' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by invoice status' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of invoices to return' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of invoices to skip' })
  async getInvoices(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    try {
      const tenantId = req.user.tenantId;
      const result = await this.invoiceService.getInvoicesForTenant(tenantId, {
        status: status as any,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      });

      return {
        success: true,
        data: result,
        message: `Retrieved ${result.invoices.length} invoices`
      };
    } catch (error) {
      this.logger.error('Failed to get invoices', error);
      throw new HttpException(
        'Failed to retrieve invoices',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('invoices/:invoiceId')
  @ApiOperation({ summary: 'Get specific invoice details' })
  @ApiResponse({ status: 200, description: 'Invoice details' })
  async getInvoice(@Param('invoiceId') invoiceId: string): Promise<{
    success: boolean;
    data: Invoice;
    message: string;
  }> {
    try {
      const invoice = await this.invoiceService.getInvoice(invoiceId);

      return {
        success: true,
        data: invoice,
        message: `Retrieved invoice ${invoice.invoiceNumber}`
      };
    } catch (error) {
      this.logger.error(`Failed to get invoice ${invoiceId}`, error);
      throw new HttpException(
        'Failed to retrieve invoice',
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Get('invoices/:invoiceId/pdf')
  @ApiOperation({ summary: 'Download invoice PDF' })
  @ApiResponse({ status: 200, description: 'Invoice PDF file' })
  async downloadInvoicePDF(
    @Param('invoiceId') invoiceId: string,
    @Res() res: Response
  ): Promise<void> {
    try {
      const { pdfBuffer, filename } = await this.invoiceService.generateInvoicePDF(invoiceId);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      this.logger.error(`Failed to generate PDF for invoice ${invoiceId}`, error);
      throw new HttpException(
        'Failed to generate invoice PDF',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ==================== USAGE & ANALYTICS ====================

  @Get('usage')
  @ApiOperation({ summary: 'Get current usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics' })
  async getUsageStatistics(@Request() req: any): Promise<{
    success: boolean;
    data: UsageMetrics;
    message: string;
  }> {
    try {
      const tenantId = req.user.tenantId;
      const usage = await this.billingService.getUsageMetrics(tenantId);

      return {
        success: true,
        data: usage,
        message: 'Retrieved current usage statistics'
      };
    } catch (error) {
      this.logger.error('Failed to get usage statistics', error);
      throw new HttpException(
        'Failed to retrieve usage statistics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('usage/limits')
  @ApiOperation({ summary: 'Check usage against current plan limits' })
  @ApiResponse({ status: 200, description: 'Usage limits check' })
  async checkUsageLimits(@Request() req: any): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    try {
      const tenantId = req.user.tenantId;
      // For demo, assume professional plan
      const result = await this.billingService.checkUsageLimits(tenantId, 'professional');

      return {
        success: true,
        data: result,
        message: result.withinLimits 
          ? 'Usage is within plan limits'
          : `Usage exceeds limits: ${result.violations.join(', ')}`
      };
    } catch (error) {
      this.logger.error('Failed to check usage limits', error);
      throw new HttpException(
        'Failed to check usage limits',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get billing analytics and statistics' })
  @ApiResponse({ status: 200, description: 'Billing analytics' })
  async getBillingAnalytics(@Request() req: any): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    try {
      const tenantId = req.user.tenantId;
      
      const [summary, invoiceStats, billingHistory] = await Promise.all([
        this.billingService.getBillingSummary(tenantId),
        this.invoiceService.getInvoiceStatistics(tenantId),
        this.billingService.getBillingHistory(tenantId, 12)
      ]);

      return {
        success: true,
        data: {
          summary,
          invoiceStats,
          billingHistory
        },
        message: 'Retrieved billing analytics'
      };
    } catch (error) {
      this.logger.error('Failed to get billing analytics', error);
      throw new HttpException(
        'Failed to retrieve billing analytics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ==================== WEBHOOKS ====================

  @Post('webhooks/stripe')
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleStripeWebhook(@Body() webhookDto: WebhookDto): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // In a real implementation, you would verify the webhook signature
      const { type, data } = webhookDto;

      this.logger.log(`Processing Stripe webhook: ${type}`);

      switch (type) {
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(data.object);
          break;
        default:
          this.logger.log(`Unhandled webhook type: ${type}`);
      }

      return {
        success: true,
        message: `Webhook ${type} processed successfully`
      };
    } catch (error) {
      this.logger.error('Failed to process webhook', error);
      throw new HttpException(
        'Failed to process webhook',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ==================== PRIVATE METHODS ====================

  private async handlePaymentSucceeded(invoice: any): Promise<void> {
    this.logger.log(`Payment succeeded for invoice ${invoice.id}`);
    // Update invoice status, send confirmation email, etc.
  }

  private async handlePaymentFailed(invoice: any): Promise<void> {
    this.logger.log(`Payment failed for invoice ${invoice.id}`);
    // Handle failed payment, send notification, etc.
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    this.logger.log(`Subscription updated: ${subscription.id}`);
    // Update subscription details in database
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    this.logger.log(`Subscription deleted: ${subscription.id}`);
    // Handle subscription cancellation
  }
}
