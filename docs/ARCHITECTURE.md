# 🏗️ System Architecture Documentation

## 📋 **Table of Contents**
- [Overview](#overview)
- [High-Level Architecture](#high-level-architecture)
- [Database Schema](#database-schema)
- [Billing System Architecture](#billing-system-architecture)
- [Notification System Architecture](#notification-system-architecture)
- [API Layer Architecture](#api-layer-architecture)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)

---

## 🌟 **Overview**

The SaaS School Management Platform follows a **multi-layered, multi-tenant architecture** designed for scalability, security, and maintainability. The system is built using **NestJS** with **Clean Architecture** principles, ensuring separation of concerns and testability.

### **Core Architectural Principles**
- **Multi-tenancy**: Complete tenant isolation at all layers
- **Microservice-ready**: Modular design for easy service separation
- **Event-driven**: Asynchronous processing with Bull Queue
- **API-first**: RESTful APIs with comprehensive documentation
- **Security-first**: JWT authentication with role-based access control

---

## 🏛️ **High-Level Architecture**

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Dashboard]
        MOBILE[Mobile Apps]
        API_CLIENT[API Clients]
    end

    subgraph "API Gateway Layer"
        NGINX[Nginx Reverse Proxy]
        RATE_LIMIT[Rate Limiting]
        CORS[CORS Handler]
    end

    subgraph "Application Layer"
        AUTH[Authentication Service]
        BILLING[Billing Service]
        NOTIFICATION[Notification Service]
        SCHEDULING[Scheduling Service]
        ANALYTICS[Analytics Service]
    end

    subgraph "Infrastructure Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
        QUEUE[Bull Queue]
        SOLVER[OR-Tools Solver]
    end

    subgraph "External Services"
        STRIPE[Stripe Payments]
        SENDGRID[SendGrid Email]
        TWILIO[Twilio SMS]
        FIREBASE[Firebase FCM]
    end

    WEB --> NGINX
    MOBILE --> NGINX
    API_CLIENT --> NGINX
    
    NGINX --> RATE_LIMIT
    RATE_LIMIT --> CORS
    CORS --> AUTH
    
    AUTH --> BILLING
    AUTH --> NOTIFICATION
    AUTH --> SCHEDULING
    AUTH --> ANALYTICS
    
    BILLING --> POSTGRES
    NOTIFICATION --> POSTGRES
    SCHEDULING --> POSTGRES
    ANALYTICS --> POSTGRES
    
    BILLING --> REDIS
    NOTIFICATION --> REDIS
    SCHEDULING --> REDIS
    
    NOTIFICATION --> QUEUE
    SCHEDULING --> QUEUE
    
    SCHEDULING --> SOLVER
    
    BILLING --> STRIPE
    NOTIFICATION --> SENDGRID
    NOTIFICATION --> TWILIO
    NOTIFICATION --> FIREBASE
```

---

## 🗄️ **Database Schema**

### **Core Entity Relationships**

```mermaid
erDiagram
    TENANT ||--o{ SCHOOL : contains
    TENANT ||--o{ USER : belongs_to
    TENANT ||--o{ SUBSCRIPTION : has
    TENANT ||--o{ NOTIFICATION : receives
    
    SCHOOL ||--o{ USER : employs
    SCHOOL ||--o{ SUBJECT : offers
    SCHOOL ||--o{ CLASS : has
    SCHOOL ||--o{ ROOM : contains
    SCHOOL ||--o{ SUBSCRIPTION : subscribes_to
    
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ NOTIFICATION_PREFERENCE : configures
    USER ||--o{ NOTIFICATION_TEMPLATE : creates
    
    BILLING_PLAN ||--o{ SUBSCRIPTION : defines
    SUBSCRIPTION ||--o{ INVOICE : generates
    SUBSCRIPTION ||--o{ PAYMENT : processes
    SUBSCRIPTION ||--o{ USAGE_METRIC : tracks
    
    NOTIFICATION_TEMPLATE ||--o{ NOTIFICATION : uses
    
    TENANT {
        string id PK
        string name
        string subdomain
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    SCHOOL {
        string id PK
        string tenantId FK
        string name
        string address
        string phone
        string email
        boolean isActive
    }
    
    USER {
        string id PK
        string tenantId FK
        string schoolId FK
        string email
        string firstName
        string lastName
        enum role
        boolean isActive
    }
    
    BILLING_PLAN {
        string id PK
        string name
        enum type
        decimal monthlyPrice
        decimal yearlyPrice
        json features
        json limits
        boolean isActive
    }
    
    SUBSCRIPTION {
        string id PK
        string tenantId FK
        string schoolId FK
        string planId FK
        enum status
        enum billingCycle
        datetime currentPeriodStart
        datetime currentPeriodEnd
        datetime trialStart
        datetime trialEnd
        string stripeSubscriptionId
    }
    
    INVOICE {
        string id PK
        string subscriptionId FK
        string tenantId FK
        string invoiceNumber
        enum status
        decimal subtotal
        decimal taxAmount
        decimal total
        datetime dueDate
        json lineItems
    }
    
    PAYMENT {
        string id PK
        string subscriptionId FK
        string invoiceId FK
        string tenantId FK
        decimal amount
        enum status
        string paymentMethod
        string stripePaymentId
    }
    
    NOTIFICATION_TEMPLATE {
        string id PK
        string tenantId FK
        string name
        enum type
        string subject
        string content
        json variables
        boolean isActive
        boolean isSystem
    }
    
    NOTIFICATION {
        string id PK
        string tenantId FK
        string templateId FK
        string recipientId FK
        enum type
        enum priority
        enum status
        string subject
        string content
        datetime scheduledFor
        datetime sentAt
        datetime readAt
    }
    
    NOTIFICATION_PREFERENCE {
        string id PK
        string userId FK
        string tenantId FK
        enum notificationType
        enum templateType
        boolean isEnabled
        json deliveryChannels
        string quietHoursStart
        string quietHoursEnd
        string timezone
    }
```

---

## 💳 **Billing System Architecture**

### **Billing Service Layer**

```mermaid
graph TB
    subgraph "Billing API Layer"
        BILLING_CTRL[Billing Controller]
        SUB_CTRL[Subscription Controller]
    end

    subgraph "Billing Service Layer"
        BILLING_SVC[Billing Service]
        SUB_SVC[Subscription Service]
        INVOICE_SVC[Invoice Service]
        STRIPE_SVC[Stripe Service]
    end

    subgraph "Billing Data Layer"
        PLAN_MODEL[BillingPlan Model]
        SUB_MODEL[Subscription Model]
        INVOICE_MODEL[Invoice Model]
        PAYMENT_MODEL[Payment Model]
        USAGE_MODEL[UsageMetric Model]
    end

    subgraph "External Integration"
        STRIPE_API[Stripe API]
        PDF_GEN[PDF Generator]
        EMAIL_SVC[Email Service]
    end

    BILLING_CTRL --> BILLING_SVC
    SUB_CTRL --> SUB_SVC
    
    BILLING_SVC --> PLAN_MODEL
    SUB_SVC --> SUB_MODEL
    SUB_SVC --> USAGE_MODEL
    SUB_SVC --> STRIPE_SVC
    
    INVOICE_SVC --> INVOICE_MODEL
    INVOICE_SVC --> PAYMENT_MODEL
    INVOICE_SVC --> PDF_GEN
    INVOICE_SVC --> EMAIL_SVC
    
    STRIPE_SVC --> STRIPE_API
```

### **Subscription Lifecycle Flow**

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant SubService
    participant StripeService
    participant Database
    participant Stripe

    Client->>API: POST /subscriptions
    API->>SubService: createSubscription()
    SubService->>Database: Validate plan & school
    SubService->>StripeService: createCustomer()
    StripeService->>Stripe: Create customer
    Stripe-->>StripeService: Customer ID
    SubService->>StripeService: createSubscription()
    StripeService->>Stripe: Create subscription
    Stripe-->>StripeService: Subscription ID
    SubService->>Database: Save subscription
    Database-->>SubService: Subscription created
    SubService-->>API: Subscription response
    API-->>Client: 201 Created
```

### **Proration Calculation Flow**

```mermaid
graph LR
    START[Plan Change Request] --> VALIDATE[Validate New Plan]
    VALIDATE --> CALC_DAYS[Calculate Remaining Days]
    CALC_DAYS --> CALC_UNUSED[Calculate Unused Amount]
    CALC_UNUSED --> CALC_NEW[Calculate New Amount]
    CALC_NEW --> PRORATION[Proration = New - Unused]
    PRORATION --> UPDATE_STRIPE[Update Stripe Subscription]
    UPDATE_STRIPE --> UPDATE_DB[Update Database]
    UPDATE_DB --> RESPONSE[Return Proration Details]
```

---

## 📱 **Notification System Architecture**

### **Notification Service Layer**

```mermaid
graph TB
    subgraph "Notification API Layer"
        NOTIF_CTRL[Notification Controller]
        HISTORY_CTRL[History Endpoints]
        PREF_CTRL[Preference Endpoints]
    end

    subgraph "Notification Service Layer"
        NOTIF_SVC[Notification Service]
        HISTORY_SVC[History Service]
        PREF_SVC[Preference Service]
        TEMPLATE_SVC[Template Service]
    end

    subgraph "Delivery Services"
        EMAIL_SVC[Email Service]
        SMS_SVC[SMS Service]
        PUSH_SVC[Push Service]
        WS_SVC[WebSocket Service]
    end

    subgraph "Background Processing"
        QUEUE[Bull Queue]
        PROCESSOR[Notification Processor]
    end

    subgraph "Data Layer"
        NOTIF_MODEL[Notification Model]
        TEMPLATE_MODEL[Template Model]
        PREF_MODEL[Preference Model]
    end

    subgraph "External Services"
        SENDGRID[SendGrid]
        TWILIO[Twilio]
        FIREBASE[Firebase FCM]
    end

    NOTIF_CTRL --> NOTIF_SVC
    HISTORY_CTRL --> HISTORY_SVC
    PREF_CTRL --> PREF_SVC
    
    NOTIF_SVC --> QUEUE
    QUEUE --> PROCESSOR
    
    PROCESSOR --> EMAIL_SVC
    PROCESSOR --> SMS_SVC
    PROCESSOR --> PUSH_SVC
    PROCESSOR --> WS_SVC
    
    EMAIL_SVC --> SENDGRID
    SMS_SVC --> TWILIO
    PUSH_SVC --> FIREBASE
    
    HISTORY_SVC --> NOTIF_MODEL
    PREF_SVC --> PREF_MODEL
    TEMPLATE_SVC --> TEMPLATE_MODEL
```

### **Notification Delivery Flow**

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant NotifService
    participant PrefService
    participant Queue
    participant Processor
    participant DeliveryService
    participant External

    Client->>API: POST /notifications/send
    API->>NotifService: sendNotification()
    NotifService->>PrefService: shouldReceiveNotification()
    PrefService-->>NotifService: Eligibility check
    
    alt User eligible
        NotifService->>Queue: Add to queue
        Queue->>Processor: Process notification
        Processor->>DeliveryService: Deliver via channel
        DeliveryService->>External: Send notification
        External-->>DeliveryService: Delivery status
        DeliveryService->>Processor: Update status
        Processor->>NotifService: Update database
    else User not eligible
        NotifService-->>API: Skip notification
    end
    
    API-->>Client: Response
```

### **Preference Management Flow**

```mermaid
graph LR
    USER_REQ[User Request] --> CHECK_QUIET[Check Quiet Hours]
    CHECK_QUIET --> CHECK_ENABLED[Check If Enabled]
    CHECK_ENABLED --> CHECK_CHANNEL[Check Delivery Channel]
    CHECK_CHANNEL --> DECISION{Should Receive?}
    
    DECISION -->|Yes| ALLOW[Allow Notification]
    DECISION -->|No| BLOCK[Block Notification]
    
    ALLOW --> DELIVER[Deliver Notification]
    BLOCK --> LOG[Log Reason]
```

---

## 🔌 **API Layer Architecture**

### **Controller Structure**

```mermaid
graph TB
    subgraph "Authentication Layer"
        JWT_GUARD[JWT Auth Guard]
        ROLES_GUARD[Roles Guard]
        RATE_LIMIT[Rate Limiting]
    end

    subgraph "Controller Layer"
        AUTH_CTRL[Auth Controller]
        BILLING_CTRL[Billing Controller]
        NOTIF_CTRL[Notification Controller]
        SCHEDULE_CTRL[Scheduling Controller]
    end

    subgraph "Service Layer"
        AUTH_SVC[Auth Service]
        BILLING_SVC[Billing Service]
        NOTIF_SVC[Notification Service]
        SCHEDULE_SVC[Scheduling Service]
    end

    subgraph "Data Access Layer"
        PRISMA[Prisma ORM]
        POSTGRES[(PostgreSQL)]
    end

    JWT_GUARD --> ROLES_GUARD
    ROLES_GUARD --> RATE_LIMIT
    RATE_LIMIT --> AUTH_CTRL
    RATE_LIMIT --> BILLING_CTRL
    RATE_LIMIT --> NOTIF_CTRL
    RATE_LIMIT --> SCHEDULE_CTRL

    AUTH_CTRL --> AUTH_SVC
    BILLING_CTRL --> BILLING_SVC
    NOTIF_CTRL --> NOTIF_SVC
    SCHEDULE_CTRL --> SCHEDULE_SVC

    AUTH_SVC --> PRISMA
    BILLING_SVC --> PRISMA
    NOTIF_SVC --> PRISMA
    SCHEDULE_SVC --> PRISMA

    PRISMA --> POSTGRES
```

### **API Endpoint Organization**

```
/api/v1/
├── auth/
│   ├── login
│   ├── register
│   ├── refresh
│   └── logout
├── billing/
│   ├── subscriptions/
│   ├── payments/
│   ├── invoices/
│   ├── plans/
│   └── analytics/
├── notifications/
│   ├── send
│   ├── history/
│   ├── preferences/
│   ├── templates/
│   └── admin/
├── scheduling/
│   ├── schedules/
│   ├── sessions/
│   ├── constraints/
│   └── analytics/
└── analytics/
    ├── dashboard
    ├── usage
    └── reports
```

---

## 📊 **Data Flow Diagrams**

### **Billing Data Flow**

```mermaid
graph LR
    subgraph "Input"
        PLAN_CREATE[Create Plan]
        SUB_CREATE[Create Subscription]
        USAGE_TRACK[Track Usage]
    end

    subgraph "Processing"
        VALIDATE[Validate Data]
        CALCULATE[Calculate Billing]
        GENERATE[Generate Invoice]
        PROCESS[Process Payment]
    end

    subgraph "Output"
        INVOICE[Invoice Generated]
        PAYMENT[Payment Processed]
        ANALYTICS[Analytics Updated]
    end

    PLAN_CREATE --> VALIDATE
    SUB_CREATE --> VALIDATE
    USAGE_TRACK --> CALCULATE
    
    VALIDATE --> CALCULATE
    CALCULATE --> GENERATE
    GENERATE --> PROCESS
    
    PROCESS --> INVOICE
    PROCESS --> PAYMENT
    PROCESS --> ANALYTICS
```

### **Notification Data Flow**

```mermaid
graph LR
    subgraph "Trigger"
        EVENT[System Event]
        MANUAL[Manual Send]
        SCHEDULED[Scheduled Send]
    end

    subgraph "Processing"
        TEMPLATE[Apply Template]
        PREFERENCE[Check Preferences]
        QUEUE[Add to Queue]
        DELIVER[Deliver Notification]
    end

    subgraph "Tracking"
        STATUS[Update Status]
        ANALYTICS[Update Analytics]
        HISTORY[Store History]
    end

    EVENT --> TEMPLATE
    MANUAL --> TEMPLATE
    SCHEDULED --> TEMPLATE
    
    TEMPLATE --> PREFERENCE
    PREFERENCE --> QUEUE
    QUEUE --> DELIVER
    
    DELIVER --> STATUS
    STATUS --> ANALYTICS
    STATUS --> HISTORY
```

---

## 🔒 **Security Architecture**

### **Authentication & Authorization Flow**

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthGuard
    participant AuthService
    participant Database

    Client->>API: Request with JWT
    API->>AuthGuard: Validate token
    AuthGuard->>AuthService: Verify JWT
    AuthService->>Database: Check user status
    Database-->>AuthService: User data
    AuthService-->>AuthGuard: User context
    AuthGuard->>API: Authorized request
    API->>Client: Response
```

### **Multi-tenant Security**

```mermaid
graph TB
    REQUEST[Incoming Request] --> JWT_VALIDATE[Validate JWT]
    JWT_VALIDATE --> EXTRACT_TENANT[Extract Tenant ID]
    EXTRACT_TENANT --> SCOPE_QUERY[Scope Database Query]
    SCOPE_QUERY --> VALIDATE_ACCESS[Validate Resource Access]
    VALIDATE_ACCESS --> PROCESS[Process Request]
    PROCESS --> RESPONSE[Return Response]
```

### **Security Layers**

1. **Network Security**
   - HTTPS/TLS encryption
   - CORS configuration
   - Rate limiting

2. **Authentication Security**
   - JWT tokens with expiration
   - Refresh token rotation
   - Password hashing (bcrypt)

3. **Authorization Security**
   - Role-based access control
   - Resource-level permissions
   - Multi-tenant isolation

4. **Data Security**
   - Input validation
   - SQL injection prevention
   - XSS protection

---

## 🚀 **Deployment Architecture**

### **Container Architecture**

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Nginx Load Balancer]
    end

    subgraph "Application Tier"
        APP1[NestJS App Instance 1]
        APP2[NestJS App Instance 2]
        APP3[NestJS App Instance 3]
    end

    subgraph "Data Tier"
        POSTGRES[(PostgreSQL Primary)]
        POSTGRES_REPLICA[(PostgreSQL Replica)]
        REDIS[(Redis Cluster)]
    end

    subgraph "Monitoring"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        ALERTMANAGER[Alert Manager]
    end

    LB --> APP1
    LB --> APP2
    LB --> APP3

    APP1 --> POSTGRES
    APP2 --> POSTGRES
    APP3 --> POSTGRES

    APP1 --> REDIS
    APP2 --> REDIS
    APP3 --> REDIS

    POSTGRES --> POSTGRES_REPLICA

    PROMETHEUS --> APP1
    PROMETHEUS --> APP2
    PROMETHEUS --> APP3
    PROMETHEUS --> POSTGRES
    PROMETHEUS --> REDIS

    GRAFANA --> PROMETHEUS
    ALERTMANAGER --> PROMETHEUS
```

### **Kubernetes Deployment**

```yaml
# Simplified K8s architecture
apiVersion: v1
kind: Namespace
metadata:
  name: sasscolmng
---
# Application Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sasscolmng-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sasscolmng-backend
  template:
    spec:
      containers:
      - name: backend
        image: sasscolmng/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
---
# Service
apiVersion: v1
kind: Service
metadata:
  name: sasscolmng-service
spec:
  selector:
    app: sasscolmng-backend
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

---

## 📈 **Performance Considerations**

### **Scalability Patterns**

1. **Horizontal Scaling**
   - Stateless application design
   - Load balancing across instances
   - Database read replicas

2. **Caching Strategy**
   - Redis for session storage
   - Query result caching
   - Static asset caching

3. **Background Processing**
   - Bull Queue for async tasks
   - Notification processing
   - Report generation

4. **Database Optimization**
   - Proper indexing strategy
   - Connection pooling
   - Query optimization

### **Monitoring & Observability**

1. **Application Metrics**
   - Request/response times
   - Error rates
   - Throughput metrics

2. **Infrastructure Metrics**
   - CPU/Memory usage
   - Database performance
   - Queue processing rates

3. **Business Metrics**
   - User engagement
   - Billing metrics
   - Notification delivery rates

---

This architecture documentation provides a comprehensive overview of the system design, ensuring maintainability, scalability, and security for the SaaS School Management Platform.

