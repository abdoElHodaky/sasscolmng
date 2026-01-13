import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingService } from './services/billing.service';
import { StripeService } from './services/stripe.service';
import { PayTabsService } from './services/paytabs.service';
import { PayMobService } from './services/paymob.service';
import { PaymentOrchestratorService } from './services/payment-orchestrator.service';
import { TierCustomizationService } from './services/tier-customization.service';
import { CurrencyConversionService } from './services/currency-conversion.service';
import { InvoiceService } from './services/invoice.service';
import { SubscriptionService } from './services/subscription.service';
import { BillingController } from './controllers/billing.controller';
import { StripeWebhookController } from './controllers/stripe-webhook.controller';
import { PayTabsWebhookController } from './controllers/paytabs-webhook.controller';
import { PayMobWebhookController } from './controllers/paymob-webhook.controller';
import { CurrencyController } from './controllers/currency.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
  ],
  controllers: [
    BillingController,
    StripeWebhookController,
    PayTabsWebhookController,
    PayMobWebhookController,
    CurrencyController,
  ],
  providers: [
    BillingService,
    StripeService,
    PayTabsService,
    PayMobService,
    PaymentOrchestratorService,
    TierCustomizationService,
    CurrencyConversionService,
    InvoiceService,
    SubscriptionService,
  ],
  exports: [
    BillingService,
    StripeService,
    PayTabsService,
    PayMobService,
    PaymentOrchestratorService,
    TierCustomizationService,
    CurrencyConversionService,
    InvoiceService,
    SubscriptionService,
  ],
})
export class BillingModule {}
