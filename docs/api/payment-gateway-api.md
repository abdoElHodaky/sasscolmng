# Multi-Payment Gateway API Documentation

## Overview

The Multi-Payment Gateway API provides comprehensive payment processing capabilities with intelligent routing, multi-currency support, and regional tax compliance. This API supports global SaaS expansion with enterprise-grade reliability and security.

## Base URL

```
Production: https://api.sasscolmng.com/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication

All API endpoints require JWT authentication except for webhook endpoints which use signature verification.

```bash
# Include JWT token in Authorization header
Authorization: Bearer <your-jwt-token>
```

## Payment Gateway Orchestration API

### Gateway Management

#### List Available Gateways
```http
GET /billing/gateways
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "gateway": "STRIPE",
      "isEnabled": true,
      "supportedCurrencies": ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"],
      "supportedCountries": ["US", "CA", "GB", "DE", "FR", "AU", "JP"],
      "supportedPaymentMethods": ["card", "apple_pay", "google_pay", "klarna"]
    },
    {
      "gateway": "PAYTABS",
      "isEnabled": true,
      "supportedCurrencies": ["SAR", "AED", "KWD", "QAR", "BHD"],
      "supportedCountries": ["SA", "AE", "KW", "QA", "BH"],
      "supportedPaymentMethods": ["card", "mada", "stcpay", "apple_pay"]
    },
    {
      "gateway": "PAYMOB",
      "isEnabled": true,
      "supportedCurrencies": ["EGP", "USD", "EUR"],
      "supportedCountries": ["EG"],
      "supportedPaymentMethods": ["card", "wallet", "bank_installments"]
    }
  ]
}
```

#### Get Optimal Gateway
```http
GET /billing/gateways/optimal?currency=USD&region=US&amount=10000
```

**Query Parameters:**
- `currency` (required): Currency code (e.g., USD, EUR, SAR)
- `region` (optional): Region code (e.g., US, EU, SA)
- `amount` (optional): Payment amount for optimization

**Response:**
```json
{
  "success": true,
  "data": {
    "gateway": "STRIPE",
    "reasoning": "Best success rate for USD payments in US region",
    "alternatives": ["PAYTABS"],
    "loadBalancing": {
      "primary": "STRIPE",
      "weight": 80,
      "fallback": "PAYTABS",
      "fallbackWeight": 20
    }
  }
}
```

#### Gateway Performance Metrics
```http
GET /billing/gateways/performance
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "gateway": "STRIPE",
      "successRate": 98.5,
      "averageResponseTime": 450,
      "totalTransactions": 15420,
      "failureReasons": {
        "card_declined": 45,
        "insufficient_funds": 23,
        "network_error": 12
      },
      "lastUpdated": "2024-01-13T09:30:00Z"
    }
  ]
}
```

#### Test Gateway Selection
```http
POST /billing/gateways/test-selection
```

**Request Body:**
```json
{
  "amount": 10000,
  "currency": "USD",
  "country": "US",
  "paymentMethod": "card",
  "tenantId": "tenant_123",
  "customerSegment": "VIP"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "selectedGateway": "STRIPE",
    "matchedRule": {
      "id": "rule_vip_customers",
      "name": "VIP Customers",
      "priority": 2
    },
    "alternativeGateways": [],
    "reasoning": [
      "VIP customer segment detected",
      "Stripe selected for premium routing",
      "No fallback configured for VIP tier"
    ]
  }
}
```

### Payment Processing

#### Create Payment Intent
```http
POST /billing/payments/create-intent
```

**Request Body:**
```json
{
  "amount": 10000,
  "currency": "USD",
  "customerId": "cus_123",
  "tenantId": "tenant_123",
  "description": "Subscription payment",
  "metadata": {
    "subscriptionId": "sub_123",
    "planName": "Professional"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pi_1234567890",
    "amount": 10000,
    "currency": "USD",
    "status": "requires_payment_method",
    "clientSecret": "pi_1234567890_secret_xyz",
    "gateway": "STRIPE",
    "metadata": {
      "subscriptionId": "sub_123",
      "planName": "Professional"
    }
  }
}
```

#### Process Payment
```http
POST /billing/payments/process
```

**Request Body:**
```json
{
  "paymentIntentId": "pi_1234567890",
  "paymentMethodId": "pm_1234567890",
  "confirmationMethod": "automatic"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pi_1234567890",
    "status": "succeeded",
    "amount": 10000,
    "currency": "USD",
    "gateway": "STRIPE",
    "transactionId": "txn_1234567890",
    "processedAt": "2024-01-13T09:30:00Z"
  }
}
```

#### Process Refund
```http
POST /billing/payments/refund
```

**Request Body:**
```json
{
  "paymentId": "pi_1234567890",
  "amount": 5000,
  "reason": "requested_by_customer",
  "metadata": {
    "refundReason": "Customer requested partial refund"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "re_1234567890",
    "amount": 5000,
    "currency": "USD",
    "status": "succeeded",
    "gateway": "STRIPE",
    "originalPaymentId": "pi_1234567890",
    "processedAt": "2024-01-13T09:30:00Z"
  }
}
```

#### Payment History
```http
GET /billing/payments/history?tenantId=tenant_123&limit=50&offset=0
```

**Query Parameters:**
- `tenantId` (optional): Filter by tenant
- `gateway` (optional): Filter by gateway (STRIPE, PAYTABS, PAYMOB)
- `status` (optional): Filter by status (succeeded, failed, pending)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "pi_1234567890",
        "amount": 10000,
        "currency": "USD",
        "status": "succeeded",
        "gateway": "STRIPE",
        "createdAt": "2024-01-13T09:30:00Z",
        "metadata": {
          "subscriptionId": "sub_123"
        }
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

## Multi-Currency API

### Currency Conversion

#### Convert Currency
```http
POST /billing/currency/convert
```

**Request Body:**
```json
{
  "amount": 10000,
  "fromCurrency": "USD",
  "toCurrency": "EUR",
  "tenantId": "tenant_123",
  "useCache": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "originalAmount": 10000,
    "convertedAmount": 8500,
    "fromCurrency": "USD",
    "toCurrency": "EUR",
    "exchangeRate": 0.85,
    "conversionFee": 50,
    "totalAmount": 8550,
    "timestamp": "2024-01-13T09:30:00Z",
    "source": "fixer"
  }
}
```

#### Get Exchange Rate
```http
GET /billing/currency/exchange-rate?from=USD&to=EUR&useCache=true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rate": 0.85,
    "source": "fixer",
    "timestamp": "2024-01-13T09:30:00Z",
    "validUntil": "2024-01-13T10:30:00Z"
  }
}
```

#### Calculate Total Cost
```http
POST /billing/currency/calculate-total-cost
```

**Request Body:**
```json
{
  "amount": 10000,
  "fromCurrency": "USD",
  "toCurrency": "EUR",
  "region": "EU"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "originalAmount": 10000,
    "convertedAmount": 8500,
    "conversionFee": 50,
    "taxAmount": 1710,
    "totalAmount": 10260,
    "breakdown": {
      "baseAmount": 8500,
      "conversionFee": 50,
      "taxAmount": 1710,
      "total": 10260
    },
    "currency": "EUR"
  }
}
```

### Payment with Conversion

#### Create Payment with Conversion
```http
POST /billing/currency/create-payment-with-conversion
```

**Request Body:**
```json
{
  "amount": 10000,
  "currency": "USD",
  "targetCurrency": "EUR",
  "tenantRegion": "EU",
  "customerId": "cus_123",
  "tenantId": "tenant_123",
  "description": "Subscription payment with conversion",
  "metadata": {
    "subscriptionId": "sub_123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pi_1234567890",
    "amount": 10260,
    "currency": "EUR",
    "status": "requires_payment_method",
    "clientSecret": "pi_1234567890_secret_xyz",
    "gateway": "STRIPE",
    "conversionDetails": {
      "originalAmount": 10000,
      "convertedAmount": 8500,
      "exchangeRate": 0.85,
      "conversionFee": 50,
      "taxAmount": 1710,
      "source": "fixer"
    }
  }
}
```

### Currency Information

#### Get Supported Currencies
```http
GET /billing/currency/supported-currencies?gateway=STRIPE
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "code": "USD",
      "name": "US Dollar",
      "symbol": "$",
      "decimalPlaces": 2,
      "isSupported": true,
      "regions": ["US", "Global"],
      "gatewaySupport": {
        "stripe": true,
        "paytabs": true,
        "paymob": true
      }
    },
    {
      "code": "EUR",
      "name": "Euro",
      "symbol": "€",
      "decimalPlaces": 2,
      "isSupported": true,
      "regions": ["EU", "Global"],
      "gatewaySupport": {
        "stripe": true,
        "paytabs": true,
        "paymob": true
      }
    }
  ]
}
```

#### Get Currency Information
```http
GET /billing/currency/currency-info/USD
```

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "USD",
    "name": "US Dollar",
    "symbol": "$",
    "decimalPlaces": 2,
    "isSupported": true,
    "regions": ["US", "Global"],
    "gatewaySupport": {
      "stripe": true,
      "paytabs": true,
      "paymob": true
    }
  }
}
```

#### Get Optimal Gateway for Currency
```http
GET /billing/currency/optimal-gateway?currency=SAR&region=SA&amount=37500
```

**Response:**
```json
{
  "success": true,
  "data": {
    "gateway": "PAYTABS",
    "reasoning": "Regional specialization for MENA currencies and local payment methods",
    "alternatives": ["STRIPE"]
  }
}
```

### Tax Information

#### Get Regional Tax Information
```http
GET /billing/currency/regional-tax-info
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "region": "US",
      "country": "United States",
      "taxRate": 0.0,
      "taxName": "Sales Tax",
      "taxType": "SALES_TAX",
      "isRequired": false
    },
    {
      "region": "EU",
      "country": "European Union",
      "taxRate": 0.20,
      "taxName": "VAT",
      "taxType": "VAT",
      "isRequired": true,
      "exemptionThreshold": 10000
    }
  ]
}
```

#### Calculate Tax
```http
GET /billing/currency/calculate-tax?amount=10000&currency=EUR&region=EU
```

**Response:**
```json
{
  "success": true,
  "data": {
    "taxAmount": 2000,
    "taxRate": 0.20,
    "taxName": "VAT",
    "isRequired": true,
    "exemptionApplied": false
  }
}
```

### Utility Endpoints

#### Format Amount
```http
POST /billing/currency/format-amount
```

**Request Body:**
```json
{
  "amount": 10000,
  "currency": "USD"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "formattedAmount": "$100.00"
  }
}
```

#### Clear Cache
```http
POST /billing/currency/clear-cache
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Currency conversion cache cleared"
  }
}
```

#### Get Cache Statistics
```http
GET /billing/currency/cache-stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "size": 5,
    "entries": [
      {
        "key": "USD/EUR",
        "rate": 0.85,
        "validUntil": "2024-01-13T10:30:00Z",
        "source": "fixer"
      }
    ]
  }
}
```

## Dynamic Tier Customization API

### Feature Management

#### Get Available Features
```http
GET /billing/tiers/features
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "unlimited_users",
      "name": "Unlimited Users",
      "description": "Remove user limits",
      "category": "core",
      "type": "boolean",
      "pricing": {
        "basePrice": 2000,
        "perUnitPrice": 0
      },
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "extra_storage",
      "name": "Extra Storage",
      "description": "Additional storage capacity",
      "category": "core",
      "type": "numeric",
      "pricing": {
        "basePrice": 500,
        "perUnitPrice": 100
      },
      "dependencies": [],
      "conflicts": []
    }
  ]
}
```

#### Get Features by Category
```http
GET /billing/tiers/features?category=premium
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "white_labeling",
      "name": "White Labeling",
      "description": "Custom branding",
      "category": "premium",
      "type": "boolean",
      "pricing": {
        "basePrice": 5000,
        "perUnitPrice": 0
      }
    }
  ]
}
```

### Custom Tier Management

#### Create Custom Tier
```http
POST /billing/tiers/custom
```

**Request Body:**
```json
{
  "tenantId": "tenant_123",
  "name": "Custom Enterprise Plan",
  "description": "Tailored plan for enterprise needs",
  "features": {
    "unlimited_users": true,
    "extra_storage": 100,
    "white_labeling": true,
    "sso_provider": "SAML"
  },
  "validFrom": "2024-01-01T00:00:00Z",
  "validUntil": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tier_custom_123",
    "tenantId": "tenant_123",
    "name": "Custom Enterprise Plan",
    "description": "Tailored plan for enterprise needs",
    "features": {
      "unlimited_users": true,
      "extra_storage": 100,
      "white_labeling": true,
      "sso_provider": "SAML"
    },
    "pricing": {
      "monthly": 15000,
      "yearly": 162000,
      "breakdown": {
        "unlimited_users": 2000,
        "extra_storage": 10500,
        "white_labeling": 5000,
        "sso_provider": 3000
      }
    },
    "limits": {
      "maxUsers": -1,
      "maxStorage": 1100,
      "apiRateLimit": 1000
    },
    "supportedGateways": ["STRIPE", "PAYTABS"],
    "validFrom": "2024-01-01T00:00:00Z",
    "validUntil": "2024-12-31T23:59:59Z",
    "createdAt": "2024-01-13T09:30:00Z"
  }
}
```

#### Get Custom Tier
```http
GET /billing/tiers/custom/tier_custom_123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tier_custom_123",
    "tenantId": "tenant_123",
    "name": "Custom Enterprise Plan",
    "features": {
      "unlimited_users": true,
      "extra_storage": 100
    },
    "pricing": {
      "monthly": 15000,
      "yearly": 162000
    }
  }
}
```

#### Update Custom Tier
```http
PUT /billing/tiers/custom/tier_custom_123
```

**Request Body:**
```json
{
  "name": "Updated Enterprise Plan",
  "features": {
    "unlimited_users": true,
    "extra_storage": 200,
    "premium_integrations": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tier_custom_123",
    "name": "Updated Enterprise Plan",
    "features": {
      "unlimited_users": true,
      "extra_storage": 200,
      "premium_integrations": true
    },
    "pricing": {
      "monthly": 27500,
      "yearly": 297000
    },
    "updatedAt": "2024-01-13T09:30:00Z"
  }
}
```

#### Delete Custom Tier
```http
DELETE /billing/tiers/custom/tier_custom_123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Custom tier deleted successfully"
  }
}
```

### Pricing & Validation

#### Calculate Tier Pricing
```http
POST /billing/tiers/calculate-pricing
```

**Request Body:**
```json
{
  "features": {
    "unlimited_users": true,
    "extra_storage": 50,
    "advanced_analytics": true
  },
  "region": "US"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "monthly": 8700,
    "yearly": 93960,
    "breakdown": {
      "unlimited_users": 2000,
      "extra_storage": 5500,
      "advanced_analytics": 1200
    },
    "regionalAdjustment": 1.0,
    "currency": "USD"
  }
}
```

#### Validate Tier Configuration
```http
POST /billing/tiers/validate-config
```

**Request Body:**
```json
{
  "features": {
    "audit_logs": true,
    "advanced_analytics": false
  }
}
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Feature validation failed",
    "details": {
      "dependencyErrors": [
        {
          "feature": "audit_logs",
          "missingDependency": "advanced_analytics",
          "message": "audit_logs requires advanced_analytics to be enabled"
        }
      ]
    }
  }
}
```

#### Get Tenant Custom Tiers
```http
GET /billing/tiers/tenant/tenant_123
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tier_custom_123",
      "name": "Custom Enterprise Plan",
      "isActive": true,
      "createdAt": "2024-01-13T09:30:00Z"
    }
  ]
}
```

## Webhook API

### Stripe Webhooks
```http
POST /webhooks/stripe
```

**Headers:**
- `Stripe-Signature`: Webhook signature for verification

**Supported Events:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### PayTabs Webhooks
```http
POST /webhooks/paytabs
```

**Headers:**
- `X-PayTabs-Signature`: Webhook signature for verification

**Supported Events:**
- `payment.success`
- `payment.failed`
- `subscription.activated`
- `subscription.cancelled`

### PayMob Webhooks
```http
POST /webhooks/paymob
```

**Headers:**
- `X-PayMob-Signature`: Webhook signature for verification

**Supported Events:**
- `transaction.processed`
- `transaction.failed`
- `order.completed`
- `order.cancelled`

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_FAILED",
    "message": "Payment processing failed",
    "details": {
      "gateway": "STRIPE",
      "gatewayError": "card_declined",
      "retryable": false
    }
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `GATEWAY_NOT_AVAILABLE` | Selected gateway is not available | 503 |
| `CURRENCY_NOT_SUPPORTED` | Currency not supported by gateway | 400 |
| `PAYMENT_FAILED` | Payment processing failed | 400 |
| `CONVERSION_FAILED` | Currency conversion failed | 400 |
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication | 401 |
| `AUTHORIZATION_ERROR` | Insufficient permissions | 403 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Internal server error | 500 |

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Standard endpoints**: 1000 requests per hour per user
- **Payment endpoints**: 100 requests per hour per user
- **Webhook endpoints**: No rate limiting (but signature verification required)

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642089600
```

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @sasscolmng/payment-gateway-sdk
```

```javascript
import { PaymentGatewayClient } from '@sasscolmng/payment-gateway-sdk';

const client = new PaymentGatewayClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.sasscolmng.com/api/v1'
});

// Create payment with conversion
const payment = await client.payments.createWithConversion({
  amount: 10000,
  currency: 'USD',
  targetCurrency: 'EUR',
  customerId: 'cus_123'
});
```

### Python
```bash
pip install sasscolmng-payment-gateway
```

```python
from sasscolmng import PaymentGatewayClient

client = PaymentGatewayClient(
    api_key='your-api-key',
    base_url='https://api.sasscolmng.com/api/v1'
)

# Create payment with conversion
payment = client.payments.create_with_conversion(
    amount=10000,
    currency='USD',
    target_currency='EUR',
    customer_id='cus_123'
)
```

## Testing

### Test Environment
```
Base URL: https://api-test.sasscolmng.com/api/v1
```

### Test Cards

**Stripe Test Cards:**
- Success: `4242424242424242`
- Decline: `4000000000000002`
- Insufficient Funds: `4000000000009995`

**PayTabs Test Cards:**
- Success: `4111111111111111`
- Decline: `4000000000000119`

**PayMob Test Cards:**
- Success: `4987654321098769`
- Decline: `4000000000000127`

### Webhook Testing

Use tools like ngrok to expose your local webhook endpoints:

```bash
# Install ngrok
npm install -g ngrok

# Expose local port
ngrok http 3000

# Use the generated URL for webhook configuration
https://abc123.ngrok.io/webhooks/stripe
```

This comprehensive API documentation covers all aspects of the Multi-Payment Gateway System, providing developers with the information needed to integrate and use the payment processing capabilities effectively.
