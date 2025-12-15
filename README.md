# 🎓 SaaS School Management Platform

A comprehensive, enterprise-grade school management platform with intelligent scheduling, multi-tenant architecture, and advanced analytics.

## 🌟 **Overview**

This platform provides a complete solution for educational institutions to manage their operations efficiently. Built with modern technologies and best practices, it offers scalable, secure, and user-friendly tools for schools of all sizes.

## ✨ **Key Features**

### 🏗️ **Core Infrastructure**
- **Multi-tenant Architecture** - Complete tenant isolation with subdomain routing
- **JWT Authentication** - Secure token-based authentication with refresh tokens
- **Role-based Access Control** - 4 user roles (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, STUDENT)
- **RESTful API** - 130+ endpoints with comprehensive Swagger documentation
- **Database Management** - PostgreSQL with Prisma ORM and 24 data models

### 🧠 **Smart Scheduling Engine**
- **AI-Powered Optimization** - Google OR-Tools CP-SAT constraint programming solver
- **Intelligent Constraints** - 6 hard constraints + 6 soft constraints for optimal scheduling
- **Background Processing** - Bull Queue with Redis for scalable job processing
- **Conflict Detection** - Real-time conflict identification with resolution suggestions
- **Multi-Format Export** - PDF, Excel, CSV, and iCal calendar integration

### 📱 **Communication System**
- **Multi-Channel Notifications** - Email, SMS, and real-time in-app notifications
- **Email Templates** - Professional HTML email templates with dynamic content
- **SMS Integration** - Twilio-powered SMS delivery with usage tracking
- **WebSocket Real-time** - Live notifications with JWT authentication
- **Template Engine** - Customizable notification templates with variables

### 💳 **Billing & Subscriptions**
- **Stripe Integration** - Secure payment processing with webhook support
- **Flexible Plans** - Starter, Professional, and Enterprise subscription tiers
- **Usage Tracking** - Real-time monitoring of resource consumption
- **Invoice Management** - Automated billing with detailed invoicing
- **Limit Enforcement** - Automatic enforcement of subscription limits

### 📊 **Analytics & Reporting**
- **Dashboard Metrics** - Real-time insights into system usage and performance
- **Usage Analytics** - Detailed statistics on user engagement and system utilization
- **Scheduling Analytics** - Performance metrics for scheduling optimization
- **Custom Reports** - Flexible reporting with multiple export formats
- **System Health** - Comprehensive monitoring of system performance

## 🏛️ **Architecture**

### **Technology Stack**
- **Backend**: Node.js, NestJS, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for sessions and job queues
- **Queue**: Bull Queue for background processing
- **Solver**: Google OR-Tools CP-SAT (Python integration)
- **Payments**: Stripe for subscription management
- **Notifications**: Nodemailer (Email), Twilio (SMS), Socket.io (WebSocket)

### **Design Patterns**
- **Clean Architecture** - Separation of concerns with service layers
- **Repository Pattern** - Data access abstraction
- **Factory Pattern** - Object creation and configuration
- **Observer Pattern** - Event-driven notifications
- **Strategy Pattern** - Multiple solving algorithms

## 📁 **Project Structure**

```
backend/
├── src/
│   ├── auth/                 # Authentication & authorization
│   ├── users/                # User management
│   ├── tenant/               # Multi-tenant support
│   ├── schools/              # School management
│   ├── subjects/             # Subject management
│   ├── classes/              # Class management
│   ├── rooms/                # Room management
│   ├── scheduling/           # Smart scheduling engine
│   │   ├── services/         # Core scheduling services
│   │   ├── solver/           # OR-Tools integration
│   │   ├── constraints/      # Constraint implementations
│   │   └── processors/       # Background job processing
│   ├── notifications/        # Multi-channel notifications
│   │   ├── services/         # Email, SMS, WebSocket services
│   │   ├── processors/       # Background notification processing
│   │   └── controllers/      # Notification API endpoints
│   ├── billing/              # Subscription & payment management
│   │   ├── services/         # Billing, Stripe, subscription services
│   │   └── controllers/      # Billing API endpoints
│   ├── analytics/            # Analytics & reporting
│   │   ├── services/         # Analytics and dashboard services
│   │   └── controllers/      # Analytics API endpoints
│   ├── common/               # Shared utilities and middleware
│   └── database/             # Database configuration and migrations
├── scripts/                  # Python OR-Tools solver scripts
├── prisma/                   # Database schema and migrations
└── docs/                     # API documentation and guides
```

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js 18+ and npm/yarn
- PostgreSQL 13+
- Redis 6+
- Python 3.8+ (for OR-Tools solver)

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/abdoElHodaky/sasscolmng.git
   cd sasscolmng/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Install Python dependencies**
   ```bash
   pip install ortools
   ```

4. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Database setup**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

6. **Start the application**
   ```bash
   # Development
   npm run start:dev
   
   # Production
   npm run build
   npm run start:prod
   ```

### **Environment Variables**

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/sasscolmng_dev"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="24h"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="noreply@sasscolmng.com"

# SMS (Twilio)
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="your-twilio-phone-number"

# Payments (Stripe)
STRIPE_SECRET_KEY="sk_test_your-stripe-secret-key"
STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret"
```

## 📚 **API Documentation**

### **Authentication**
All API endpoints require JWT authentication except for login and registration.

```bash
# Login
POST /api/v1/auth/login
{
  "email": "admin@school.com",
  "password": "password"
}

# Response
{
  "user": { ... },
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token"
}
```

### **Core Endpoints**

#### **Schools Management**
```bash
GET    /api/v1/schools           # List schools
POST   /api/v1/schools           # Create school
GET    /api/v1/schools/:id       # Get school details
PUT    /api/v1/schools/:id       # Update school
DELETE /api/v1/schools/:id       # Delete school
```

#### **Scheduling**
```bash
GET    /api/v1/scheduling/schedules              # List schedules
POST   /api/v1/scheduling/schedules              # Create schedule
POST   /api/v1/scheduling/schedules/:id/generate # Generate schedule
GET    /api/v1/scheduling/schedules/:id/export   # Export schedule
```

#### **Notifications**
```bash
POST   /api/v1/notifications/send                # Send notification
POST   /api/v1/notifications/send/bulk          # Send bulk notifications
GET    /api/v1/notifications/templates          # Get templates
```

#### **Analytics**
```bash
GET    /api/v1/analytics/dashboard              # Dashboard metrics
GET    /api/v1/analytics/usage                  # Usage statistics
GET    /api/v1/analytics/scheduling             # Scheduling analytics
```

### **WebSocket Events**

Connect to `/notifications` namespace with JWT token:

```javascript
const socket = io('/notifications', {
  auth: { token: 'your-jwt-token' }
});

// Listen for notifications
socket.on('notification', (data) => {
  console.log('New notification:', data);
});

// Join specific rooms
socket.emit('join-room', 'teachers');
socket.emit('join-room', 'school-123');
```

## 🔧 **Configuration**

### **Subscription Plans**

| Plan | Price | Schools | Users | Students | Features |
|------|-------|---------|-------|----------|----------|
| **Starter** | $29.99/month | 1 | 50 | 500 | Basic scheduling, Email support |
| **Professional** | $79.99/month | 3 | 200 | 2,000 | Advanced scheduling, SMS, Priority support |
| **Enterprise** | $199.99/month | Unlimited | Unlimited | Unlimited | Full features, 24/7 support, API access |

### **Scheduling Constraints**

#### **Hard Constraints** (Must be satisfied)
1. **Teacher Conflict** - Teacher can't be in multiple places
2. **Room Conflict** - Room can't host multiple sessions
3. **Class Conflict** - Class can't attend multiple sessions
4. **Teacher Availability** - Respect teacher availability windows
5. **Room Capacity** - Don't exceed room capacity
6. **Time Slot Validity** - Use only valid time slots

#### **Soft Constraints** (Optimization goals)
1. **Teacher Preferences** - Prefer teacher's preferred time slots
2. **Room Preferences** - Match subjects to appropriate room types
3. **Workload Distribution** - Balance teacher workloads
4. **Time Preferences** - Optimize for preferred scheduling patterns
5. **Subject Preferences** - Consider subject-specific requirements
6. **Consecutive Periods** - Minimize gaps in schedules

## 🔒 **Security**

### **Authentication & Authorization**
- JWT tokens with configurable expiration
- Refresh token rotation for enhanced security
- Role-based access control with 4 user levels
- Multi-tenant data isolation

### **Data Protection**
- Input validation on all endpoints
- SQL injection prevention with Prisma ORM
- Rate limiting to prevent abuse
- Secure password hashing with bcrypt

### **API Security**
- CORS configuration for cross-origin requests
- Helmet.js for security headers
- Request throttling and rate limiting
- Comprehensive error handling without data leakage

## 📈 **Performance**

### **Optimization Features**
- **Background Processing** - Heavy operations run asynchronously
- **Caching** - Redis caching for frequently accessed data
- **Database Optimization** - Efficient queries with proper indexing
- **Connection Pooling** - Optimized database connections

### **Scalability**
- **Horizontal Scaling** - Stateless architecture supports load balancing
- **Queue Management** - Bull Queue handles high-volume job processing
- **Multi-tenant** - Single instance serves multiple organizations
- **Microservice Ready** - Modular architecture for easy service separation

## 🧪 **Testing**

```bash
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## 📦 **Deployment**

### **Docker Deployment**
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

### **Environment Setup**
```bash
# Production environment
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://user:pass@db:5432/sasscolmng_prod"
REDIS_HOST="redis"
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 **Support**

- **Documentation**: [API Docs](http://localhost:3000/api/docs)
- **Issues**: [GitHub Issues](https://github.com/abdoElHodaky/sasscolmng/issues)
- **Email**: support@sasscolmng.com

## 🎯 **Roadmap**

### **Phase 4: Frontend Development**
- React/Vue.js dashboard
- Mobile-responsive design
- Real-time updates
- Interactive scheduling interface

### **Phase 5: Mobile Applications**
- iOS and Android apps
- Push notifications
- Offline capabilities
- Parent/student portals

### **Phase 6: Advanced Features**
- Machine learning for predictive scheduling
- Advanced analytics and insights
- Third-party integrations
- Custom workflow automation

---

## 📊 **Project Statistics**

- **58+ Files** - Comprehensive codebase
- **8,500+ Lines** - TypeScript implementation
- **130+ API Endpoints** - Complete REST API
- **24 Database Models** - Comprehensive data modeling
- **13 Enums** - Type-safe enumerations
- **100% Feature Complete** - Production-ready

**Built with ❤️ for educational institutions worldwide**

