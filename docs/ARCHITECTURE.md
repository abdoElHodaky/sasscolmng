# 🏗️ Architecture Documentation

## 📋 **Table of Contents**
- [System Overview](#system-overview)
- [High-Level Architecture](#high-level-architecture)
- [Database Schema](#database-schema)
- [API Architecture](#api-architecture)
- [Scheduling Engine](#scheduling-engine)
- [Notification System](#notification-system)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)

---

## 🌐 **System Overview**

The SaaS School Management Platform is built using a modern, scalable architecture that supports multi-tenancy, real-time communications, and intelligent scheduling.

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Dashboard]
        MOBILE[Mobile Apps]
        API_CLIENT[API Clients]
    end
    
    subgraph "API Gateway"
        NGINX[NGINX Load Balancer]
        RATE_LIMIT[Rate Limiting]
        AUTH_MIDDLEWARE[Auth Middleware]
    end
    
    subgraph "Application Layer"
        NESTJS[NestJS Backend]
        WEBSOCKET[WebSocket Gateway]
        QUEUE[Bull Queue]
    end
    
    subgraph "Business Logic"
        AUTH[Authentication]
        TENANT[Multi-Tenant]
        SCHEDULING[Scheduling Engine]
        NOTIFICATIONS[Notifications]
        BILLING[Billing System]
        ANALYTICS[Analytics]
    end
    
    subgraph "Data Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
        FILES[File Storage]
    end
    
    subgraph "External Services"
        STRIPE[Stripe Payments]
        TWILIO[Twilio SMS]
        SMTP[Email SMTP]
        ORTOOLS[OR-Tools Solver]
    end
    
    WEB --> NGINX
    MOBILE --> NGINX
    API_CLIENT --> NGINX
    
    NGINX --> RATE_LIMIT
    RATE_LIMIT --> AUTH_MIDDLEWARE
    AUTH_MIDDLEWARE --> NESTJS
    
    NESTJS --> AUTH
    NESTJS --> TENANT
    NESTJS --> SCHEDULING
    NESTJS --> NOTIFICATIONS
    NESTJS --> BILLING
    NESTJS --> ANALYTICS
    
    NESTJS --> WEBSOCKET
    NESTJS --> QUEUE
    
    AUTH --> POSTGRES
    TENANT --> POSTGRES
    SCHEDULING --> POSTGRES
    SCHEDULING --> ORTOOLS
    NOTIFICATIONS --> REDIS
    BILLING --> STRIPE
    
    QUEUE --> REDIS
    WEBSOCKET --> REDIS
    
    NOTIFICATIONS --> SMTP
    NOTIFICATIONS --> TWILIO
```

---

## 🏛️ **High-Level Architecture**

### **Layered Architecture**

```mermaid
graph TD
    subgraph "Presentation Layer"
        REST[REST API Controllers]
        WEBSOCKET_CTRL[WebSocket Controllers]
        SWAGGER[Swagger Documentation]
    end
    
    subgraph "Business Logic Layer"
        SERVICES[Business Services]
        VALIDATORS[Input Validators]
        GUARDS[Authorization Guards]
        INTERCEPTORS[Logging Interceptors]
    end
    
    subgraph "Data Access Layer"
        PRISMA[Prisma ORM]
        REPOSITORIES[Repository Pattern]
        MIGRATIONS[Database Migrations]
    end
    
    subgraph "Infrastructure Layer"
        DATABASE[(PostgreSQL)]
        CACHE[(Redis)]
        QUEUE_SYS[Queue System]
        EXTERNAL[External APIs]
    end
    
    REST --> SERVICES
    WEBSOCKET_CTRL --> SERVICES
    SERVICES --> PRISMA
    PRISMA --> DATABASE
    SERVICES --> CACHE
    SERVICES --> QUEUE_SYS
    SERVICES --> EXTERNAL
```

### **Module Architecture**

```mermaid
graph LR
    subgraph "Core Modules"
        AUTH_MOD[Auth Module]
        USER_MOD[Users Module]
        TENANT_MOD[Tenant Module]
        COMMON_MOD[Common Module]
    end
    
    subgraph "Business Modules"
        SCHOOL_MOD[Schools Module]
        SUBJECT_MOD[Subjects Module]
        CLASS_MOD[Classes Module]
        ROOM_MOD[Rooms Module]
    end
    
    subgraph "Feature Modules"
        SCHEDULE_MOD[Scheduling Module]
        NOTIFY_MOD[Notifications Module]
        BILLING_MOD[Billing Module]
        ANALYTICS_MOD[Analytics Module]
    end
    
    AUTH_MOD --> COMMON_MOD
    USER_MOD --> AUTH_MOD
    TENANT_MOD --> AUTH_MOD
    
    SCHOOL_MOD --> TENANT_MOD
    SUBJECT_MOD --> SCHOOL_MOD
    CLASS_MOD --> SCHOOL_MOD
    ROOM_MOD --> SCHOOL_MOD
    
    SCHEDULE_MOD --> SCHOOL_MOD
    NOTIFY_MOD --> USER_MOD
    BILLING_MOD --> TENANT_MOD
    ANALYTICS_MOD --> TENANT_MOD
```

---

## 🗄️ **Database Schema**

### **Core Entities Relationship**

```mermaid
erDiagram
    TENANT ||--o{ SCHOOL : contains
    TENANT ||--o{ USER : belongs_to
    SCHOOL ||--o{ USER : employs
    SCHOOL ||--o{ SUBJECT : offers
    SCHOOL ||--o{ CLASS : has
    SCHOOL ||--o{ ROOM : contains
    SCHOOL ||--o{ SCHEDULE : creates
    
    USER ||--o{ TEACHER_SUBJECT : teaches
    SUBJECT ||--o{ TEACHER_SUBJECT : taught_by
    SUBJECT ||--o{ CLASS_SUBJECT : assigned_to
    CLASS ||--o{ CLASS_SUBJECT : studies
    
    SCHEDULE ||--o{ SCHEDULE_SESSION : contains
    SCHEDULE_SESSION }o--|| SUBJECT : for
    SCHEDULE_SESSION }o--|| CLASS : with
    SCHEDULE_SESSION }o--|| USER : taught_by
    SCHEDULE_SESSION }o--|| ROOM : in
    SCHEDULE_SESSION }o--|| TIME_SLOT : during
    
    SCHEDULE ||--o{ SCHEDULE_CONFLICT : has
    SCHOOL ||--o{ SCHEDULING_PREFERENCE : defines
    SCHOOL ||--o{ SCHEDULING_RULE : enforces
    USER ||--o{ TEACHER_AVAILABILITY : available
```

### **Multi-Tenant Data Isolation**

```mermaid
graph TB
    subgraph "Tenant A Data"
        TENANT_A[Tenant A]
        SCHOOL_A1[School A1]
        SCHOOL_A2[School A2]
        USER_A[Users A]
        DATA_A[Data A]
    end
    
    subgraph "Tenant B Data"
        TENANT_B[Tenant B]
        SCHOOL_B1[School B1]
        USER_B[Users B]
        DATA_B[Data B]
    end
    
    subgraph "Shared Infrastructure"
        APP[Application Layer]
        DB[(Database)]
        CACHE[(Cache)]
    end
    
    TENANT_A --> APP
    TENANT_B --> APP
    APP --> DB
    APP --> CACHE
    
    TENANT_A -.-> SCHOOL_A1
    TENANT_A -.-> SCHOOL_A2
    TENANT_A -.-> USER_A
    TENANT_A -.-> DATA_A
    
    TENANT_B -.-> SCHOOL_B1
    TENANT_B -.-> USER_B
    TENANT_B -.-> DATA_B
```

---

## 🔌 **API Architecture**

### **RESTful API Design**

```mermaid
graph TD
    subgraph "API Endpoints"
        AUTH_API[/auth/*]
        TENANT_API[/tenants/*]
        SCHOOL_API[/schools/*]
        USER_API[/users/*]
        SCHEDULE_API[/scheduling/*]
        NOTIFY_API[/notifications/*]
        BILLING_API[/billing/*]
        ANALYTICS_API[/analytics/*]
    end
    
    subgraph "Middleware Stack"
        CORS[CORS Handler]
        HELMET[Security Headers]
        RATE[Rate Limiting]
        AUTH_GUARD[JWT Auth Guard]
        ROLE_GUARD[Role Guard]
        TENANT_GUARD[Tenant Guard]
        VALIDATION[Input Validation]
        LOGGING[Request Logging]
    end
    
    subgraph "Controllers"
        AUTH_CTRL[Auth Controller]
        SCHOOL_CTRL[School Controller]
        SCHEDULE_CTRL[Schedule Controller]
        NOTIFY_CTRL[Notification Controller]
    end
    
    AUTH_API --> CORS
    SCHOOL_API --> CORS
    SCHEDULE_API --> CORS
    NOTIFY_API --> CORS
    
    CORS --> HELMET
    HELMET --> RATE
    RATE --> AUTH_GUARD
    AUTH_GUARD --> ROLE_GUARD
    ROLE_GUARD --> TENANT_GUARD
    TENANT_GUARD --> VALIDATION
    VALIDATION --> LOGGING
    
    LOGGING --> AUTH_CTRL
    LOGGING --> SCHOOL_CTRL
    LOGGING --> SCHEDULE_CTRL
    LOGGING --> NOTIFY_CTRL
```

### **Authentication Flow**

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthService
    participant Database
    participant JWT
    
    Client->>API: POST /auth/login
    API->>AuthService: validateCredentials()
    AuthService->>Database: findUser(email)
    Database-->>AuthService: user data
    AuthService->>AuthService: verifyPassword()
    AuthService->>JWT: generateTokens()
    JWT-->>AuthService: access + refresh tokens
    AuthService-->>API: tokens + user data
    API-->>Client: 200 + tokens
    
    Note over Client,JWT: Subsequent requests
    Client->>API: GET /schools (with JWT)
    API->>JWT: verifyToken()
    JWT-->>API: decoded payload
    API->>API: checkPermissions()
    API-->>Client: 200 + data
```

---

## 🧠 **Scheduling Engine**

### **Constraint Programming Architecture**

```mermaid
graph TB
    subgraph "Scheduling Request"
        INPUT[Scheduling Input]
        TEACHERS[Teachers]
        ROOMS[Rooms]
        SUBJECTS[Subjects]
        CLASSES[Classes]
        TIMESLOTS[Time Slots]
        PREFERENCES[Preferences]
    end
    
    subgraph "Constraint Engine"
        HARD_CONSTRAINTS[Hard Constraints]
        SOFT_CONSTRAINTS[Soft Constraints]
        VALIDATOR[Constraint Validator]
    end
    
    subgraph "OR-Tools Integration"
        CPSAT[CP-SAT Solver]
        PYTHON[Python Script]
        HEURISTIC[Heuristic Fallback]
    end
    
    subgraph "Output Processing"
        SOLUTION[Solution Parser]
        CONFLICTS[Conflict Detector]
        OPTIMIZER[Score Calculator]
        EXPORT[Export Generator]
    end
    
    INPUT --> HARD_CONSTRAINTS
    INPUT --> SOFT_CONSTRAINTS
    TEACHERS --> HARD_CONSTRAINTS
    ROOMS --> HARD_CONSTRAINTS
    SUBJECTS --> HARD_CONSTRAINTS
    CLASSES --> HARD_CONSTRAINTS
    TIMESLOTS --> HARD_CONSTRAINTS
    PREFERENCES --> SOFT_CONSTRAINTS
    
    HARD_CONSTRAINTS --> VALIDATOR
    SOFT_CONSTRAINTS --> VALIDATOR
    VALIDATOR --> CPSAT
    CPSAT --> PYTHON
    PYTHON --> HEURISTIC
    
    PYTHON --> SOLUTION
    SOLUTION --> CONFLICTS
    SOLUTION --> OPTIMIZER
    SOLUTION --> EXPORT
```

### **Constraint Types**

```mermaid
graph LR
    subgraph "Hard Constraints (Must Satisfy)"
        HC1[Teacher Conflict]
        HC2[Room Conflict]
        HC3[Class Conflict]
        HC4[Teacher Availability]
        HC5[Room Capacity]
        HC6[Time Slot Validity]
    end
    
    subgraph "Soft Constraints (Optimization)"
        SC1[Teacher Preferences]
        SC2[Room Preferences]
        SC3[Workload Distribution]
        SC4[Time Preferences]
        SC5[Subject Preferences]
        SC6[Consecutive Periods]
    end
    
    subgraph "Solver Decision"
        FEASIBLE{Feasible Solution?}
        OPTIMAL[Optimize Soft Constraints]
        INFEASIBLE[Report Conflicts]
    end
    
    HC1 --> FEASIBLE
    HC2 --> FEASIBLE
    HC3 --> FEASIBLE
    HC4 --> FEASIBLE
    HC5 --> FEASIBLE
    HC6 --> FEASIBLE
    
    FEASIBLE -->|Yes| OPTIMAL
    FEASIBLE -->|No| INFEASIBLE
    
    SC1 --> OPTIMAL
    SC2 --> OPTIMAL
    SC3 --> OPTIMAL
    SC4 --> OPTIMAL
    SC5 --> OPTIMAL
    SC6 --> OPTIMAL
```

### **Background Job Processing**

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Queue
    participant Worker
    participant Solver
    participant Database
    
    Client->>API: POST /schedules/generate
    API->>Queue: addJob(scheduleRequest)
    Queue-->>API: jobId
    API-->>Client: 202 + jobId
    
    Queue->>Worker: processJob()
    Worker->>Solver: solve(constraints)
    Solver->>Solver: CP-SAT Processing
    Solver-->>Worker: solution
    Worker->>Database: saveSchedule()
    Worker->>Queue: updateProgress(100%)
    
    Client->>API: GET /schedules/job/:jobId
    API->>Queue: getJobStatus()
    Queue-->>API: status + result
    API-->>Client: 200 + schedule
```

---

## 📢 **Notification System**

### **Multi-Channel Architecture**

```mermaid
graph TB
    subgraph "Notification Request"
        TRIGGER[Event Trigger]
        TEMPLATE[Template Engine]
        RECIPIENTS[Recipient List]
    end
    
    subgraph "Notification Service"
        ROUTER[Channel Router]
        QUEUE[Background Queue]
        PROCESSOR[Notification Processor]
    end
    
    subgraph "Delivery Channels"
        EMAIL[Email Service]
        SMS[SMS Service]
        WEBSOCKET[WebSocket Service]
        PUSH[Push Notifications]
    end
    
    subgraph "External Services"
        SMTP[SMTP Server]
        TWILIO[Twilio API]
        FCM[Firebase FCM]
    end
    
    TRIGGER --> TEMPLATE
    TEMPLATE --> RECIPIENTS
    RECIPIENTS --> ROUTER
    ROUTER --> QUEUE
    QUEUE --> PROCESSOR
    
    PROCESSOR --> EMAIL
    PROCESSOR --> SMS
    PROCESSOR --> WEBSOCKET
    PROCESSOR --> PUSH
    
    EMAIL --> SMTP
    SMS --> TWILIO
    PUSH --> FCM
```

### **Real-time WebSocket Architecture**

```mermaid
graph TB
    subgraph "Client Connections"
        WEB_CLIENT[Web Client]
        MOBILE_CLIENT[Mobile Client]
        ADMIN_CLIENT[Admin Client]
    end
    
    subgraph "WebSocket Gateway"
        WS_GATEWAY[Socket.io Gateway]
        AUTH_WS[JWT Authentication]
        ROOM_MANAGER[Room Manager]
        CONNECTION_POOL[Connection Pool]
    end
    
    subgraph "Notification Distribution"
        USER_TARGETING[User Targeting]
        ROOM_BROADCAST[Room Broadcast]
        GLOBAL_BROADCAST[Global Broadcast]
    end
    
    subgraph "Message Types"
        SCHEDULE_NOTIFY[Schedule Notifications]
        SYSTEM_ALERTS[System Alerts]
        CHAT_MESSAGES[Chat Messages]
        STATUS_UPDATES[Status Updates]
    end
    
    WEB_CLIENT --> WS_GATEWAY
    MOBILE_CLIENT --> WS_GATEWAY
    ADMIN_CLIENT --> WS_GATEWAY
    
    WS_GATEWAY --> AUTH_WS
    AUTH_WS --> ROOM_MANAGER
    ROOM_MANAGER --> CONNECTION_POOL
    
    CONNECTION_POOL --> USER_TARGETING
    CONNECTION_POOL --> ROOM_BROADCAST
    CONNECTION_POOL --> GLOBAL_BROADCAST
    
    USER_TARGETING --> SCHEDULE_NOTIFY
    ROOM_BROADCAST --> SYSTEM_ALERTS
    GLOBAL_BROADCAST --> STATUS_UPDATES
```

---

## 🔒 **Security Architecture**

### **Authentication & Authorization**

```mermaid
graph TB
    subgraph "Authentication Layer"
        LOGIN[Login Endpoint]
        JWT_SERVICE[JWT Service]
        REFRESH[Refresh Token]
        LOGOUT[Logout]
    end
    
    subgraph "Authorization Layer"
        ROLE_GUARD[Role-based Guard]
        TENANT_GUARD[Tenant Isolation]
        RESOURCE_GUARD[Resource Guard]
        PERMISSION_CHECK[Permission Check]
    end
    
    subgraph "Security Middleware"
        RATE_LIMITER[Rate Limiting]
        CORS_HANDLER[CORS Handler]
        HELMET_SECURITY[Security Headers]
        INPUT_VALIDATION[Input Validation]
    end
    
    subgraph "Data Protection"
        ENCRYPTION[Data Encryption]
        HASHING[Password Hashing]
        SANITIZATION[Input Sanitization]
        AUDIT_LOG[Audit Logging]
    end
    
    LOGIN --> JWT_SERVICE
    JWT_SERVICE --> REFRESH
    JWT_SERVICE --> ROLE_GUARD
    
    ROLE_GUARD --> TENANT_GUARD
    TENANT_GUARD --> RESOURCE_GUARD
    RESOURCE_GUARD --> PERMISSION_CHECK
    
    RATE_LIMITER --> CORS_HANDLER
    CORS_HANDLER --> HELMET_SECURITY
    HELMET_SECURITY --> INPUT_VALIDATION
    
    INPUT_VALIDATION --> ENCRYPTION
    ENCRYPTION --> HASHING
    HASHING --> SANITIZATION
    SANITIZATION --> AUDIT_LOG
```

### **Multi-Tenant Security**

```mermaid
graph LR
    subgraph "Request Flow"
        REQUEST[Incoming Request]
        JWT_TOKEN[JWT Token]
        TENANT_ID[Tenant ID]
    end
    
    subgraph "Tenant Isolation"
        TENANT_GUARD[Tenant Guard]
        DATA_FILTER[Data Filtering]
        QUERY_MODIFIER[Query Modifier]
    end
    
    subgraph "Database Access"
        PRISMA_FILTER[Prisma Filter]
        ROW_LEVEL[Row-Level Security]
        TENANT_SCOPE[Tenant Scoping]
    end
    
    REQUEST --> JWT_TOKEN
    JWT_TOKEN --> TENANT_ID
    TENANT_ID --> TENANT_GUARD
    
    TENANT_GUARD --> DATA_FILTER
    DATA_FILTER --> QUERY_MODIFIER
    QUERY_MODIFIER --> PRISMA_FILTER
    
    PRISMA_FILTER --> ROW_LEVEL
    ROW_LEVEL --> TENANT_SCOPE
```

---

## 🚀 **Deployment Architecture**

### **Production Deployment**

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[NGINX Load Balancer]
        SSL[SSL Termination]
    end
    
    subgraph "Application Tier"
        APP1[NestJS Instance 1]
        APP2[NestJS Instance 2]
        APP3[NestJS Instance 3]
    end
    
    subgraph "Database Tier"
        PRIMARY[(PostgreSQL Primary)]
        REPLICA[(PostgreSQL Replica)]
        REDIS_CLUSTER[(Redis Cluster)]
    end
    
    subgraph "Background Services"
        QUEUE_WORKER1[Queue Worker 1]
        QUEUE_WORKER2[Queue Worker 2]
        SCHEDULER[Cron Scheduler]
    end
    
    subgraph "External Services"
        STRIPE_API[Stripe API]
        TWILIO_API[Twilio API]
        SMTP_SERVICE[SMTP Service]
    end
    
    subgraph "Monitoring"
        LOGS[Centralized Logging]
        METRICS[Metrics Collection]
        ALERTS[Alert Manager]
    end
    
    LB --> SSL
    SSL --> APP1
    SSL --> APP2
    SSL --> APP3
    
    APP1 --> PRIMARY
    APP2 --> PRIMARY
    APP3 --> PRIMARY
    
    APP1 --> REPLICA
    APP2 --> REPLICA
    APP3 --> REPLICA
    
    APP1 --> REDIS_CLUSTER
    APP2 --> REDIS_CLUSTER
    APP3 --> REDIS_CLUSTER
    
    REDIS_CLUSTER --> QUEUE_WORKER1
    REDIS_CLUSTER --> QUEUE_WORKER2
    
    APP1 --> STRIPE_API
    APP1 --> TWILIO_API
    APP1 --> SMTP_SERVICE
    
    APP1 --> LOGS
    APP2 --> LOGS
    APP3 --> LOGS
    
    LOGS --> METRICS
    METRICS --> ALERTS
```

### **Container Architecture**

```mermaid
graph TB
    subgraph "Docker Containers"
        subgraph "Application"
            APP_CONTAINER[NestJS App Container]
            WORKER_CONTAINER[Queue Worker Container]
        end
        
        subgraph "Databases"
            POSTGRES_CONTAINER[PostgreSQL Container]
            REDIS_CONTAINER[Redis Container]
        end
        
        subgraph "Proxy"
            NGINX_CONTAINER[NGINX Container]
        end
    end
    
    subgraph "Docker Network"
        INTERNAL_NETWORK[Internal Network]
        EXTERNAL_NETWORK[External Network]
    end
    
    subgraph "Volumes"
        DB_VOLUME[Database Volume]
        LOG_VOLUME[Log Volume]
        UPLOAD_VOLUME[Upload Volume]
    end
    
    NGINX_CONTAINER --> APP_CONTAINER
    APP_CONTAINER --> POSTGRES_CONTAINER
    APP_CONTAINER --> REDIS_CONTAINER
    WORKER_CONTAINER --> REDIS_CONTAINER
    
    POSTGRES_CONTAINER --> DB_VOLUME
    APP_CONTAINER --> LOG_VOLUME
    APP_CONTAINER --> UPLOAD_VOLUME
    
    NGINX_CONTAINER -.-> EXTERNAL_NETWORK
    APP_CONTAINER -.-> INTERNAL_NETWORK
    POSTGRES_CONTAINER -.-> INTERNAL_NETWORK
    REDIS_CONTAINER -.-> INTERNAL_NETWORK
```

---

## 📊 **Performance Architecture**

### **Caching Strategy**

```mermaid
graph TB
    subgraph "Cache Layers"
        L1[Application Cache]
        L2[Redis Cache]
        L3[Database Cache]
    end
    
    subgraph "Cache Types"
        SESSION[Session Cache]
        QUERY[Query Cache]
        OBJECT[Object Cache]
        PAGE[Page Cache]
    end
    
    subgraph "Cache Policies"
        TTL[Time-to-Live]
        LRU[Least Recently Used]
        INVALIDATION[Cache Invalidation]
    end
    
    L1 --> SESSION
    L2 --> QUERY
    L2 --> OBJECT
    L3 --> PAGE
    
    SESSION --> TTL
    QUERY --> LRU
    OBJECT --> INVALIDATION
```

### **Scaling Strategy**

```mermaid
graph LR
    subgraph "Horizontal Scaling"
        LOAD_BALANCER[Load Balancer]
        APP_INSTANCES[Multiple App Instances]
        WORKER_INSTANCES[Multiple Workers]
    end
    
    subgraph "Vertical Scaling"
        CPU_SCALING[CPU Scaling]
        MEMORY_SCALING[Memory Scaling]
        STORAGE_SCALING[Storage Scaling]
    end
    
    subgraph "Database Scaling"
        READ_REPLICAS[Read Replicas]
        SHARDING[Database Sharding]
        CONNECTION_POOLING[Connection Pooling]
    end
    
    LOAD_BALANCER --> APP_INSTANCES
    APP_INSTANCES --> WORKER_INSTANCES
    
    CPU_SCALING --> MEMORY_SCALING
    MEMORY_SCALING --> STORAGE_SCALING
    
    READ_REPLICAS --> SHARDING
    SHARDING --> CONNECTION_POOLING
```

---

This architecture documentation provides a comprehensive overview of the system design, from high-level concepts to detailed implementation patterns. Each diagram illustrates key architectural decisions and their relationships within the overall system.

