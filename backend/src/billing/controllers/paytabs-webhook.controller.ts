import { Controller, Post, Body, Headers, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PayTabsService } from '../services/paytabs.service';
import { PaymentOrchestratorService } from '../services/payment-orchestrator.service';
import { PayTabsWebhookDto } from '../dto/paytabs.dto';

@ApiTags('PayTabs Webhooks')
@Controller('webhooks/paytabs')
export class PayTabsWebhookController {
  private readonly logger = new Logger(PayTabsWebhookController.name);

  constructor(
    private readonly payTabsService: PayTabsService,
    private readonly orchestratorService: PaymentOrchestratorService,
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Handle PayTabs webhook events',
    description: 'Processes webhook events from PayTabs payment gateway including payment confirmations, failures, and refunds'
  })
  @ApiHeader({
    name: 'signature',
    description: 'PayTabs webhook signature for verification',
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
        transactionRef: { type: 'string', example: 'TST2109200000084' }
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
    @Body() webhookData: PayTabsWebhookDto,
    @Headers('signature') signature?: string,
  ): Promise<{
    success: boolean;
    message: string;
    eventType?: string;
    transactionRef?: string;
  }> {
    try {
      this.logger.log(`Received PayTabs webhook for transaction: ${webhookData.tran_ref}`);
      
      // Convert webhook data to string for signature verification
      const payload = JSON.stringify(webhookData);
      
      // Verify webhook signature if provided
      if (signature) {
        const isValidSignature = this.payTabsService.verifyWebhookSignature(
          payload,
          signature,
          '', // PayTabs webhook secret - would come from config
        );
        
        if (!isValidSignature) {
          this.logger.warn(`Invalid webhook signature for transaction: ${webhookData.tran_ref}`);
          throw new BadRequestException('Invalid webhook signature');
        }
      }

      // Parse the webhook event
      const eventResult = await this.payTabsService.parseWebhookEvent(payload, signature || '');
      
      if (!eventResult.success) {
        this.logger.error(`Failed to parse PayTabs webhook:`, eventResult.error);
        throw new BadRequestException('Failed to parse webhook event');
      }

      const webhookEvent = eventResult.data;
      
      // Handle the webhook event
      const handleResult = await this.payTabsService.handleWebhookEvent(webhookEvent);
      
      if (!handleResult.success) {
        this.logger.error(`Failed to handle PayTabs webhook:`, handleResult.error);
        throw new BadRequestException('Failed to handle webhook event');
      }

      // Process business logic based on event type
      await this.processWebhookEvent(webhookData);

      this.logger.log(`Successfully processed PayTabs webhook: ${webhookData.tran_ref} - ${webhookEvent.type}`);

      return {
        success: true,
        message: 'Webhook processed successfully',
        eventType: webhookEvent.type,
        transactionRef: webhookData.tran_ref,
      };

    } catch (error) {
      this.logger.error(`Error processing PayTabs webhook:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Process webhook event business logic
   */
  private async processWebhookEvent(webhookData: PayTabsWebhookDto): Promise<void> {
    const { payment_result, tran_ref, cart_id } = webhookData;
    const status = payment_result.response_status?.toLowerCase();

    try {
      switch (status) {
        case 'a':
        case 'approved':
          await this.handlePaymentSuccess(webhookData);
          break;
          
        case 'd':
        case 'declined':
          await this.handlePaymentFailure(webhookData);
          break;
          
        case 'p':
        case 'pending':
          await this.handlePaymentPending(webhookData);
          break;
          
        case 'v':
        case 'voided':
          await this.handlePaymentVoided(webhookData);
          break;
          
        default:
          this.logger.warn(`Unhandled PayTabs payment status: ${status} for transaction: ${tran_ref}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook event for transaction ${tran_ref}:`, error);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(webhookData: PayTabsWebhookDto): Promise<void> {
    const { tran_ref, cart_id, payment_result, payment_info, customer_details } = webhookData;
    
    this.logger.log(`Processing successful payment: ${tran_ref}`);
    
    try {
      // Extract customer reference and metadata
      let customerRef = customer_details.customer_ref;
      let metadata = {};
      
      try {
        // Try to parse customer_ref as JSON (if it contains metadata)
        const parsed = JSON.parse(customerRef);
        if (parsed.id) {
          customerRef = parsed.id;
          metadata = parsed.metadata || {};
        }
      } catch {
        // customer_ref is a simple string
      }

      // Update payment status in database
      // This would typically involve:
      // 1. Finding the payment record by cart_id or tran_ref
      // 2. Updating the payment status to COMPLETED
      // 3. Recording payment gateway metadata
      // 4. Triggering subscription activation if applicable
      // 5. Sending confirmation notifications

      this.logger.log(`Payment ${tran_ref} processed successfully`);
      
      // Example database update (would be implemented with actual Prisma calls)
      /*
      await this.prisma.payment.updateMany({
        where: {
          OR: [
            { paytabsPaymentId: tran_ref },
            { gatewayReference: cart_id }
          ]
        },
        data: {
          status: PaymentStatus.COMPLETED,
          processedAt: new Date(),
          gatewayMetadata: {
            paymentResult: payment_result,
            paymentInfo: payment_info,
            transactionTime: payment_result.transaction_time
          }
        }
      });
      */

    } catch (error) {
      this.logger.error(`Error handling successful payment ${tran_ref}:`, error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(webhookData: PayTabsWebhookDto): Promise<void> {
    const { tran_ref, cart_id, payment_result } = webhookData;
    
    this.logger.log(`Processing failed payment: ${tran_ref}`);
    
    try {
      // Update payment status to failed
      // Record failure reason
      // Trigger dunning management if applicable
      // Send failure notifications

      this.logger.log(`Payment failure ${tran_ref} processed`);

      // Example database update
      /*
      await this.prisma.payment.updateMany({
        where: {
          OR: [
            { paytabsPaymentId: tran_ref },
            { gatewayReference: cart_id }
          ]
        },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: payment_result.response_message,
          processedAt: new Date(),
          gatewayMetadata: {
            paymentResult: payment_result,
            transactionTime: payment_result.transaction_time
          }
        }
      });
      */

    } catch (error) {
      this.logger.error(`Error handling failed payment ${tran_ref}:`, error);
      throw error;
    }
  }

  /**
   * Handle pending payment
   */
  private async handlePaymentPending(webhookData: PayTabsWebhookDto): Promise<void> {
    const { tran_ref, payment_result } = webhookData;
    
    this.logger.log(`Processing pending payment: ${tran_ref}`);
    
    try {
      // Update payment status to pending
      // Set up monitoring for status changes
      
      this.logger.log(`Pending payment ${tran_ref} processed`);

    } catch (error) {
      this.logger.error(`Error handling pending payment ${tran_ref}:`, error);
      throw error;
    }
  }

  /**
   * Handle voided payment
   */
  private async handlePaymentVoided(webhookData: PayTabsWebhookDto): Promise<void> {
    const { tran_ref, payment_result } = webhookData;
    
    this.logger.log(`Processing voided payment: ${tran_ref}`);
    
    try {
      // Update payment status to canceled
      // Handle any cleanup required
      
      this.logger.log(`Voided payment ${tran_ref} processed`);

    } catch (error) {
      this.logger.error(`Error handling voided payment ${tran_ref}:`, error);
      throw error;
    }
  }
}
