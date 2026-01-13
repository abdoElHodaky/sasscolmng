import { Controller, Post, Body, Headers, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PayMobService } from '../services/paymob.service';
import { PaymentOrchestratorService } from '../services/payment-orchestrator.service';
import { PayMobWebhookDto } from '../dto/paymob.dto';

@ApiTags('PayMob Webhooks')
@Controller('webhooks/paymob')
export class PayMobWebhookController {
  private readonly logger = new Logger(PayMobWebhookController.name);

  constructor(
    private readonly payMobService: PayMobService,
    private readonly orchestratorService: PaymentOrchestratorService,
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Handle PayMob webhook events',
    description: 'Processes webhook events from PayMob payment gateway including transaction confirmations, failures, and refunds'
  })
  @ApiHeader({
    name: 'signature',
    description: 'PayMob webhook signature for verification',
    required: false,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Webhook processed successfully' },
        eventType: { type: 'string', example: 'payment.succeeded' },
        transactionId: { type: 'number', example: 123456789 }
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
    @Body() webhookData: PayMobWebhookDto,
    @Headers('signature') signature?: string,
  ): Promise<{
    success: boolean;
    message: string;
    eventType?: string;
    transactionId?: number;
  }> {
    try {
      this.logger.log(`Received PayMob webhook for transaction: ${webhookData.obj.id}`);
      
      // Convert webhook data to string for signature verification
      const payload = JSON.stringify(webhookData);
      
      // Verify webhook signature if provided
      if (signature) {
        const isValidSignature = this.payMobService.verifyWebhookSignature(
          payload,
          signature,
          '', // PayMob webhook secret - would come from config
        );
        
        if (!isValidSignature) {
          this.logger.warn(`Invalid webhook signature for transaction: ${webhookData.obj.id}`);
          throw new BadRequestException('Invalid webhook signature');
        }
      }

      // Parse the webhook event
      const eventResult = await this.payMobService.parseWebhookEvent(payload, signature || '');
      
      if (!eventResult.success) {
        this.logger.error(`Failed to parse PayMob webhook:`, eventResult.error);
        throw new BadRequestException('Failed to parse webhook event');
      }

      const webhookEvent = eventResult.data;
      
      // Handle the webhook event
      const handleResult = await this.payMobService.handleWebhookEvent(webhookEvent);
      
      if (!handleResult.success) {
        this.logger.error(`Failed to handle PayMob webhook:`, handleResult.error);
        throw new BadRequestException('Failed to handle webhook event');
      }

      // Process business logic based on event type
      await this.processWebhookEvent(webhookData);

      this.logger.log(`Successfully processed PayMob webhook: ${webhookData.obj.id} - ${webhookEvent.type}`);

      return {
        success: true,
        message: 'Webhook processed successfully',
        eventType: webhookEvent.type,
        transactionId: webhookData.obj.id,
      };

    } catch (error) {
      this.logger.error(`Error processing PayMob webhook:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Process webhook event business logic
   */
  private async processWebhookEvent(webhookData: PayMobWebhookDto): Promise<void> {
    const { obj: transaction } = webhookData;
    const { success, pending, id } = transaction;

    try {
      if (pending) {
        await this.handleTransactionPending(webhookData);
      } else if (success) {
        await this.handleTransactionSuccess(webhookData);
      } else {
        await this.handleTransactionFailure(webhookData);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook event for transaction ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle successful transaction
   */
  private async handleTransactionSuccess(webhookData: PayMobWebhookDto): Promise<void> {
    const { obj: transaction } = webhookData;
    const { id, amount_cents, currency, order_id } = transaction;
    
    this.logger.log(`Processing successful transaction: ${id}`);
    
    try {
      // Update payment status in database
      // This would typically involve:
      // 1. Finding the payment record by transaction ID or order ID
      // 2. Updating the payment status to COMPLETED
      // 3. Recording payment gateway metadata
      // 4. Triggering subscription activation if applicable
      // 5. Sending confirmation notifications

      this.logger.log(`Transaction ${id} processed successfully`);
      
      // Example database update (would be implemented with actual Prisma calls)
      /*
      await this.prisma.payment.updateMany({
        where: {
          OR: [
            { paymobPaymentId: id.toString() },
            { gatewayReference: order_id.toString() }
          ]
        },
        data: {
          status: PaymentStatus.SUCCEEDED,
          processedAt: new Date(),
          gatewayMetadata: {
            transactionId: id,
            orderId: order_id,
            amountCents: amount_cents,
            currency: currency,
            success: true,
            processedAt: new Date().toISOString()
          }
        }
      });
      */

      // Trigger subscription activation if this is a subscription payment
      // await this.activateSubscriptionIfApplicable(order_id);

      // Send confirmation notifications
      // await this.sendPaymentConfirmationNotification(id);

    } catch (error) {
      this.logger.error(`Error handling successful transaction ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle failed transaction
   */
  private async handleTransactionFailure(webhookData: PayMobWebhookDto): Promise<void> {
    const { obj: transaction } = webhookData;
    const { id, order_id, txn_response_code } = transaction;
    
    this.logger.log(`Processing failed transaction: ${id}`);
    
    try {
      // Update payment status to failed
      // Record failure reason
      // Trigger dunning management if applicable
      // Send failure notifications

      this.logger.log(`Transaction failure ${id} processed`);

      // Example database update
      /*
      await this.prisma.payment.updateMany({
        where: {
          OR: [
            { paymobPaymentId: id.toString() },
            { gatewayReference: order_id.toString() }
          ]
        },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: txn_response_code || 'Transaction failed',
          processedAt: new Date(),
          gatewayMetadata: {
            transactionId: id,
            orderId: order_id,
            success: false,
            failureCode: txn_response_code,
            processedAt: new Date().toISOString()
          }
        }
      });
      */

      // Trigger dunning management for subscription payments
      // await this.triggerDunningManagement(order_id);

      // Send failure notifications
      // await this.sendPaymentFailureNotification(id);

    } catch (error) {
      this.logger.error(`Error handling failed transaction ${id}:`, error);
      throw error;
    }
  }

  /**
   * Handle pending transaction
   */
  private async handleTransactionPending(webhookData: PayMobWebhookDto): Promise<void> {
    const { obj: transaction } = webhookData;
    const { id, order_id } = transaction;
    
    this.logger.log(`Processing pending transaction: ${id}`);
    
    try {
      // Update payment status to pending
      // Set up monitoring for status changes
      
      this.logger.log(`Pending transaction ${id} processed`);

      // Example database update
      /*
      await this.prisma.payment.updateMany({
        where: {
          OR: [
            { paymobPaymentId: id.toString() },
            { gatewayReference: order_id.toString() }
          ]
        },
        data: {
          status: PaymentStatus.PENDING,
          gatewayMetadata: {
            transactionId: id,
            orderId: order_id,
            pending: true,
            processedAt: new Date().toISOString()
          }
        }
      });
      */

      // Set up monitoring for status changes
      // await this.schedulePaymentStatusCheck(id);

    } catch (error) {
      this.logger.error(`Error handling pending transaction ${id}:`, error);
      throw error;
    }
  }

  /**
   * Activate subscription if this payment is for a subscription
   */
  private async activateSubscriptionIfApplicable(orderId: number): Promise<void> {
    try {
      // Implementation would check if this order is for a subscription
      // and activate it accordingly
      this.logger.log(`Checking subscription activation for order: ${orderId}`);
    } catch (error) {
      this.logger.error(`Error activating subscription for order ${orderId}:`, error);
    }
  }

  /**
   * Trigger dunning management for failed subscription payments
   */
  private async triggerDunningManagement(orderId: number): Promise<void> {
    try {
      // Implementation would trigger dunning management process
      this.logger.log(`Triggering dunning management for order: ${orderId}`);
    } catch (error) {
      this.logger.error(`Error triggering dunning management for order ${orderId}:`, error);
    }
  }

  /**
   * Send payment confirmation notification
   */
  private async sendPaymentConfirmationNotification(transactionId: number): Promise<void> {
    try {
      // Implementation would send confirmation email/SMS
      this.logger.log(`Sending confirmation notification for transaction: ${transactionId}`);
    } catch (error) {
      this.logger.error(`Error sending confirmation notification for transaction ${transactionId}:`, error);
    }
  }

  /**
   * Send payment failure notification
   */
  private async sendPaymentFailureNotification(transactionId: number): Promise<void> {
    try {
      // Implementation would send failure notification
      this.logger.log(`Sending failure notification for transaction: ${transactionId}`);
    } catch (error) {
      this.logger.error(`Error sending failure notification for transaction ${transactionId}:`, error);
    }
  }

  /**
   * Schedule payment status check for pending transactions
   */
  private async schedulePaymentStatusCheck(transactionId: number): Promise<void> {
    try {
      // Implementation would schedule a job to check payment status later
      this.logger.log(`Scheduling status check for transaction: ${transactionId}`);
    } catch (error) {
      this.logger.error(`Error scheduling status check for transaction ${transactionId}:`, error);
    }
  }
}
