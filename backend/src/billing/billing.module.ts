import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingService } from './services/billing.service';
import { StripeService } from './services/stripe.service';
import { InvoiceService } from './services/invoice.service';
import { SubscriptionService } from './services/subscription.service';
import { BillingController } from './controllers/billing.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
  ],
  controllers: [BillingController],
  providers: [
    BillingService,
    StripeService,
    InvoiceService,
    SubscriptionService,
  ],
  exports: [BillingService, StripeService, InvoiceService, SubscriptionService],
})
export class BillingModule {}
