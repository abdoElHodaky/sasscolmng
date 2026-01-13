-- Migration: Add Multi-Gateway Support and Dynamic Tier Customization
-- This migration adds support for multiple payment gateways (PayTabs, PayMob) 
-- and enables dynamic tier customization capabilities

-- Add PaymentGateway enum
CREATE TYPE "PaymentGateway" AS ENUM ('STRIPE', 'PAYTABS', 'PAYMOB');

-- Extend BillingPlan table for multi-gateway and custom tier support
ALTER TABLE "billing_plans" 
ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "tenantId" TEXT,
ADD COLUMN "paytabsPlanId" TEXT,
ADD COLUMN "paymobPlanId" TEXT,
ADD COLUMN "supportedGateways" "PaymentGateway"[] DEFAULT ARRAY['STRIPE']::"PaymentGateway"[],
ADD COLUMN "regionalPricing" JSONB;

-- Add foreign key constraint for tenant-specific custom plans
ALTER TABLE "billing_plans" 
ADD CONSTRAINT "billing_plans_tenantId_fkey" 
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes for new BillingPlan fields
CREATE INDEX "billing_plans_isCustom_idx" ON "billing_plans"("isCustom");
CREATE INDEX "billing_plans_tenantId_idx" ON "billing_plans"("tenantId");
CREATE INDEX "billing_plans_currency_idx" ON "billing_plans"("currency");

-- Extend Subscription table for multi-gateway support
ALTER TABLE "subscriptions" 
ADD COLUMN "paymentGateway" "PaymentGateway" NOT NULL DEFAULT 'STRIPE',
ADD COLUMN "paytabsSubscriptionId" TEXT,
ADD COLUMN "paytabsCustomerId" TEXT,
ADD COLUMN "paymobSubscriptionId" TEXT,
ADD COLUMN "paymobCustomerId" TEXT,
ADD COLUMN "gatewayMetadata" JSONB;

-- Extend Payment table for multi-gateway support
ALTER TABLE "payments" 
ADD COLUMN "paymentGateway" "PaymentGateway" NOT NULL DEFAULT 'STRIPE',
ADD COLUMN "paytabsPaymentId" TEXT,
ADD COLUMN "paymobPaymentId" TEXT,
ADD COLUMN "gatewayReference" TEXT,
ADD COLUMN "gatewayMetadata" JSONB;

-- Add indexes for new Payment fields
CREATE INDEX "payments_paymentGateway_idx" ON "payments"("paymentGateway");
CREATE INDEX "payments_gatewayReference_idx" ON "payments"("gatewayReference");

-- Update existing records to use STRIPE as default gateway
UPDATE "subscriptions" SET "paymentGateway" = 'STRIPE' WHERE "paymentGateway" IS NULL;
UPDATE "payments" SET "paymentGateway" = 'STRIPE' WHERE "paymentGateway" IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN "billing_plans"."isCustom" IS 'Flag indicating if this is a dynamically created custom plan';
COMMENT ON COLUMN "billing_plans"."tenantId" IS 'Tenant ID for tenant-specific custom plans';
COMMENT ON COLUMN "billing_plans"."paytabsPlanId" IS 'PayTabs-specific plan identifier';
COMMENT ON COLUMN "billing_plans"."paymobPlanId" IS 'PayMob-specific plan identifier';
COMMENT ON COLUMN "billing_plans"."supportedGateways" IS 'Array of payment gateways that support this plan';
COMMENT ON COLUMN "billing_plans"."regionalPricing" IS 'JSON object containing regional pricing variations';

COMMENT ON COLUMN "subscriptions"."paymentGateway" IS 'Primary payment gateway used for this subscription';
COMMENT ON COLUMN "subscriptions"."paytabsSubscriptionId" IS 'PayTabs subscription identifier';
COMMENT ON COLUMN "subscriptions"."paytabsCustomerId" IS 'PayTabs customer identifier';
COMMENT ON COLUMN "subscriptions"."paymobSubscriptionId" IS 'PayMob subscription identifier';
COMMENT ON COLUMN "subscriptions"."paymobCustomerId" IS 'PayMob customer identifier';
COMMENT ON COLUMN "subscriptions"."gatewayMetadata" IS 'Gateway-specific metadata and configuration';

COMMENT ON COLUMN "payments"."paymentGateway" IS 'Payment gateway used to process this payment';
COMMENT ON COLUMN "payments"."paytabsPaymentId" IS 'PayTabs payment identifier';
COMMENT ON COLUMN "payments"."paymobPaymentId" IS 'PayMob payment identifier';
COMMENT ON COLUMN "payments"."gatewayReference" IS 'Universal gateway reference for cross-gateway operations';
COMMENT ON COLUMN "payments"."gatewayMetadata" IS 'Gateway-specific payment metadata';
