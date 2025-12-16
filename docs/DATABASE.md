# 🗄️ Database Schema Documentation

## 📋 **Table of Contents**
- [Overview](#overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Core Entities](#core-entities)
- [Scheduling Entities](#scheduling-entities)
- [Notification Entities](#notification-entities)
- [Billing Entities](#billing-entities)
- [Enumerations](#enumerations)
- [Indexes and Performance](#indexes-and-performance)
- [Data Migration](#data-migration)

---

## 🌐 **Overview**

The SaaS School Management Platform uses PostgreSQL as the primary database with Prisma ORM for type-safe database access. The schema is designed with multi-tenancy in mind, ensuring complete data isolation between different organizations.

### **Key Design Principles**
- **Multi-tenant Architecture**: All data is isolated by tenant
- **Referential Integrity**: Comprehensive foreign key relationships
- **Audit Trail**: Created/updated timestamps on all entities
- **Soft Deletes**: Logical deletion for important entities
- **Performance**: Strategic indexing for query optimization
- **Scalability**: Designed to handle large datasets efficiently

---

## 🔗 **Entity Relationship Diagram**

```mermaid
erDiagram
    %% Core Entities
    TENANT ||--o{ SCHOOL : contains
    TENANT ||--o{ USER : belongs_to
    SCHOOL ||--o{ USER : employs
    
    %% Academic Structure
    SCHOOL ||--o{ SUBJECT : offers
    SCHOOL ||--o{ CLASS : has
    SCHOOL ||--o{ ROOM : contains
    
    %% Many-to-Many Relationships
    USER ||--o{ TEACHER_SUBJECT : teaches
    SUBJECT ||--o{ TEACHER_SUBJECT : taught_by
    SUBJECT ||--o{ CLASS_SUBJECT : assigned_to
    CLASS ||--o{ CLASS_SUBJECT : studies
    
    %% Scheduling
    SCHOOL ||--o{ TIME_SLOT : defines
    SCHOOL ||--o{ ACADEMIC_PERIOD : has
    SCHOOL ||--o{ SCHEDULE : creates
    ACADEMIC_PERIOD ||--o{ SCHEDULE : contains
    
    SCHEDULE ||--o{ SCHEDULE_SESSION : contains
    SCHEDULE ||--o{ SCHEDULE_CONFLICT : has
    
    SCHEDULE_SESSION }o--|| SUBJECT : for
    SCHEDULE_SESSION }o--|| CLASS : with
    SCHEDULE_SESSION }o--|| USER : taught_by
    SCHEDULE_SESSION }o--|| ROOM : in
    SCHEDULE_SESSION }o--|| TIME_SLOT : during
    
    %% Preferences and Rules
    SCHOOL ||--o{ SCHEDULING_PREFERENCE : defines
    SCHOOL ||--o{ SCHEDULING_RULE : enforces
    USER ||--o{ TEACHER_AVAILABILITY : available
    
    %% Authentication
    USER ||--o{ REFRESH_TOKEN : has
    
    TENANT {
        string id PK
        string name UK
        string subdomain UK
        string description
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    USER {
        string id PK
        string email UK
        string password
        string firstName
        string lastName
        UserRole role
        boolean isActive
        datetime lastLoginAt
        string tenantId FK
        string schoolId FK
        datetime createdAt
        datetime updatedAt
    }
    
    SCHOOL {
        string id PK
        string name
        string address
        string phone
        string email
        string website
        string description
        boolean isActive
        string tenantId FK
        datetime createdAt
        datetime updatedAt
    }
    
    SUBJECT {
        string id PK
        string name
        string code
        string description
        boolean isActive
        string schoolId FK
        datetime createdAt
        datetime updatedAt
    }
    
    CLASS {
        string id PK
        string name
        int grade
        string section
        int capacity
        int currentEnrollment
        boolean isActive
        string schoolId FK
        datetime createdAt
        datetime updatedAt
    }
    
    ROOM {
        string id PK
        string name
        RoomType type
        int capacity
        string floor
        string building
        string[] features
        boolean isActive
        string schoolId FK
        datetime createdAt
        datetime updatedAt
    }
    
    SCHEDULE {
        string id PK
        string schoolId FK
        string academicPeriodId FK
        string name
        string description
        datetime startDate
        datetime endDate
        ScheduleStatus status
        int version
        boolean isActive
        string createdBy FK
        string approvedBy FK
        datetime approvedAt
        float optimizationScore
        int conflictCount
        json metadata
        datetime createdAt
        datetime updatedAt
    }
    
    SCHEDULE_SESSION {
        string id PK
        string scheduleId FK
        string subjectId FK
        string classId FK
        string teacherId FK
        string roomId FK
        string timeSlotId FK
        datetime date
        int duration
        SessionType type
        SessionStatus status
        boolean isRecurring
        string recurrencePattern
        string notes
        json metadata
        datetime createdAt
        datetime updatedAt
    }
```

---

## 🏛️ **Core Entities**

### **Tenant**
Multi-tenant root entity that isolates all data.

```sql
CREATE TABLE tenants (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT UNIQUE NOT NULL,
    subdomain   TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_active ON tenants(is_active);
```

**Key Features:**
- Unique subdomain for tenant identification
- Soft delete capability with `is_active` flag
- Audit trail with timestamps

### **User**
Central user entity supporting multiple roles.

```sql
CREATE TABLE users (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password      TEXT NOT NULL,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    role          user_role NOT NULL,
    is_active     BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    school_id     TEXT REFERENCES schools(id) ON DELETE SET NULL,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
```

**Key Features:**
- Multi-role support (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, STUDENT)
- Tenant isolation through `tenant_id`
- Optional school association
- Login tracking with `last_login_at`

### **School**
Educational institution entity.

```sql
CREATE TABLE schools (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    address     TEXT,
    phone       TEXT,
    email       TEXT,
    website     TEXT,
    description TEXT,
    is_active   BOOLEAN DEFAULT true,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_schools_tenant ON schools(tenant_id);
CREATE INDEX idx_schools_active ON schools(is_active);
```

### **Subject**
Academic subject/course entity.

```sql
CREATE TABLE subjects (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    code        TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN DEFAULT true,
    school_id   TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subjects_school ON subjects(school_id);
CREATE INDEX idx_subjects_code ON subjects(school_id, code);
CREATE INDEX idx_subjects_active ON subjects(is_active);
```

### **Class**
Student class/grade entity.

```sql
CREATE TABLE classes (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    grade               INTEGER NOT NULL,
    section             TEXT,
    capacity            INTEGER NOT NULL,
    current_enrollment  INTEGER DEFAULT 0,
    is_active           BOOLEAN DEFAULT true,
    school_id           TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_classes_grade ON classes(grade);
CREATE INDEX idx_classes_active ON classes(is_active);
```

### **Room**
Physical classroom/facility entity.

```sql
CREATE TABLE rooms (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    type       room_type NOT NULL,
    capacity   INTEGER NOT NULL,
    floor      TEXT,
    building   TEXT,
    features   TEXT[] DEFAULT '{}',
    is_active  BOOLEAN DEFAULT true,
    school_id  TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rooms_school ON rooms(school_id);
CREATE INDEX idx_rooms_type ON rooms(type);
CREATE INDEX idx_rooms_capacity ON rooms(capacity);
CREATE INDEX idx_rooms_active ON rooms(is_active);
```

---

## 📅 **Scheduling Entities**

### **Time Slot**
Defines time periods for scheduling.

```sql
CREATE TABLE time_slots (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    day_of_week   INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time    TEXT NOT NULL, -- HH:mm format
    end_time      TEXT NOT NULL,  -- HH:mm format
    duration      INTEGER NOT NULL, -- minutes
    type          time_slot_type DEFAULT 'REGULAR',
    is_active     BOOLEAN DEFAULT true,
    order_index   INTEGER NOT NULL,
    max_sessions  INTEGER,
    metadata      JSONB,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_time_slots_school ON time_slots(school_id);
CREATE INDEX idx_time_slots_day ON time_slots(day_of_week);
CREATE INDEX idx_time_slots_order ON time_slots(school_id, day_of_week, order_index);
```

### **Academic Period**
Defines academic terms/semesters.

```sql
CREATE TABLE academic_periods (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id  TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    type       academic_period_type NOT NULL,
    is_active  BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_academic_periods_school ON academic_periods(school_id);
CREATE INDEX idx_academic_periods_dates ON academic_periods(start_date, end_date);
CREATE INDEX idx_academic_periods_active ON academic_periods(is_active);
```

### **Schedule**
Main scheduling entity containing generated timetables.

```sql
CREATE TABLE schedules (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id            TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_period_id   TEXT NOT NULL REFERENCES academic_periods(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    description          TEXT,
    start_date           DATE NOT NULL,
    end_date             DATE NOT NULL,
    status               schedule_status DEFAULT 'DRAFT',
    version              INTEGER DEFAULT 1,
    is_active            BOOLEAN DEFAULT false,
    created_by           TEXT NOT NULL REFERENCES users(id),
    approved_by          TEXT REFERENCES users(id),
    approved_at          TIMESTAMP,
    optimization_score   REAL, -- 0-100
    conflict_count       INTEGER DEFAULT 0,
    metadata             JSONB, -- generation metadata
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_schedules_school ON schedules(school_id);
CREATE INDEX idx_schedules_period ON schedules(academic_period_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_active ON schedules(is_active);
CREATE INDEX idx_schedules_creator ON schedules(created_by);
```

### **Schedule Session**
Individual class sessions within a schedule.

```sql
CREATE TABLE schedule_sessions (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id         TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    subject_id          TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id            TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id             TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    time_slot_id        TEXT NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    duration            INTEGER NOT NULL, -- minutes
    type                session_type DEFAULT 'REGULAR',
    status              session_status DEFAULT 'SCHEDULED',
    is_recurring        BOOLEAN DEFAULT false,
    recurrence_pattern  TEXT, -- cron-like pattern
    notes               TEXT,
    metadata            JSONB,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_schedule_sessions_schedule ON schedule_sessions(schedule_id);
CREATE INDEX idx_schedule_sessions_teacher ON schedule_sessions(teacher_id);
CREATE INDEX idx_schedule_sessions_room ON schedule_sessions(room_id);
CREATE INDEX idx_schedule_sessions_time_slot ON schedule_sessions(time_slot_id);
CREATE INDEX idx_schedule_sessions_date ON schedule_sessions(date);
CREATE INDEX idx_schedule_sessions_class ON schedule_sessions(class_id);
CREATE INDEX idx_schedule_sessions_subject ON schedule_sessions(subject_id);

-- Composite indexes for conflict detection
CREATE INDEX idx_sessions_teacher_time ON schedule_sessions(teacher_id, time_slot_id, date);
CREATE INDEX idx_sessions_room_time ON schedule_sessions(room_id, time_slot_id, date);
CREATE INDEX idx_sessions_class_time ON schedule_sessions(class_id, time_slot_id, date);
```

### **Schedule Conflict**
Tracks scheduling conflicts and violations.

```sql
CREATE TABLE schedule_conflicts (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id             TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    type                    conflict_type NOT NULL,
    severity                conflict_severity NOT NULL,
    description             TEXT NOT NULL,
    affected_session_ids    TEXT[] NOT NULL,
    suggested_resolution    TEXT,
    is_resolved             BOOLEAN DEFAULT false,
    resolution_notes        TEXT,
    resolved_by             TEXT,
    resolved_at             TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_schedule_conflicts_schedule ON schedule_conflicts(schedule_id);
CREATE INDEX idx_schedule_conflicts_type ON schedule_conflicts(type);
CREATE INDEX idx_schedule_conflicts_severity ON schedule_conflicts(severity);
CREATE INDEX idx_schedule_conflicts_resolved ON schedule_conflicts(is_resolved);
```

### **Scheduling Preference**
User and institutional scheduling preferences.

```sql
CREATE TABLE scheduling_preferences (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    type                preference_type NOT NULL,
    entity_id           TEXT NOT NULL, -- teacherId, roomId, etc.
    entity_type         entity_type NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    weight              INTEGER NOT NULL CHECK (weight >= 1 AND weight <= 10),
    is_hard_constraint  BOOLEAN DEFAULT false,
    parameters          JSONB NOT NULL, -- preference parameters
    is_active           BOOLEAN DEFAULT true,
    created_by          TEXT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scheduling_preferences_school ON scheduling_preferences(school_id);
CREATE INDEX idx_scheduling_preferences_type ON scheduling_preferences(type);
CREATE INDEX idx_scheduling_preferences_entity ON scheduling_preferences(entity_id);
CREATE INDEX idx_scheduling_preferences_active ON scheduling_preferences(is_active);
```

### **Scheduling Rule**
Institutional scheduling rules and policies.

```sql
CREATE TABLE scheduling_rules (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    type         rule_type NOT NULL,
    priority     INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 10),
    is_mandatory BOOLEAN DEFAULT false,
    conditions   JSONB NOT NULL, -- rule conditions
    actions      JSONB NOT NULL, -- actions when violated
    is_active    BOOLEAN DEFAULT true,
    created_by   TEXT NOT NULL REFERENCES users(id),
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scheduling_rules_school ON scheduling_rules(school_id);
CREATE INDEX idx_scheduling_rules_type ON scheduling_rules(type);
CREATE INDEX idx_scheduling_rules_priority ON scheduling_rules(priority);
CREATE INDEX idx_scheduling_rules_active ON scheduling_rules(is_active);
```

### **Teacher Availability**
Teacher availability windows and constraints.

```sql
CREATE TABLE teacher_availability (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week     INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time      TEXT NOT NULL, -- HH:mm format
    end_time        TEXT NOT NULL, -- HH:mm format
    type            availability_type NOT NULL,
    max_sessions    INTEGER,
    specific_date   DATE, -- for one-time changes
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_teacher_availability_teacher ON teacher_availability(teacher_id);
CREATE INDEX idx_teacher_availability_day ON teacher_availability(day_of_week);
CREATE INDEX idx_teacher_availability_dates ON teacher_availability(effective_from, effective_to);
CREATE INDEX idx_teacher_availability_active ON teacher_availability(is_active);
```

---

## 🔗 **Junction Tables**

### **Teacher Subject**
Many-to-many relationship between teachers and subjects.

```sql
CREATE TABLE teacher_subjects (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(teacher_id, subject_id)
);

-- Indexes
CREATE INDEX idx_teacher_subjects_teacher ON teacher_subjects(teacher_id);
CREATE INDEX idx_teacher_subjects_subject ON teacher_subjects(subject_id);
```

### **Class Subject**
Many-to-many relationship between classes and subjects.

```sql
CREATE TABLE class_subjects (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id   TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(class_id, subject_id)
);

-- Indexes
CREATE INDEX idx_class_subjects_class ON class_subjects(class_id);
CREATE INDEX idx_class_subjects_subject ON class_subjects(subject_id);
```

---

## 🔐 **Authentication Entities**

### **Refresh Token**
JWT refresh token management.

```sql
CREATE TABLE refresh_tokens (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

---

## 📊 **Enumerations**

### **User Role**
```sql
CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',
    'SCHOOL_ADMIN', 
    'TEACHER',
    'STUDENT'
);
```

### **Room Type**
```sql
CREATE TYPE room_type AS ENUM (
    'CLASSROOM',
    'LABORATORY',
    'AUDITORIUM',
    'CAFETERIA',
    'LIBRARY',
    'GYMNASIUM',
    'OFFICE',
    'OTHER'
);
```

### **Time Slot Type**
```sql
CREATE TYPE time_slot_type AS ENUM (
    'REGULAR',
    'BREAK',
    'LUNCH',
    'ASSEMBLY',
    'EXAM'
);
```

### **Schedule Status**
```sql
CREATE TYPE schedule_status AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'ACTIVE',
    'ARCHIVED'
);
```

### **Session Type**
```sql
CREATE TYPE session_type AS ENUM (
    'REGULAR',
    'EXAM',
    'LAB',
    'SPECIAL',
    'MAKEUP'
);
```

### **Session Status**
```sql
CREATE TYPE session_status AS ENUM (
    'SCHEDULED',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED'
);
```

### **Conflict Type**
```sql
CREATE TYPE conflict_type AS ENUM (
    'TEACHER_CONFLICT',
    'ROOM_CONFLICT',
    'TIME_CONFLICT',
    'CAPACITY_CONFLICT',
    'RESOURCE_CONFLICT'
);
```

### **Conflict Severity**
```sql
CREATE TYPE conflict_severity AS ENUM (
    'HIGH',
    'MEDIUM',
    'LOW'
);
```

### **Preference Type**
```sql
CREATE TYPE preference_type AS ENUM (
    'TEACHER_PREFERENCE',
    'ROOM_PREFERENCE',
    'TIME_PREFERENCE',
    'WORKLOAD_DISTRIBUTION',
    'SUBJECT_PREFERENCE',
    'CLASS_PREFERENCE'
);
```

### **Entity Type**
```sql
CREATE TYPE entity_type AS ENUM (
    'TEACHER',
    'ROOM',
    'SUBJECT',
    'CLASS',
    'SCHOOL'
);
```

### **Rule Type**
```sql
CREATE TYPE rule_type AS ENUM (
    'INSTITUTIONAL_POLICY',
    'TEACHER_AVAILABILITY',
    'ROOM_AVAILABILITY',
    'TIME_RESTRICTION',
    'WORKLOAD_LIMIT',
    'CONSECUTIVE_PERIODS'
);
```

### **Availability Type**
```sql
CREATE TYPE availability_type AS ENUM (
    'AVAILABLE',
    'PREFERRED',
    'UNAVAILABLE',
    'LIMITED'
);
```

### **Academic Period Type**
```sql
CREATE TYPE academic_period_type AS ENUM (
    'SEMESTER',
    'QUARTER',
    'TRIMESTER',
    'YEAR'
);
```

---

## 🚀 **Indexes and Performance**

### **Primary Indexes**
All tables have primary key indexes automatically created.

### **Foreign Key Indexes**
```sql
-- Tenant isolation indexes
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_schools_tenant ON schools(tenant_id);

-- School-based indexes
CREATE INDEX idx_subjects_school ON subjects(school_id);
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_rooms_school ON rooms(school_id);
CREATE INDEX idx_schedules_school ON schedules(school_id);

-- Performance-critical indexes
CREATE INDEX idx_schedule_sessions_schedule ON schedule_sessions(schedule_id);
CREATE INDEX idx_schedule_sessions_date ON schedule_sessions(date);
```

### **Composite Indexes**
```sql
-- Conflict detection optimization
CREATE INDEX idx_sessions_teacher_time ON schedule_sessions(teacher_id, time_slot_id, date);
CREATE INDEX idx_sessions_room_time ON schedule_sessions(room_id, time_slot_id, date);
CREATE INDEX idx_sessions_class_time ON schedule_sessions(class_id, time_slot_id, date);

-- Time slot ordering
CREATE INDEX idx_time_slots_order ON time_slots(school_id, day_of_week, order_index);

-- User lookup optimization
CREATE INDEX idx_users_email_tenant ON users(email, tenant_id);
```

### **Partial Indexes**
```sql
-- Active records only
CREATE INDEX idx_users_active ON users(tenant_id) WHERE is_active = true;
CREATE INDEX idx_schools_active ON schools(tenant_id) WHERE is_active = true;
CREATE INDEX idx_schedules_active ON schedules(school_id) WHERE is_active = true;

-- Unresolved conflicts
CREATE INDEX idx_conflicts_unresolved ON schedule_conflicts(schedule_id) WHERE is_resolved = false;
```

---

## 🔄 **Data Migration**

### **Migration Strategy**
1. **Schema Migrations**: Prisma handles schema changes
2. **Data Migrations**: Custom scripts for data transformations
3. **Rollback Support**: All migrations include rollback procedures
4. **Zero-Downtime**: Migrations designed for production deployment

### **Sample Migration**
```sql
-- Migration: Add optimization score to schedules
-- Up
ALTER TABLE schedules ADD COLUMN optimization_score REAL;
CREATE INDEX idx_schedules_optimization ON schedules(optimization_score);

-- Down
DROP INDEX idx_schedules_optimization;
ALTER TABLE schedules DROP COLUMN optimization_score;
```

### **Data Seeding**
```sql
-- Insert default tenant
INSERT INTO tenants (id, name, subdomain, description) 
VALUES ('default-tenant', 'Default Organization', 'default', 'Default tenant for development');

-- Insert super admin user
INSERT INTO users (id, email, password, first_name, last_name, role, tenant_id)
VALUES ('super-admin', 'admin@system.com', '$2b$12$...', 'System', 'Administrator', 'SUPER_ADMIN', 'default-tenant');
```

---

## 📈 **Performance Considerations**

### **Query Optimization**
- All tenant-based queries use `tenant_id` in WHERE clauses
- Composite indexes for common query patterns
- Partial indexes for filtered queries
- JSONB indexes for metadata queries

### **Connection Pooling**
```typescript
// Prisma connection pooling
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Connection pooling
  connection_limit = 20
  pool_timeout     = 60
}
```

### **Monitoring Queries**
```sql
-- Find slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'schedule_sessions';
```

---

This database schema provides a robust foundation for the SaaS School Management Platform, ensuring data integrity, performance, and scalability while maintaining strict multi-tenant isolation.

