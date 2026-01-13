import { Controller, Post, Body, Headers, Logger, BadRequestException, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { StripeService } from '../services/stripe.service';
import { PaymentOrchestratorService } from '../services/payment-orchestrator.service';

@ApiTags('Stripe Webhooks')
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly orchestratorService: PaymentOrchestratorService,
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Handle Stripe webhook events',
    description: 'Processes webhook events from Stripe payment gateway including payment confirmations, subscription updates, and invoice events'
  })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature for verification',
    required: true,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Webhook processed successfully' },
        eventType: { type: 'string', example: 'payment_intent.succeeded' },
        eventId: { type: 'string', example: 'evt_1234567890' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid webhook payload or signature verification failed' 
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error while processing webhook' 
  })
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{
    success: boolean;
    message: string;
    eventType?: string;
    eventId?: string;
  }> {
    try {
      // Get raw body for signature verification
      const payload = request.rawBody?.toString() || JSON.stringify(request.body);
      
      this.logger.log(`Received Stripe webhook with signature: ${signature?.substring(0, 20)}...`);
      
      if (!signature) {
        throw new BadRequestException('Missing Stripe signature header');
      }

      // Parse the webhook event using Stripe service
      const eventResult = await this.stripeService.parseWebhookEvent(payload, signature);
      
      if (!eventResult.success) {
        this.logger.error(`Failed to parse Stripe webhook:`, eventResult.error);
        throw new BadRequestException('Failed to parse webhook event');
      }

      const webhookEvent = eventResult.data;
      this.logger.log(`Processing Stripe webhook event: ${webhookEvent.type} (${webhookEvent.id})`);
      
      // Handle the webhook event using Stripe service
      const handleResult = await this.stripeService.handleWebhookEvent(webhookEvent);
      
      if (!handleResult.success) {
        this.logger.error(`Failed to handle Stripe webhook:`, handleResult.error);
        throw new BadRequestException('Failed to handle webhook event');
      }

      // Process business logic based on event type
      await this.processWebhookEvent(webhookEvent);

      this.logger.log(`Successfully processed Stripe webhook: ${webhookEvent.id} - ${webhookEvent.type}`);

      return {
        success: true,
        message: 'Webhook processed successfully',
        eventType: webhookEvent.type,
        eventId: webhookEvent.id,
      };

    } catch (error) {
      this.logger.error(`Error processing Stripe webhook:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Process webhook event business logic
   */
  private async processWebhookEvent(webhookEvent: any): Promise<void> {
    const { type, data } = webhookEvent;

    try {
      switch (type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(data.object);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(data.object);
          break;
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(data.object);
          break;
        case 'customer.subscription.trial_will_end':
          await this.handleSubscriptionTrialWillEnd(data.object);
          break;
        case 'invoice.upcoming':
          await this.handleUpcomingInvoice(data.object);
          break;
        case 'customer.created':
          await this.handleCustomerCreated(data.object);
          break;
        case 'customer.updated':
          await this.handleCustomerUpdated(data.object);
          break;
        case 'customer.deleted':
          await this.handleCustomerDeleted(data.object);
          break;
        default:
          this.logger.log(`Unhandled Stripe webhook event type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook event ${type}:`, error);
      throw error;
    }
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    const { id, amount, currency, customer, metadata } = paymentIntent;
    
    this.logger.log(`Processing successful payment intent: ${id}`);
    
    try {
      // Update payment status in database
      // This would typically involve:
      // 1. Finding the payment record by Stripe payment intent ID
      // 2. Updating the payment status to SUCCEEDED
      // 3. Recording payment completion timestamp
      // 4. Triggering any post-payment workflows
      // 5. Sending confirmation notifications

      this.logger.log(`Payment intent ${id} processed successfully`);
      
      // Example database update (would be implemented with actual Prisma calls)
      /*
      await this.prisma.payment.updateMany({
        where: {
          stripePaymentId: id,
        },
        data: {
          status: PaymentStatus.SUCCEEDED,
          processedAt: new Date(),
          gatewayMetadata: {
            paymentIntentId: id,
            amount,
            currency,
            customerId: customer,
            processedAt: new Date().toISOString()
          }
        }
      });
      */

      // Trigger post-payment workflows
      // await this.triggerPostPaymentWorkflows(id, metadata);

      // Send confirmation notifications
      // await this.sendPaymentConfirmationNotification(id, customer);

    } catch (error) {
      this.logger.error(`Error handling successful payment intent ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    const { id, last_payment_error, customer, metadata } = paymentIntent;
    
    this.logger.log(`Processing failed payment intent: ${id}`);
    
    try {
      // Update payment status to failed
      // Record failure reason
      // Trigger failure notifications

      this.logger.log(`Payment intent failure ${id} processed`);

      // Example database update
      /*
      await this.prisma.payment.updateMany({
        where: {
          stripePaymentId: id,
        },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: last_payment_error?.message || 'Payment failed',
          processedAt: new Date(),
          gatewayMetadata: {
            paymentIntentId: id,
            customerId: customer,
            error: last_payment_error,
            processedAt: new Date().toISOString()
          }
        }
      });
      */

      // Send failure notifications
      // await this.sendPaymentFailureNotification(id, customer);

    } catch (error) {
      this.logger.error(`Error handling failed payment intent ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle canceled payment intent
   */
  private async handlePaymentIntentCanceled(paymentIntent: any): Promise<void> {
    const { id, customer } = paymentIntent;
    
    this.logger.log(`Processing canceled payment intent: ${id}`);
    
    try {
      // Update payment status to canceled
      this.logger.log(`Payment intent cancellation ${id} processed`);

      // Example database update
      /*
      await this.prisma.payment.updateMany({
        where: {
          stripePaymentId: id,
        },
        data: {
          status: PaymentStatus.CANCELED,
          processedAt: new Date(),
        }
      });
      */

    } catch (error) {
      this.logger.error(`Error handling canceled payment intent ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle successful invoice payment
   */
  private async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    const { id, subscription, customer, amount_paid } = invoice;
    
    this.logger.log(`Processing successful invoice payment: ${id}`);
    
    try {
      // Update subscription status
      // Activate subscription features
      // Record payment

      this.logger.log(`Invoice payment ${id} processed successfully`);

      // Example database update
      /*
      await this.prisma.subscription.updateMany({
        where: {
          stripeSubscriptionId: subscription,
        },
        data: {
          status: SubscriptionStatus.ACTIVE,
          lastPaymentAt: new Date(),
          nextBillingDate: new Date(invoice.period_end * 1000),
        }
      });
      */

      // Activate subscription features
      // await this.activateSubscriptionFeatures(subscription);

    } catch (error) {
      this.logger.error(`Error handling successful invoice payment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    const { id, subscription, customer, attempt_count } = invoice;
    
    this.logger.log(`Processing failed invoice payment: ${id}`);
    
    try {
      // Handle failed subscription payment
      // Trigger dunning management
      // Update subscription status if needed

      this.logger.log(`Invoice payment failure ${id} processed`);

      // Example database update
      /*
      await this.prisma.subscription.updateMany({
        where: {
          stripeSubscriptionId: subscription,
        },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          failedPaymentAttempts: attempt_count,
        }
      });
      */

      // Trigger dunning management
      // await this.triggerDunningManagement(subscription, attempt_count);

    } catch (error) {
      this.logger.error(`Error handling failed invoice payment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle subscription created
   */
  private async handleSubscriptionCreated(subscription: any): Promise<void> {
    const { id, customer, status, current_period_start, current_period_end } = subscription;
    
    this.logger.log(`Processing subscription created: ${id}`);
    
    try {
      // Create subscription record in database
      // Set up subscription features
      // Send welcome notifications

      this.logger.log(`Subscription creation ${id} processed`);

    } catch (error) {
      this.logger.error(`Error handling subscription creation ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const { id, status, cancel_at_period_end } = subscription;
    
    this.logger.log(`Processing subscription updated: ${id}`);
    
    try {
      // Update subscription in database
      // Handle status changes
      // Adjust features if needed

      this.logger.log(`Subscription update ${id} processed`);

    } catch (error) {
      this.logger.error(`Error handling subscription update ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const { id, customer } = subscription;
    
    this.logger.log(`Processing subscription deleted: ${id}`);
    
    try {
      // Update subscription status to canceled
      // Deactivate features
      // Send cancellation notifications

      this.logger.log(`Subscription deletion ${id} processed`);

    } catch (error) {
      this.logger.error(`Error handling subscription deletion ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle subscription trial will end
   */
  private async handleSubscriptionTrialWillEnd(subscription: any): Promise<void> {
    const { id, customer, trial_end } = subscription;
    
    this.logger.log(`Processing subscription trial will end: ${id}`);
    
    try {
      // Send trial ending notifications
      // Prepare for billing transition

      this.logger.log(`Subscription trial ending ${id} processed`);

    } catch (error) {
      this.logger.error(`Error handling subscription trial ending ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle upcoming invoice
   */
  private async handleUpcomingInvoice(invoice: any): Promise<void> {
    const { subscription, customer, amount_due } = invoice;
    
    this.logger.log(`Processing upcoming invoice for subscription: ${subscription}`);
    
    try {
      // Send upcoming payment notifications
      // Check payment method validity

      this.logger.log(`Upcoming invoice for subscription ${subscription} processed`);

    } catch (error) {
      this.logger.error(`Error handling upcoming invoice for subscription ${subscription}:`, error);
      throw error;
    }
  }

  /**
   * Handle customer created
   */
  private async handleCustomerCreated(customer: any): Promise<void> {
    const { id, email, name } = customer;
    
    this.logger.log(`Processing customer created: ${id}`);
    
    try {
      // Update customer record if needed
      // Set up customer-specific configurations

      this.logger.log(`Customer creation ${id} processed`);

    } catch (error) {
      this.logger.error(`Error handling customer creation ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle customer updated
   */
  private async handleCustomerUpdated(customer: any): Promise<void> {
    const { id, email, name } = customer;
    
    this.logger.log(`Processing customer updated: ${id}`);
    
    try {
      // Update customer information in database
      // Sync any changes

      this.logger.log(`Customer update ${id} processed`);

    } catch (error) {
      this.logger.error(`Error handling customer update ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle customer deleted
   */
  private async handleCustomerDeleted(customer: any): Promise<void> {
    const { id } = customer;
    
    this.logger.log(`Processing customer deleted: ${id}`);
    
    try {
      // Handle customer deletion
      // Clean up related data if needed

      this.logger.log(`Customer deletion ${id} processed`);

    } catch (error) {
      this.logger.error(`Error handling customer deletion ${id}:`, error);
      throw error;
    }
  }
}
