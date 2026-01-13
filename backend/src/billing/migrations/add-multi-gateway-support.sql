-- Migration: Add Multi-Gateway Support
-- Description: Extends existing billing models to support multiple payment gateways
-- Date: 2024-01-13
-- Phase: 2 - Database Schema Extensions

-- Create PaymentGateway enum type
CREATE TYPE "PaymentGateway" AS ENUM ('STRIPE', 'PAYTABS', 'PAYMOB');

-- Extend BillingPlan table for multi-gateway support
ALTER TABLE "BillingPlan" 
ADD COLUMN "supportedGateways" "PaymentGateway"[] DEFAULT ARRAY['STRIPE']::"PaymentGateway"[],
ADD COLUMN "gatewaySpecificPricing" JSONB DEFAULT '{}',
ADD COLUMN "regionalPricing" JSONB DEFAULT '{}',
ADD COLUMN "gatewayMetadata" JSONB DEFAULT '{}';

-- Extend Subscription table for multi-gateway support
ALTER TABLE "Subscription" 
ADD COLUMN "paymentGateway" "PaymentGateway" DEFAULT 'STRIPE',
ADD COLUMN "gatewaySubscriptionId" TEXT,
ADD COLUMN "gatewayCustomerId" TEXT,
ADD COLUMN "gatewayMetadata" JSONB DEFAULT '{}',
ADD COLUMN "fallbackGateway" "PaymentGateway",
ADD COLUMN "gatewayMigrationHistory" JSONB DEFAULT '[]';

-- Extend Payment table for multi-gateway support
ALTER TABLE "Payment" 
ADD COLUMN "paymentGateway" "PaymentGateway" DEFAULT 'STRIPE',
ADD COLUMN "gatewayPaymentId" TEXT,
ADD COLUMN "gatewayTransactionId" TEXT,
ADD COLUMN "gatewayMetadata" JSONB DEFAULT '{}',
ADD COLUMN "originalCurrency" TEXT,
ADD COLUMN "originalAmount" INTEGER,
ADD COLUMN "exchangeRate" DECIMAL(10,6),
ADD COLUMN "conversionFee" INTEGER DEFAULT 0,
ADD COLUMN "gatewayFee" INTEGER DEFAULT 0;

-- Extend Tenant table for custom plans support
ALTER TABLE "Tenant" 
ADD COLUMN "customPlans" JSONB DEFAULT '[]',
ADD COLUMN "preferredGateway" "PaymentGateway",
ADD COLUMN "gatewayConfigurations" JSONB DEFAULT '{}',
ADD COLUMN "billingRegion" TEXT DEFAULT 'US',
ADD COLUMN "defaultCurrency" TEXT DEFAULT 'USD';

-- Create indexes for optimal query performance
CREATE INDEX "idx_subscription_gateway" ON "Subscription" ("paymentGateway");
CREATE INDEX "idx_subscription_gateway_id" ON "Subscription" ("gatewaySubscriptionId");
CREATE INDEX "idx_payment_gateway" ON "Payment" ("paymentGateway");
CREATE INDEX "idx_payment_gateway_id" ON "Payment" ("gatewayPaymentId");
CREATE INDEX "idx_tenant_preferred_gateway" ON "Tenant" ("preferredGateway");
CREATE INDEX "idx_billing_plan_gateways" ON "BillingPlan" USING GIN ("supportedGateways");

-- Add foreign key constraints for tenant isolation
ALTER TABLE "Subscription" 
ADD CONSTRAINT "fk_subscription_tenant_gateway" 
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

ALTER TABLE "Payment" 
ADD CONSTRAINT "fk_payment_tenant_gateway" 
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON COLUMN "BillingPlan"."supportedGateways" IS 'Array of payment gateways that support this plan';
COMMENT ON COLUMN "BillingPlan"."gatewaySpecificPricing" IS 'Gateway-specific pricing overrides and configurations';
COMMENT ON COLUMN "BillingPlan"."regionalPricing" IS 'Regional pricing variations by country/currency';
COMMENT ON COLUMN "BillingPlan"."gatewayMetadata" IS 'Gateway-specific metadata and configurations';

COMMENT ON COLUMN "Subscription"."paymentGateway" IS 'Primary payment gateway for this subscription';
COMMENT ON COLUMN "Subscription"."gatewaySubscriptionId" IS 'Gateway-specific subscription identifier';
COMMENT ON COLUMN "Subscription"."gatewayCustomerId" IS 'Gateway-specific customer identifier';
COMMENT ON COLUMN "Subscription"."gatewayMetadata" IS 'Gateway-specific subscription metadata';
COMMENT ON COLUMN "Subscription"."fallbackGateway" IS 'Fallback gateway for failed payments';
COMMENT ON COLUMN "Subscription"."gatewayMigrationHistory" IS 'History of gateway migrations for this subscription';

COMMENT ON COLUMN "Payment"."paymentGateway" IS 'Payment gateway used for this transaction';
COMMENT ON COLUMN "Payment"."gatewayPaymentId" IS 'Gateway-specific payment identifier';
COMMENT ON COLUMN "Payment"."gatewayTransactionId" IS 'Gateway-specific transaction identifier';
COMMENT ON COLUMN "Payment"."gatewayMetadata" IS 'Gateway-specific payment metadata';
COMMENT ON COLUMN "Payment"."originalCurrency" IS 'Original currency before conversion';
COMMENT ON COLUMN "Payment"."originalAmount" IS 'Original amount before conversion (in cents)';
COMMENT ON COLUMN "Payment"."exchangeRate" IS 'Exchange rate used for currency conversion';
COMMENT ON COLUMN "Payment"."conversionFee" IS 'Currency conversion fee (in cents)';
COMMENT ON COLUMN "Payment"."gatewayFee" IS 'Gateway processing fee (in cents)';

COMMENT ON COLUMN "Tenant"."customPlans" IS 'Array of custom billing plans for this tenant';
COMMENT ON COLUMN "Tenant"."preferredGateway" IS 'Preferred payment gateway for this tenant';
COMMENT ON COLUMN "Tenant"."gatewayConfigurations" IS 'Tenant-specific gateway configurations';
COMMENT ON COLUMN "Tenant"."billingRegion" IS 'Billing region for regional pricing and compliance';
COMMENT ON COLUMN "Tenant"."defaultCurrency" IS 'Default currency for this tenant';
