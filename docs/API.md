# 📡 API Documentation

## 📋 **Table of Contents**
- [Authentication](#authentication)
- [Core Endpoints](#core-endpoints)
- [Scheduling API](#scheduling-api)
- [Notifications API](#notifications-api)
- [Billing API](#billing-api)
- [Analytics API](#analytics-api)
- [WebSocket Events](#websocket-events)
- [Error Handling](#error-handling)

---

## 🔐 **Authentication**

### **Base URL**
```
https://api.sasscolmng.com/api/v1
```

### **Authentication Flow**

#### **Login**
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@school.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user_123",
    "email": "admin@school.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "SCHOOL_ADMIN",
    "tenantId": "tenant_456",
    "schoolId": "school_789"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### **Register**
```http
POST /auth/register
Content-Type: application/json

{
  "email": "newuser@school.com",
  "password": "securePassword123",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "TEACHER",
  "tenantId": "tenant_456",
  "schoolId": "school_789"
}
```

#### **Refresh Token**
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### **Logout**
```http
POST /auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### **Authorization Headers**
All protected endpoints require the JWT token in the Authorization header:
```http
Authorization: Bearer <access_token>
```

---

## 🏫 **Core Endpoints**

### **Tenants**

#### **Get Tenant Info**
```http
GET /tenants/current
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "tenant_456",
  "name": "Springfield School District",
  "subdomain": "springfield",
  "description": "Leading educational institution",
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

### **Schools**

#### **List Schools**
```http
GET /schools?page=1&limit=10&search=spring
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "school_789",
      "name": "Springfield Elementary",
      "address": "123 Main St, Springfield",
      "phone": "+1-555-0123",
      "email": "info@springfield.edu",
      "website": "https://springfield.edu",
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

#### **Create School**
```http
POST /schools
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "New Elementary School",
  "address": "456 Oak Ave, Springfield",
  "phone": "+1-555-0456",
  "email": "info@newschool.edu",
  "website": "https://newschool.edu",
  "description": "A new elementary school"
}
```

#### **Get School Details**
```http
GET /schools/school_789
Authorization: Bearer <access_token>
```

#### **Update School**
```http
PUT /schools/school_789
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Updated School Name",
  "phone": "+1-555-9999"
}
```

#### **Delete School**
```http
DELETE /schools/school_789
Authorization: Bearer <access_token>
```

### **Users**

#### **List Users**
```http
GET /users?role=TEACHER&schoolId=school_789&page=1&limit=20
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "user_123",
      "email": "teacher@school.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "TEACHER",
      "isActive": true,
      "lastLoginAt": "2024-01-15T09:30:00Z",
      "school": {
        "id": "school_789",
        "name": "Springfield Elementary"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

#### **Create User**
```http
POST /users
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "newteacher@school.com",
  "password": "temporaryPassword123",
  "firstName": "Alice",
  "lastName": "Johnson",
  "role": "TEACHER",
  "schoolId": "school_789"
}
```

### **Subjects**

#### **List Subjects**
```http
GET /subjects?schoolId=school_789
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "subject_101",
      "name": "Mathematics",
      "code": "MATH101",
      "description": "Basic mathematics for elementary students",
      "isActive": true,
      "schoolId": "school_789"
    }
  ]
}
```

#### **Create Subject**
```http
POST /subjects
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Science",
  "code": "SCI101",
  "description": "Elementary science curriculum",
  "schoolId": "school_789"
}
```

### **Classes**

#### **List Classes**
```http
GET /classes?schoolId=school_789&grade=5
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "class_201",
      "name": "5th Grade A",
      "grade": 5,
      "section": "A",
      "capacity": 30,
      "currentEnrollment": 28,
      "isActive": true,
      "schoolId": "school_789"
    }
  ]
}
```

#### **Create Class**
```http
POST /classes
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "6th Grade B",
  "grade": 6,
  "section": "B",
  "capacity": 25,
  "schoolId": "school_789"
}
```

### **Rooms**

#### **List Rooms**
```http
GET /rooms?schoolId=school_789&type=CLASSROOM
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "room_301",
      "name": "Room 101",
      "type": "CLASSROOM",
      "capacity": 30,
      "floor": "1st Floor",
      "building": "Main Building",
      "features": ["Projector", "Whiteboard", "Air Conditioning"],
      "isActive": true,
      "schoolId": "school_789"
    }
  ]
}
```

#### **Create Room**
```http
POST /rooms
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Science Lab 1",
  "type": "LABORATORY",
  "capacity": 20,
  "floor": "2nd Floor",
  "building": "Science Building",
  "features": ["Lab Equipment", "Safety Shower", "Fume Hood"],
  "schoolId": "school_789"
}
```

---

## 📅 **Scheduling API**

### **Time Slots**

#### **List Time Slots**
```http
GET /scheduling/time-slots?schoolId=school_789&dayOfWeek=1
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "timeslot_401",
      "name": "Period 1",
      "dayOfWeek": 1,
      "startTime": "08:00",
      "endTime": "08:45",
      "duration": 45,
      "type": "REGULAR",
      "isActive": true,
      "order": 1,
      "schoolId": "school_789"
    }
  ]
}
```

#### **Create Time Slot**
```http
POST /scheduling/time-slots
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Period 2",
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "09:45",
  "duration": 45,
  "type": "REGULAR",
  "order": 2,
  "schoolId": "school_789"
}
```

### **Schedules**

#### **List Schedules**
```http
GET /scheduling/schedules?schoolId=school_789&status=ACTIVE
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "schedule_501",
      "name": "Fall 2024 Schedule",
      "description": "Main schedule for fall semester",
      "startDate": "2024-09-01T00:00:00Z",
      "endDate": "2024-12-20T00:00:00Z",
      "status": "ACTIVE",
      "version": 1,
      "isActive": true,
      "optimizationScore": 87.5,
      "conflictCount": 2,
      "createdAt": "2024-08-15T10:00:00Z",
      "school": {
        "id": "school_789",
        "name": "Springfield Elementary"
      },
      "creator": {
        "id": "user_123",
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ]
}
```

#### **Create Schedule**
```http
POST /scheduling/schedules
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Spring 2025 Schedule",
  "description": "Schedule for spring semester",
  "startDate": "2025-01-15T00:00:00Z",
  "endDate": "2025-05-30T00:00:00Z",
  "schoolId": "school_789",
  "academicPeriodId": "period_601"
}
```

#### **Generate Schedule**
```http
POST /scheduling/schedules/schedule_501/generate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "optimizationLevel": "HIGH",
  "maxSolvingTimeSeconds": 300,
  "preferences": [
    {
      "type": "TEACHER_PREFERENCE",
      "entityId": "user_123",
      "weight": 8,
      "parameters": {
        "preferredTimeSlots": ["timeslot_401", "timeslot_402"],
        "avoidTimeSlots": ["timeslot_408"]
      }
    }
  ]
}
```

**Response:**
```json
{
  "jobId": "job_12345",
  "message": "Schedule generation started",
  "estimatedCompletionTime": "2024-01-15T10:05:00Z"
}
```

#### **Get Schedule Generation Status**
```http
GET /scheduling/schedules/jobs/job_12345/status
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "job_12345",
  "status": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "optimizationScore": 89.2,
    "conflictCount": 1,
    "sessionCount": 150,
    "solvingTime": 45.2
  },
  "completedAt": "2024-01-15T10:04:32Z"
}
```

#### **Export Schedule**
```http
GET /scheduling/schedules/schedule_501/export?format=pdf&type=full
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `format`: `pdf`, `excel`, `csv`, `ical`
- `type`: `full`, `teacher`, `class`, `room`
- `entityId`: Required for `teacher`, `class`, `room` types

### **Preferences**

#### **List Preferences**
```http
GET /scheduling/preferences?schoolId=school_789&type=TEACHER_PREFERENCE
Authorization: Bearer <access_token>
```

#### **Create Preference**
```http
POST /scheduling/preferences
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "type": "TEACHER_PREFERENCE",
  "entityId": "user_123",
  "entityType": "TEACHER",
  "name": "Morning Preference",
  "description": "Prefers morning time slots",
  "weight": 8,
  "isHardConstraint": false,
  "parameters": {
    "preferredTimeSlots": ["timeslot_401", "timeslot_402", "timeslot_403"],
    "maxConsecutivePeriods": 3
  },
  "schoolId": "school_789"
}
```

---

## 📢 **Notifications API**

### **Send Notifications**

#### **Send Single Notification**
```http
POST /notifications/send
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "type": "EMAIL",
  "recipients": ["teacher1@school.com", "teacher2@school.com"],
  "subject": "Schedule Update",
  "message": "Your schedule has been updated for next week.",
  "priority": "HIGH",
  "templateId": "schedule-updated",
  "templateData": {
    "scheduleName": "Fall 2024 Schedule",
    "effectiveDate": "2024-01-22"
  }
}
```

**Response:**
```json
{
  "jobId": "notify_67890",
  "message": "Notification queued successfully for 2 recipients"
}
```

#### **Send Bulk Notifications**
```http
POST /notifications/send/bulk
Authorization: Bearer <access_token>
Content-Type: application/json

[
  {
    "type": "EMAIL",
    "recipients": ["group1@school.com"],
    "subject": "Group 1 Update",
    "message": "Update for group 1"
  },
  {
    "type": "SMS",
    "recipients": ["+1-555-0123"],
    "message": "SMS update"
  }
]
```

#### **Send Schedule Notification**
```http
POST /notifications/schedule/schedule_501/notify
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "type": "ACTIVATED"
}
```

#### **Send User Notification**
```http
POST /notifications/user/user_123/notify
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "type": "WELCOME",
  "data": {
    "temporaryPassword": "temp123"
  }
}
```

### **Notification Management**

#### **Get Notification Templates**
```http
GET /notifications/templates
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": "schedule-created",
    "name": "Schedule Created",
    "type": "EMAIL",
    "subject": "New Schedule Created: {{scheduleName}}",
    "content": "<h2>New Schedule Created</h2><p>A new schedule \"{{scheduleName}}\" has been created...</p>",
    "variables": ["scheduleName", "schoolName", "creatorName"]
  }
]
```

#### **Get Job Status**
```http
GET /notifications/job/notify_67890/status
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "notify_67890",
  "status": "completed",
  "progress": 100,
  "data": {
    "type": "EMAIL",
    "recipients": 2
  },
  "processedOn": "2024-01-15T10:02:00Z",
  "finishedOn": "2024-01-15T10:02:15Z"
}
```

### **WebSocket Management**

#### **Get WebSocket Stats**
```http
GET /notifications/websocket/stats
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "connectedUsers": 45,
  "totalConnections": 67,
  "rooms": 12,
  "uptime": 86400
}
```

#### **Get Connected Users**
```http
GET /notifications/websocket/users
Authorization: Bearer <access_token>
```

#### **Disconnect User**
```http
POST /notifications/websocket/disconnect/user_123
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reason": "Administrative action"
}
```

### **Testing Endpoints**

#### **Send Test Email**
```http
POST /notifications/test/email
Authorization: Bearer <access_token>
```

#### **Send Test SMS**
```http
POST /notifications/test/sms
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "phoneNumber": "+1-555-0123"
}
```

---

## 💳 **Billing API**

### **Subscription Management**

#### **Get Billing Plans**
```http
GET /billing/plans
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": "starter",
    "name": "Starter",
    "description": "Perfect for small schools",
    "price": 29.99,
    "currency": "USD",
    "interval": "month",
    "features": [
      "Up to 1 school",
      "Up to 50 users",
      "Basic scheduling"
    ],
    "limits": {
      "maxSchools": 1,
      "maxUsers": 50,
      "maxStudents": 500,
      "maxSchedules": 10,
      "storageGB": 5
    },
    "isActive": true
  }
]
```

#### **Create Subscription**
```http
POST /billing/subscription
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "planId": "professional",
  "paymentMethodId": "pm_1234567890"
}
```

#### **Get Current Subscription**
```http
GET /billing/subscription
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "sub_1234567890",
  "tenantId": "tenant_456",
  "planId": "professional",
  "status": "active",
  "isActive": true,
  "currentPeriodStart": "2024-01-01T00:00:00Z",
  "currentPeriodEnd": "2024-02-01T00:00:00Z",
  "plan": {
    "id": "professional",
    "name": "Professional",
    "price": 79.99
  }
}
```

#### **Update Subscription**
```http
PUT /billing/subscription/sub_1234567890
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "planId": "enterprise"
}
```

#### **Cancel Subscription**
```http
DELETE /billing/subscription/sub_1234567890
Authorization: Bearer <access_token>
```

### **Billing Information**

#### **Get Invoices**
```http
GET /billing/invoices?limit=5
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": "inv_1234567890",
    "tenantId": "tenant_456",
    "subscriptionId": "sub_1234567890",
    "amount": 79.99,
    "currency": "USD",
    "status": "paid",
    "dueDate": "2024-01-01T00:00:00Z",
    "paidAt": "2024-01-01T10:30:00Z",
    "items": [
      {
        "id": "item_1",
        "description": "Professional Plan - January 2024",
        "quantity": 1,
        "unitPrice": 79.99,
        "amount": 79.99
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

#### **Get Usage Statistics**
```http
GET /billing/usage
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "tenantId": "tenant_456",
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "schoolCount": 2,
  "userCount": 85,
  "studentCount": 1250,
  "scheduleCount": 15,
  "storageUsedGB": 12.5,
  "apiCallsCount": 15420,
  "notificationsSent": 234
}
```

#### **Check Usage Limits**
```http
GET /billing/usage/limits
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "withinLimits": true,
  "violations": []
}
```

---

## 📊 **Analytics API**

### **Dashboard Metrics**

#### **Get Dashboard Overview**
```http
GET /analytics/dashboard
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "overview": {
    "schoolCount": 3,
    "userCount": 125,
    "studentCount": 1850,
    "teacherCount": 45,
    "scheduleCount": 8,
    "activeScheduleCount": 3
  },
  "growth": {
    "usersThisMonth": 15,
    "schedulesThisMonth": 2,
    "growthRate": 12.5
  },
  "utilization": {
    "scheduleUtilization": 85.2,
    "userEngagement": 78.9,
    "systemUptime": 99.8
  }
}
```

### **Usage Analytics**

#### **Get Usage Statistics**
```http
GET /analytics/usage?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "scheduleCreations": 5,
  "userLogins": 1250,
  "apiCalls": 15420,
  "notificationsSent": 234,
  "storageUsed": 12.5,
  "averageResponseTime": 145
}
```

### **Scheduling Analytics**

#### **Get Scheduling Performance**
```http
GET /analytics/scheduling
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "totalSchedules": 8,
  "activeSchedules": 3,
  "averageOptimizationScore": 87.3,
  "totalConflicts": 12,
  "totalSessions": 1250,
  "conflictRate": 0.96,
  "scheduleEfficiency": 87.3
}
```

### **User Analytics**

#### **Get User Engagement**
```http
GET /analytics/users
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "totalUsers": 125,
  "activeUsers": 118,
  "recentlyActiveUsers": 89,
  "roleDistribution": {
    "SUPER_ADMIN": 1,
    "SCHOOL_ADMIN": 4,
    "TEACHER": 45,
    "STUDENT": 75
  },
  "engagementRate": 71.2
}
```

### **System Health**

#### **Get System Health**
```http
GET /analytics/system/health
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "database": {
    "status": "healthy",
    "connectionCount": 10,
    "averageQueryTime": 25
  },
  "memory": {
    "used": 512.5,
    "total": 1024.0,
    "percentage": 50.1
  },
  "uptime": 86400,
  "version": "1.0.0",
  "environment": "production"
}
```

---

## 🔌 **WebSocket Events**

### **Connection**

Connect to the WebSocket server at `/notifications` namespace:

```javascript
const socket = io('wss://api.sasscolmng.com/notifications', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### **Client Events**

#### **Join Room**
```javascript
socket.emit('join-room', 'teachers');
socket.emit('join-room', 'school-789');
```

#### **Leave Room**
```javascript
socket.emit('leave-room', 'teachers');
```

#### **Ping**
```javascript
socket.emit('ping');
```

### **Server Events**

#### **Connection Confirmed**
```javascript
socket.on('connected', (data) => {
  console.log('Connected:', data);
  // {
  //   message: 'Connected to notification service',
  //   userId: 'user_123',
  //   timestamp: '2024-01-15T10:00:00Z'
  // }
});
```

#### **Notification Received**
```javascript
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
  // {
  //   type: 'SCHEDULE_ACTIVATED',
  //   title: 'Schedule Now Active',
  //   message: 'New schedule "Fall 2024" is now active',
  //   data: { scheduleId: 'schedule_501' },
  //   priority: 'HIGH',
  //   timestamp: '2024-01-15T10:00:00Z'
  // }
});
```

#### **Room Events**
```javascript
socket.on('room-joined', (data) => {
  console.log('Joined room:', data.room);
});

socket.on('room-left', (data) => {
  console.log('Left room:', data.room);
});
```

#### **Typing Indicators**
```javascript
socket.on('typing', (data) => {
  console.log('User typing:', data);
  // {
  //   userId: 'user_123',
  //   isTyping: true,
  //   timestamp: '2024-01-15T10:00:00Z'
  // }
});
```

#### **Force Disconnect**
```javascript
socket.on('force-disconnect', (data) => {
  console.log('Disconnected:', data.reason);
  // Handle forced disconnection
});
```

#### **Pong Response**
```javascript
socket.on('pong', (data) => {
  console.log('Pong received:', data.timestamp);
});
```

---

## ❌ **Error Handling**

### **Error Response Format**

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ],
    "timestamp": "2024-01-15T10:00:00Z",
    "path": "/api/v1/users",
    "requestId": "req_123456"
  }
}
```

### **HTTP Status Codes**

| Code | Description | Usage |
|------|-------------|-------|
| `200` | OK | Successful GET, PUT requests |
| `201` | Created | Successful POST requests |
| `204` | No Content | Successful DELETE requests |
| `400` | Bad Request | Invalid request data |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource conflict (duplicate) |
| `422` | Unprocessable Entity | Validation errors |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |

### **Common Error Codes**

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `AUTHENTICATION_FAILED` | Invalid credentials |
| `AUTHORIZATION_FAILED` | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `RESOURCE_CONFLICT` | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `TENANT_NOT_FOUND` | Tenant not found |
| `SCHOOL_NOT_FOUND` | School not found |
| `USER_NOT_FOUND` | User not found |
| `SCHEDULE_GENERATION_FAILED` | Schedule generation failed |
| `NOTIFICATION_FAILED` | Notification delivery failed |
| `BILLING_ERROR` | Billing operation failed |

### **Rate Limiting**

API requests are rate-limited per user:
- **Default**: 100 requests per minute
- **Authenticated**: 1000 requests per minute
- **Premium**: 5000 requests per minute

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
```

### **Pagination**

List endpoints support pagination:

**Request:**
```http
GET /users?page=2&limit=20
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

This API documentation provides comprehensive coverage of all endpoints, request/response formats, and integration patterns for the SaaS School Management Platform.

