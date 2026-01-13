# Multi-Payment Gateway System Architecture

## System Overview

The Multi-Payment Gateway System is designed for global SaaS expansion with intelligent routing, multi-currency support, and regional tax compliance.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web Dashboard]
        API[API Clients]
        MOB[Mobile Apps]
    end

    subgraph "API Gateway Layer"
        NGINX[Nginx Load Balancer]
        AUTH[JWT Authentication]
        RATE[Rate Limiting]
    end

    subgraph "Payment Orchestration Layer"
        PO[Payment Orchestrator]
        GR[Gateway Router]
        CC[Currency Converter]
        TC[Tax Calculator]
        PM[Performance Monitor]
    end

    subgraph "Payment Gateway Integrations"
        STRIPE[Stripe Service<br/>Global Coverage<br/>195+ Countries]
        PAYTABS[PayTabs Service<br/>MENA Region<br/>SA, AE, KW, QA, BH]
        PAYMOB[PayMob Service<br/>Egypt & MENA<br/>EGP, Local Methods]
    end

    subgraph "External Services"
        STRIPE_API[Stripe API]
        PAYTABS_API[PayTabs API]
        PAYMOB_API[PayMob API]
        FIXER[Fixer.io Exchange Rates]
        EXCHANGE[ExchangeRate-API]
    end

    subgraph "Data Layer"
        POSTGRES[(PostgreSQL<br/>Multi-Gateway Schema)]
        REDIS[(Redis<br/>Caching & Sessions)]
    end

    subgraph "Monitoring & Logging"
        PROM[Prometheus Metrics]
        GRAF[Grafana Dashboards]
        LOGS[Centralized Logging]
    end

    WEB --> NGINX
    API --> NGINX
    MOB --> NGINX

    NGINX --> AUTH
    AUTH --> RATE
    RATE --> PO

    PO --> GR
    PO --> CC
    PO --> TC
    PO --> PM

    GR --> STRIPE
    GR --> PAYTABS
    GR --> PAYMOB

    STRIPE --> STRIPE_API
    PAYTABS --> PAYTABS_API
    PAYMOB --> PAYMOB_API

    CC --> FIXER
    CC --> EXCHANGE

    PO --> POSTGRES
    PO --> REDIS

    PM --> PROM
    PROM --> GRAF
    PO --> LOGS

    classDef gateway fill:#e1f5fe
    classDef service fill:#f3e5f5
    classDef data fill:#e8f5e8
    classDef external fill:#fff3e0

    class STRIPE,PAYTABS,PAYMOB gateway
    class PO,GR,CC,TC,PM service
    class POSTGRES,REDIS data
    class STRIPE_API,PAYTABS_API,PAYMOB_API,FIXER,EXCHANGE external
```

## Payment Flow Architecture

```mermaid
sequenceDiagram
    participant Client
    participant Orchestrator
    participant Router
    participant Converter
    participant TaxCalc
    participant Gateway
    participant External

    Client->>Orchestrator: Create Payment Request
    Orchestrator->>Router: Select Optimal Gateway
    Router->>Router: Apply Routing Rules
    Router->>Orchestrator: Return Selected Gateway

    alt Currency Conversion Needed
        Orchestrator->>Converter: Convert Currency
        Converter->>External: Get Exchange Rate
        External-->>Converter: Return Rate
        Converter-->>Orchestrator: Return Converted Amount
    end

    alt Tax Calculation Required
        Orchestrator->>TaxCalc: Calculate Regional Tax
        TaxCalc-->>Orchestrator: Return Tax Amount
    end

    Orchestrator->>Gateway: Create Payment Intent
    Gateway->>External: API Call
    External-->>Gateway: Payment Response
    Gateway-->>Orchestrator: Gateway Response
    Orchestrator-->>Client: Final Response

    Note over Orchestrator: Log Payment Attempt
    Note over Orchestrator: Update Performance Metrics
```

## Gateway Routing Decision Tree

```mermaid
flowchart TD
    START([Payment Request]) --> AMOUNT{Amount >= $10,000?}
    
    AMOUNT -->|Yes| HIGH_VALUE[High-Value Rule<br/>Stripe Only<br/>Manual Approval]
    AMOUNT -->|No| CURRENCY{Currency Type?}
    
    CURRENCY -->|USD/EUR/GBP/CAD/AUD| GLOBAL[Global Currency<br/>Stripe Primary<br/>80/20 Load Balance]
    CURRENCY -->|SAR/AED/KWD/QAR/BHD| MENA[MENA Currency<br/>PayTabs Primary<br/>Time Restricted]
    CURRENCY -->|EGP| EGYPT[Egypt Currency<br/>PayMob Primary<br/>90/10 Load Balance]
    
    GLOBAL --> TIME_CHECK{Within Business Hours?}
    MENA --> MENA_TIME{6AM-11PM Riyadh?}
    EGYPT --> EGYPT_TIME{8AM-10PM Cairo?}
    
    TIME_CHECK -->|Yes| TIER{Customer Tier?}
    TIME_CHECK -->|No| FALLBACK[Use Fallback Gateway]
    
    MENA_TIME -->|Yes| PAYTABS[PayTabs Gateway]
    MENA_TIME -->|No| FALLBACK
    
    EGYPT_TIME -->|Yes| PAYMOB[PayMob Gateway]
    EGYPT_TIME -->|No| FALLBACK
    
    TIER -->|Enterprise| ENTERPRISE[Enterprise Routing<br/>Stripe + PayTabs Fallback]
    TIER -->|VIP| VIP[VIP Routing<br/>Stripe Only]
    TIER -->|Regular| STRIPE[Stripe Gateway]
    
    HIGH_VALUE --> PROCESS[Process Payment]
    ENTERPRISE --> PROCESS
    VIP --> PROCESS
    STRIPE --> PROCESS
    PAYTABS --> PROCESS
    PAYMOB --> PROCESS
    FALLBACK --> PROCESS
    
    PROCESS --> SUCCESS{Success?}
    SUCCESS -->|Yes| COMPLETE[Payment Complete]
    SUCCESS -->|No| RETRY[Retry with Fallback]
    
    RETRY --> COMPLETE

    classDef decision fill:#fff2cc
    classDef gateway fill:#e1f5fe
    classDef process fill:#f3e5f5
    classDef result fill:#e8f5e8

    class AMOUNT,CURRENCY,TIME_CHECK,MENA_TIME,EGYPT_TIME,TIER,SUCCESS decision
    class HIGH_VALUE,GLOBAL,MENA,EGYPT,ENTERPRISE,VIP,STRIPE,PAYTABS,PAYMOB,FALLBACK gateway
    class PROCESS,RETRY process
    class COMPLETE result
```

## Multi-Currency Conversion Flow

```mermaid
graph LR
    subgraph "Currency Conversion Process"
        REQ[Payment Request<br/>Amount: $100 USD<br/>Target: EUR] --> CACHE{Check Cache}
        
        CACHE -->|Hit| CACHED[Use Cached Rate<br/>Rate: 0.85<br/>Valid: 45min left]
        CACHE -->|Miss| FETCH[Fetch Fresh Rate]
        
        FETCH --> PROVIDER{Select Provider}
        PROVIDER --> FIXER[Fixer.io API]
        PROVIDER --> EXCHANGE[ExchangeRate-API]
        PROVIDER --> OPEN[Open Exchange Rates]
        
        FIXER --> RATE[Rate: 0.85]
        EXCHANGE --> RATE
        OPEN --> RATE
        
        RATE --> FALLBACK{API Success?}
        FALLBACK -->|No| MANUAL[Use Fallback Rate<br/>Rate: 0.85]
        FALLBACK -->|Yes| CONVERT[Convert Amount]
        MANUAL --> CONVERT
        CACHED --> CONVERT
        
        CONVERT --> CALC[Calculate Fees<br/>Converted: €85.00<br/>Fee: €0.43 (0.5%)<br/>Total: €85.43]
        
        CALC --> STORE[Store in Cache<br/>TTL: 1 hour]
        STORE --> RESULT[Return Result]
    end

    subgraph "Tax Calculation"
        RESULT --> TAX{Tax Required?}
        TAX -->|Yes| REGION[Determine Region<br/>EU: 20% VAT]
        TAX -->|No| FINAL[Final Amount]
        
        REGION --> THRESHOLD{Above Threshold?}
        THRESHOLD -->|Yes| APPLY[Apply Tax<br/>Tax: €17.09<br/>Total: €102.52]
        THRESHOLD -->|No| EXEMPT[Tax Exempt]
        
        APPLY --> FINAL
        EXEMPT --> FINAL
    end

    classDef process fill:#e3f2fd
    classDef decision fill:#fff3e0
    classDef result fill:#e8f5e8
    classDef external fill:#fce4ec

    class REQ,CONVERT,CALC,STORE,REGION,APPLY process
    class CACHE,PROVIDER,FALLBACK,TAX,THRESHOLD decision
    class CACHED,RATE,MANUAL,RESULT,FINAL,EXEMPT result
    class FIXER,EXCHANGE,OPEN external
```

## Database Schema Architecture

```mermaid
erDiagram
    BillingPlan {
        id string PK
        name string
        price integer
        supportedGateways PaymentGateway[]
        gatewaySpecificPricing jsonb
        regionalPricing jsonb
        gatewayMetadata jsonb
    }

    Subscription {
        id string PK
        tenantId string FK
        planId string FK
        paymentGateway PaymentGateway
        gatewaySubscriptionId string
        gatewayCustomerId string
        gatewayMetadata jsonb
        fallbackGateway PaymentGateway
        gatewayMigrationHistory jsonb[]
        status SubscriptionStatus
    }

    Payment {
        id string PK
        tenantId string FK
        subscriptionId string FK
        paymentGateway PaymentGateway
        gatewayPaymentId string
        gatewayTransactionId string
        gatewayMetadata jsonb
        amount integer
        currency string
        originalCurrency string
        originalAmount integer
        exchangeRate decimal
        conversionFee integer
        gatewayFee integer
        status PaymentStatus
    }

    Tenant {
        id string PK
        name string
        customPlans jsonb[]
        preferredGateway PaymentGateway
        gatewayConfigurations jsonb
        billingRegion string
        defaultCurrency string
    }

    PaymentGatewayEnum {
        STRIPE
        PAYTABS
        PAYMOB
    }

    BillingPlan ||--o{ Subscription : "has"
    Tenant ||--o{ Subscription : "owns"
    Subscription ||--o{ Payment : "generates"
    Tenant ||--o{ Payment : "makes"
```

## Performance Monitoring Architecture

```mermaid
graph TB
    subgraph "Performance Tracking"
        METRICS[Gateway Performance Metrics]
        LOGS[Payment Attempt Logs]
        HEALTH[Health Checks]
    end

    subgraph "Real-time Monitoring"
        SUCCESS[Success Rate Tracking<br/>Rolling Average]
        RESPONSE[Response Time Monitoring<br/>Average & Percentiles]
        FAILURES[Failure Categorization<br/>Error Code Analysis]
    end

    subgraph "Alerting System"
        THRESHOLD[Threshold Monitoring<br/>Success Rate < 95%<br/>Response Time > 5s]
        ALERTS[Alert Generation<br/>Email, Slack, PagerDuty]
        ESCALATION[Escalation Rules<br/>Auto-failover Triggers]
    end

    subgraph "Dashboard & Reporting"
        GRAFANA[Grafana Dashboards<br/>Real-time Visualization]
        REPORTS[Performance Reports<br/>Daily, Weekly, Monthly]
        ANALYTICS[Business Analytics<br/>Revenue Impact Analysis]
    end

    METRICS --> SUCCESS
    METRICS --> RESPONSE
    LOGS --> FAILURES

    SUCCESS --> THRESHOLD
    RESPONSE --> THRESHOLD
    FAILURES --> THRESHOLD

    THRESHOLD --> ALERTS
    ALERTS --> ESCALATION

    SUCCESS --> GRAFANA
    RESPONSE --> GRAFANA
    FAILURES --> GRAFANA

    GRAFANA --> REPORTS
    REPORTS --> ANALYTICS

    classDef monitoring fill:#e8f5e8
    classDef alerting fill:#ffebee
    classDef dashboard fill:#e3f2fd

    class METRICS,LOGS,HEALTH,SUCCESS,RESPONSE,FAILURES monitoring
    class THRESHOLD,ALERTS,ESCALATION alerting
    class GRAFANA,REPORTS,ANALYTICS dashboard
```

## Security Architecture

```mermaid
graph TB
    subgraph "Authentication Layer"
        JWT[JWT Token Validation]
        REFRESH[Refresh Token Rotation]
        RBAC[Role-Based Access Control]
    end

    subgraph "API Security"
        RATE_LIMIT[Rate Limiting<br/>Per User/IP/Endpoint]
        INPUT_VAL[Input Validation<br/>Schema Validation]
        CORS[CORS Configuration<br/>Allowed Origins]
    end

    subgraph "Payment Security"
        WEBHOOK_SIG[Webhook Signature Verification<br/>HMAC-SHA256]
        PCI_COMPLIANCE[PCI DSS Compliance<br/>No Card Data Storage]
        ENCRYPTION[Data Encryption<br/>At Rest & In Transit]
    end

    subgraph "Monitoring & Audit"
        AUDIT_LOG[Audit Logging<br/>All Payment Operations]
        SECURITY_EVENTS[Security Event Tracking<br/>Failed Auth, Suspicious Activity]
        COMPLIANCE[Compliance Reporting<br/>GDPR, PCI DSS]
    end

    JWT --> RATE_LIMIT
    REFRESH --> INPUT_VAL
    RBAC --> CORS

    RATE_LIMIT --> WEBHOOK_SIG
    INPUT_VAL --> PCI_COMPLIANCE
    CORS --> ENCRYPTION

    WEBHOOK_SIG --> AUDIT_LOG
    PCI_COMPLIANCE --> SECURITY_EVENTS
    ENCRYPTION --> COMPLIANCE

    classDef auth fill:#e8f5e8
    classDef security fill:#fff3e0
    classDef payment fill:#e1f5fe
    classDef audit fill:#f3e5f5

    class JWT,REFRESH,RBAC auth
    class RATE_LIMIT,INPUT_VAL,CORS security
    class WEBHOOK_SIG,PCI_COMPLIANCE,ENCRYPTION payment
    class AUDIT_LOG,SECURITY_EVENTS,COMPLIANCE audit
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Nginx Load Balancer<br/>SSL Termination<br/>Rate Limiting]
    end

    subgraph "Application Tier"
        APP1[App Instance 1<br/>Payment Orchestrator<br/>Gateway Services]
        APP2[App Instance 2<br/>Payment Orchestrator<br/>Gateway Services]
        APP3[App Instance 3<br/>Payment Orchestrator<br/>Gateway Services]
    end

    subgraph "Data Tier"
        PG_PRIMARY[(PostgreSQL Primary<br/>Multi-Gateway Schema)]
        PG_REPLICA[(PostgreSQL Replica<br/>Read Operations)]
        REDIS_CLUSTER[(Redis Cluster<br/>Caching & Sessions)]
    end

    subgraph "External Services"
        STRIPE_EXT[Stripe API]
        PAYTABS_EXT[PayTabs API]
        PAYMOB_EXT[PayMob API]
        CURRENCY_EXT[Currency APIs]
    end

    subgraph "Monitoring Stack"
        PROMETHEUS[Prometheus<br/>Metrics Collection]
        GRAFANA[Grafana<br/>Visualization]
        ALERTMANAGER[AlertManager<br/>Alert Routing]
    end

    LB --> APP1
    LB --> APP2
    LB --> APP3

    APP1 --> PG_PRIMARY
    APP2 --> PG_PRIMARY
    APP3 --> PG_PRIMARY

    APP1 --> PG_REPLICA
    APP2 --> PG_REPLICA
    APP3 --> PG_REPLICA

    APP1 --> REDIS_CLUSTER
    APP2 --> REDIS_CLUSTER
    APP3 --> REDIS_CLUSTER

    APP1 --> STRIPE_EXT
    APP1 --> PAYTABS_EXT
    APP1 --> PAYMOB_EXT
    APP1 --> CURRENCY_EXT

    APP2 --> STRIPE_EXT
    APP2 --> PAYTABS_EXT
    APP2 --> PAYMOB_EXT
    APP2 --> CURRENCY_EXT

    APP3 --> STRIPE_EXT
    APP3 --> PAYTABS_EXT
    APP3 --> PAYMOB_EXT
    APP3 --> CURRENCY_EXT

    APP1 --> PROMETHEUS
    APP2 --> PROMETHEUS
    APP3 --> PROMETHEUS

    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTMANAGER

    classDef lb fill:#ffecb3
    classDef app fill:#e1f5fe
    classDef data fill:#e8f5e8
    classDef external fill:#fce4ec
    classDef monitoring fill:#f3e5f5

    class LB lb
    class APP1,APP2,APP3 app
    class PG_PRIMARY,PG_REPLICA,REDIS_CLUSTER data
    class STRIPE_EXT,PAYTABS_EXT,PAYMOB_EXT,CURRENCY_EXT external
    class PROMETHEUS,GRAFANA,ALERTMANAGER monitoring
```

## Key Architectural Principles

### 1. **Abstraction & Modularity**
- Common interface (`IPaymentGateway`) for all payment providers
- Pluggable gateway architecture for easy addition of new providers
- Separation of concerns between routing, conversion, and processing

### 2. **Scalability & Performance**
- Horizontal scaling with stateless application instances
- Intelligent caching for exchange rates and gateway performance
- Asynchronous processing for non-critical operations

### 3. **Reliability & Resilience**
- Automatic failover between payment gateways
- Circuit breaker pattern for external API calls
- Comprehensive error handling and retry mechanisms

### 4. **Security & Compliance**
- PCI DSS compliance with no card data storage
- Webhook signature verification for all providers
- Comprehensive audit logging and monitoring

### 5. **Observability & Monitoring**
- Real-time performance metrics and health checks
- Comprehensive logging and alerting
- Business intelligence and analytics integration

This architecture supports global SaaS expansion with enterprise-grade reliability, security, and performance.
