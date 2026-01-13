# Multi-Payment Gateway Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Docker & Docker Compose (optional)

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/sasscolmng"
REDIS_URL="redis://localhost:6379"

# Payment Gateways
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

PAYTABS_API_KEY="your_paytabs_api_key"
PAYTABS_MERCHANT_EMAIL="merchant@example.com"
PAYTABS_WEBHOOK_SECRET="your_paytabs_webhook_secret"

PAYMOB_API_KEY="your_paymob_api_key"
PAYMOB_PUBLIC_KEY="your_paymob_public_key"
PAYMOB_WEBHOOK_SECRET="your_paymob_webhook_secret"

# Currency Configuration
CURRENCY_PROVIDER="fixer" # fixer|exchangerate|openexchange|manual
CURRENCY_API_KEY="your_currency_api_key"
CURRENCY_CACHE_DURATION=60 # minutes
CURRENCY_CONVERSION_FEE=0.5 # percentage
CURRENCY_MIN_FEE=10 # cents
CURRENCY_MAX_FEE=1000 # cents
```

## Database Setup

### 1. Apply Migration

```bash
# Using Prisma
npx prisma migrate deploy

# Or run SQL directly
psql -d your_database -f backend/src/billing/migrations/add-multi-gateway-support.sql
```

### 2. Verify Schema

```sql
-- Check if PaymentGateway enum exists
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'PaymentGateway'::regtype;

-- Verify new columns
\d "BillingPlan"
\d "Subscription"
\d "Payment"
\d "Tenant"
```

## Application Deployment

### Option 1: Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/sasscolmng
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:13
    environment:
      POSTGRES_DB: sasscolmng
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Option 2: Manual Deployment

```bash
# Install dependencies
npm ci --only=production

# Build application
npm run build

# Run database migrations
npx prisma migrate deploy

# Start application
npm run start:prod
```

## Webhook Configuration

### Stripe Webhooks

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.*`

### PayTabs Webhooks

1. Configure in PayTabs merchant dashboard
2. Webhook URL: `https://your-domain.com/webhooks/paytabs`
3. Enable events: payment success/failure, subscription events

### PayMob Webhooks

1. Configure in PayMob dashboard
2. Webhook URL: `https://your-domain.com/webhooks/paymob`
3. Enable transaction and order events

## Load Balancer Configuration

### Nginx Configuration

```nginx
upstream app_servers {
    server app1:3000;
    server app2:3000;
    server app3:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://app_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook endpoints with raw body
    location /webhooks/ {
        proxy_pass http://app_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Content-Type $content_type;
        proxy_pass_request_headers on;
    }
}
```

## Monitoring Setup

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'payment-gateway-api'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
```

### Grafana Dashboards

Import the provided dashboard JSON files:
- `docs/monitoring/payment-gateway-dashboard.json`
- `docs/monitoring/currency-conversion-dashboard.json`

## Health Checks

### Application Health Check

```bash
# Basic health check
curl https://your-domain.com/health

# Payment gateway health
curl https://your-domain.com/api/v1/billing/gateways/health
```

### Database Health Check

```sql
-- Check gateway performance
SELECT gateway, success_rate, total_transactions 
FROM gateway_performance_metrics;

-- Check recent payments
SELECT payment_gateway, status, COUNT(*) 
FROM "Payment" 
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY payment_gateway, status;
```

## Security Configuration

### SSL/TLS Setup

```bash
# Using Let's Encrypt
certbot --nginx -d your-domain.com
```

### Firewall Rules

```bash
# Allow HTTP/HTTPS
ufw allow 80
ufw allow 443

# Allow SSH (if needed)
ufw allow 22

# Enable firewall
ufw enable
```

## Backup Strategy

### Database Backup

```bash
#!/bin/bash
# backup-db.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_${DATE}.sql
aws s3 cp backup_${DATE}.sql s3://your-backup-bucket/
```

### Application Backup

```bash
#!/bin/bash
# backup-app.sh
tar -czf app_backup_$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  /path/to/app
```

## Troubleshooting

### Common Issues

1. **Gateway Connection Errors**
   ```bash
   # Check gateway health
   curl -X GET "https://your-domain.com/api/v1/billing/gateways/performance"
   ```

2. **Currency Conversion Failures**
   ```bash
   # Check cache status
   curl -X GET "https://your-domain.com/api/v1/billing/currency/cache-stats"
   
   # Clear cache if needed
   curl -X POST "https://your-domain.com/api/v1/billing/currency/clear-cache"
   ```

3. **Webhook Signature Verification**
   ```bash
   # Check webhook logs
   docker logs app_container | grep webhook
   ```

### Log Analysis

```bash
# Payment gateway errors
grep "payment.*error" /var/log/app.log

# Currency conversion issues
grep "currency.*failed" /var/log/app.log

# Webhook processing
grep "webhook.*processed" /var/log/app.log
```

## Performance Optimization

### Database Optimization

```sql
-- Create additional indexes if needed
CREATE INDEX CONCURRENTLY idx_payment_created_at ON "Payment" ("createdAt");
CREATE INDEX CONCURRENTLY idx_subscription_status ON "Subscription" ("status");
```

### Redis Configuration

```redis
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## Scaling Considerations

### Horizontal Scaling

- Deploy multiple application instances
- Use Redis for session storage
- Implement database read replicas
- Use CDN for static assets

### Vertical Scaling

- Monitor CPU and memory usage
- Scale database resources as needed
- Optimize Redis memory allocation

This deployment guide provides the essential steps for deploying the Multi-Payment Gateway System in production environments.
