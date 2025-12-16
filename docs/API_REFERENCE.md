# 📚 API Reference Documentation

## 📋 **Table of Contents**
- [Authentication](#authentication)
- [Billing & Subscriptions API](#billing--subscriptions-api)
- [Notification System API](#notification-system-api)
- [Scheduling API](#scheduling-api)
- [Analytics API](#analytics-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## 🔐 **Authentication**

All API endpoints require JWT authentication except for login and registration.

### **Login**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@school.com",
  "password": "password"
}
```

**Response:**
```json
{
  "user": {
    "id": "usr_123",
    "email": "admin@school.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "SCHOOL_ADMIN",
    "tenantId": "tenant_123",
    "schoolId": "school_123"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### **Using JWT Token**
Include the JWT token in the Authorization header:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 💳 **Billing & Subscriptions API**

### **Subscription Management**

#### **Create Subscription**
```http
POST /api/v1/billing/subscriptions
Content-Type: application/json
Authorization: Bearer {token}

{
  "planId": "plan_professional",
  "schoolId": "school_123",
  "billingCycle": "MONTHLY",
  "startTrial": true,
  "metadata": {
    "source": "web",
    "campaign": "spring2024"
  }
}
```

**Response:**
```json
{
  "id": "sub_123",
  "status": "TRIAL",
  "currentPeriodStart": "2024-01-01T00:00:00.000Z",
  "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
  "trialEnd": "2024-01-15T00:00:00.000Z",
  "plan": {
    "id": "plan_professional",
    "name": "Professional Plan",
    "type": "PROFESSIONAL",
    "monthlyPrice": 7999,
    "yearlyPrice": 79990
  },
  "stripeSubscriptionId": "sub_stripe_123"
}
```

#### **List Subscriptions**
```http
GET /api/v1/billing/subscriptions?page=1&limit=10&status=ACTIVE
Authorization: Bearer {token}
```

**Response:**
```json
{
  "subscriptions": [
    {
      "id": "sub_123",
      "status": "ACTIVE",
      "plan": {
        "name": "Professional Plan",
        "monthlyPrice": 7999
      },
      "currentPeriodEnd": "2024-02-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

#### **Update Subscription**
```http
PUT /api/v1/billing/subscriptions/sub_123
Content-Type: application/json
Authorization: Bearer {token}

{
  "planId": "plan_enterprise",
  "billingCycle": "YEARLY",
  "cancelAtPeriodEnd": false
}
```

#### **Cancel Subscription**
```http
DELETE /api/v1/billing/subscriptions/sub_123
Content-Type: application/json
Authorization: Bearer {token}

{
  "immediately": false,
  "reason": "Customer requested cancellation",
  "metadata": {
    "feedback": "Too expensive",
    "rating": 3
  }
}
```

#### **Change Subscription Plan**
```http
PUT /api/v1/billing/subscriptions/sub_123/change-plan
Content-Type: application/json
Authorization: Bearer {token}

{
  "newPlanId": "plan_enterprise",
  "prorate": true,
  "effectiveDate": "2024-01-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "subscription": {
    "id": "sub_123",
    "status": "ACTIVE",
    "planId": "plan_enterprise",
    "billingCycle": "MONTHLY"
  },
  "proration": {
    "amount": 2000,
    "currency": "USD",
    "description": "Plan change from Professional to Enterprise"
  }
}
```

### **Payment Processing**

#### **Process Payment**
```http
POST /api/v1/billing/payments
Content-Type: application/json
Authorization: Bearer {token}

{
  "subscriptionId": "sub_123",
  "invoiceId": "inv_123",
  "amount": 7999,
  "currency": "USD",
  "paymentMethod": "card",
  "stripePaymentMethodId": "pm_123"
}
```

#### **Refund Payment**
```http
POST /api/v1/billing/payments/pay_123/refund
Content-Type: application/json
Authorization: Bearer {token}

{
  "amount": 3999,
  "reason": "Customer requested partial refund"
}
```

### **Invoice Management**

#### **Create Invoice**
```http
POST /api/v1/billing/invoices
Content-Type: application/json
Authorization: Bearer {token}

{
  "subscriptionId": "sub_123",
  "billingPeriodStart": "2024-01-01T00:00:00.000Z",
  "billingPeriodEnd": "2024-02-01T00:00:00.000Z",
  "dueDate": "2024-01-15T00:00:00.000Z",
  "lineItems": [
    {
      "description": "Professional Plan - Monthly",
      "quantity": 1,
      "unitPrice": 7999,
      "amount": 7999
    }
  ],
  "taxAmount": 800,
  "discountAmount": 0
}
```

#### **Get Invoice PDF**
```http
GET /api/v1/billing/invoices/inv_123/pdf
Authorization: Bearer {token}
```

### **Billing Analytics**

#### **Revenue Metrics**
```http
GET /api/v1/billing/analytics/revenue?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer {token}
```

**Response:**
```json
{
  "totalRevenue": 125000,
  "monthlyRecurringRevenue": 45000,
  "annualRecurringRevenue": 540000,
  "averageRevenuePerUser": 7999,
  "revenueGrowthRate": 15.5,
  "currency": "USD"
}
```

#### **Subscription Analytics**
```http
GET /api/v1/billing/analytics/subscriptions
Authorization: Bearer {token}
```

**Response:**
```json
{
  "totalActiveSubscriptions": 150,
  "newSubscriptions": 25,
  "canceledSubscriptions": 5,
  "churnRate": 3.3,
  "subscriptionGrowthRate": 13.3,
  "subscriptionsByPlan": {
    "STARTER": 50,
    "PROFESSIONAL": 75,
    "ENTERPRISE": 25
  },
  "trialConversionRate": 65.5
}
```

---

## 📱 **Notification System API**

### **Core Notification Sending**

#### **Send Single Notification**
```http
POST /api/v1/notifications/send
Content-Type: application/json
Authorization: Bearer {token}

{
  "type": "EMAIL",
  "priority": "NORMAL",
  "recipientId": "usr_123",
  "templateId": "tpl_welcome",
  "subject": "Welcome to our platform!",
  "content": "Welcome {{firstName}}! Your account is ready.",
  "variables": {
    "firstName": "John"
  },
  "scheduledFor": "2024-01-01T12:00:00.000Z"
}
```

#### **Send Bulk Notifications**
```http
POST /api/v1/notifications/bulk
Content-Type: application/json
Authorization: Bearer {token}

{
  "templateId": "tpl_announcement",
  "recipientIds": ["usr_123", "usr_456", "usr_789"],
  "subject": "Important Announcement",
  "content": "Dear {{firstName}}, we have an important update...",
  "variables": {
    "announcement": "System maintenance scheduled"
  }
}
```

### **Notification History Management**

#### **Get Notification History**
```http
GET /api/v1/notifications/history?page=1&limit=20&type=EMAIL&status=DELIVERED&search=invoice
Authorization: Bearer {token}
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "not_123",
      "type": "EMAIL",
      "priority": "NORMAL",
      "status": "DELIVERED",
      "subject": "Your invoice is ready",
      "content": "Your monthly invoice for $79.99 is now available.",
      "recipientEmail": "user@example.com",
      "sentAt": "2024-01-01T12:00:00.000Z",
      "deliveredAt": "2024-01-01T12:01:00.000Z",
      "readAt": "2024-01-01T12:05:00.000Z",
      "retryCount": 0,
      "createdAt": "2024-01-01T11:59:00.000Z",
      "template": {
        "id": "tpl_invoice",
        "name": "Invoice Ready",
        "type": "INVOICE"
      }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

#### **Mark Notification as Read**
```http
PUT /api/v1/notifications/history/not_123/read
Authorization: Bearer {token}
```

#### **Bulk Mark as Read**
```http
PUT /api/v1/notifications/history/read
Content-Type: application/json
Authorization: Bearer {token}

{
  "notificationIds": ["not_123", "not_456", "not_789"]
}
```

**Response:**
```json
{
  "updated": 3
}
```

#### **Get Unread Count**
```http
GET /api/v1/notifications/unread-count
Authorization: Bearer {token}
```

**Response:**
```json
{
  "count": 5
}
```

#### **Get Notification Statistics**
```http
GET /api/v1/notifications/history-stats?startDate=2024-01-01&endDate=2024-12-31&groupBy=day
Authorization: Bearer {token}
```

**Response:**
```json
{
  "totalNotifications": 1500,
  "sentNotifications": 1450,
  "deliveredNotifications": 1400,
  "failedNotifications": 50,
  "readNotifications": 1200,
  "deliveryRate": 96.55,
  "readRate": 85.71,
  "byType": {
    "EMAIL": 800,
    "SMS": 200,
    "PUSH": 400,
    "WEBSOCKET": 100
  },
  "byStatus": {
    "PENDING": 50,
    "SENT": 50,
    "DELIVERED": 1200,
    "FAILED": 50,
    "READ": 1200
  },
  "recentActivity": [
    {
      "date": "2024-01-01",
      "sent": 45,
      "delivered": 43,
      "failed": 2
    }
  ]
}
```

### **User Notification Preferences**

#### **Get User Preferences**
```http
GET /api/v1/notifications/preferences?notificationType=EMAIL&templateType=INVOICE
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "pref_123",
    "notificationType": "EMAIL",
    "templateType": "INVOICE",
    "isEnabled": true,
    "deliveryChannels": ["email", "push"],
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "timezone": "America/New_York",
    "frequency": "immediate",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
]
```

#### **Create/Update Preference**
```http
POST /api/v1/notifications/preferences
Content-Type: application/json
Authorization: Bearer {token}

{
  "notificationType": "EMAIL",
  "templateType": "INVOICE",
  "isEnabled": true,
  "deliveryChannels": ["email", "push"],
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00",
  "timezone": "America/New_York",
  "frequency": "immediate"
}
```

#### **Bulk Update Preferences**
```http
PUT /api/v1/notifications/preferences/bulk
Content-Type: application/json
Authorization: Bearer {token}

{
  "preferences": [
    {
      "notificationType": "EMAIL",
      "isEnabled": true,
      "deliveryChannels": ["email"],
      "frequency": "immediate"
    },
    {
      "notificationType": "SMS",
      "isEnabled": false,
      "deliveryChannels": ["sms"],
      "frequency": "immediate"
    }
  ]
}
```

#### **Reset Preferences to Defaults**
```http
POST /api/v1/notifications/preferences/reset
Authorization: Bearer {token}
```

#### **Check Notification Eligibility**
```http
GET /api/v1/notifications/preferences/check-eligibility?notificationType=EMAIL&templateType=INVOICE&deliveryChannel=email
Authorization: Bearer {token}
```

**Response:**
```json
{
  "shouldReceive": true,
  "allowedChannels": ["email", "push"],
  "reason": null
}
```

### **Template Management**

#### **Get Templates**
```http
GET /api/v1/notifications/templates?type=INVOICE&isActive=true
Authorization: Bearer {token}
```

#### **Create Template**
```http
POST /api/v1/notifications/templates
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Welcome Email",
  "type": "WELCOME",
  "subject": "Welcome to {{companyName}}!",
  "content": "Hello {{firstName}}, welcome to our platform!",
  "variables": ["firstName", "companyName"],
  "isActive": true
}
```

### **Admin Analytics**

#### **Tenant-wide Statistics**
```http
GET /api/v1/notifications/admin/stats?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer {token}
```

#### **Preferences Summary**
```http
GET /api/v1/notifications/admin/preferences-summary
Authorization: Bearer {token}
```

**Response:**
```json
{
  "totalUsers": 150,
  "enabledByType": {
    "EMAIL": 140,
    "SMS": 50,
    "PUSH": 120,
    "WEBSOCKET": 100,
    "IN_APP": 145
  },
  "channelPreferences": {
    "email": 140,
    "sms": 50,
    "push": 120,
    "websocket": 100
  },
  "frequencyPreferences": {
    "immediate": 120,
    "daily_digest": 25,
    "weekly_digest": 5
  }
}
```

---

## 📅 **Scheduling API**

### **Schedule Management**

#### **Create Schedule**
```http
POST /api/v1/scheduling/schedules
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Spring 2024 Schedule",
  "schoolId": "school_123",
  "academicPeriodId": "period_123",
  "startDate": "2024-01-15",
  "endDate": "2024-05-15",
  "constraints": {
    "maxDailyHours": 8,
    "minBreakTime": 15,
    "preferredStartTime": "08:00"
  }
}
```

#### **Generate Schedule**
```http
POST /api/v1/scheduling/schedules/sch_123/generate
Content-Type: application/json
Authorization: Bearer {token}

{
  "algorithm": "CP_SAT",
  "maxSolveTime": 300,
  "optimizationLevel": "BALANCED"
}
```

#### **Export Schedule**
```http
GET /api/v1/scheduling/schedules/sch_123/export?format=PDF&includeDetails=true
Authorization: Bearer {token}
```

---

## 📊 **Analytics API**

### **Dashboard Metrics**
```http
GET /api/v1/analytics/dashboard
Authorization: Bearer {token}
```

**Response:**
```json
{
  "users": {
    "total": 1250,
    "active": 1100,
    "newThisMonth": 85
  },
  "subscriptions": {
    "total": 150,
    "active": 140,
    "trial": 10
  },
  "revenue": {
    "thisMonth": 125000,
    "lastMonth": 108000,
    "growth": 15.7
  },
  "notifications": {
    "sent": 5420,
    "delivered": 5200,
    "deliveryRate": 95.9
  }
}
```

### **Usage Statistics**
```http
GET /api/v1/analytics/usage?period=30d&groupBy=day
Authorization: Bearer {token}
```

---

## ❌ **Error Handling**

### **Error Response Format**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "email",
      "message": "Email must be a valid email address"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```

### **Common HTTP Status Codes**
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## 🚦 **Rate Limiting**

### **Rate Limit Headers**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### **Rate Limit Tiers**
- **GENEROUS**: 1000 requests/hour
- **STANDARD**: 500 requests/hour
- **STRICT**: 100 requests/hour
- **BULK**: 50 requests/hour

---

## 💡 **Examples**

### **Complete Subscription Flow**

1. **Create a subscription with trial:**
```bash
curl -X POST "https://api.sasscolmng.com/api/v1/billing/subscriptions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "plan_professional",
    "schoolId": "school_123",
    "billingCycle": "MONTHLY",
    "startTrial": true
  }'
```

2. **Track usage:**
```bash
curl -X POST "https://api.sasscolmng.com/api/v1/billing/usage" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub_123",
    "metricType": "STUDENTS",
    "value": 150
  }'
```

3. **Generate invoice:**
```bash
curl -X POST "https://api.sasscolmng.com/api/v1/billing/invoices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub_123",
    "billingPeriodStart": "2024-01-01T00:00:00.000Z",
    "billingPeriodEnd": "2024-02-01T00:00:00.000Z"
  }'
```

### **Complete Notification Flow**

1. **Set user preferences:**
```bash
curl -X POST "https://api.sasscolmng.com/api/v1/notifications/preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationType": "EMAIL",
    "isEnabled": true,
    "deliveryChannels": ["email", "push"],
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00"
  }'
```

2. **Send notification:**
```bash
curl -X POST "https://api.sasscolmng.com/api/v1/notifications/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "EMAIL",
    "recipientId": "usr_123",
    "subject": "Your invoice is ready",
    "content": "Hello {{firstName}}, your invoice is ready for download."
  }'
```

3. **Check delivery status:**
```bash
curl -X GET "https://api.sasscolmng.com/api/v1/notifications/history?userId=usr_123&limit=1" \
  -H "Authorization: Bearer $TOKEN"
```

---

For more detailed API documentation, visit the interactive Swagger UI at:
**https://api.sasscolmng.com/api/docs**
