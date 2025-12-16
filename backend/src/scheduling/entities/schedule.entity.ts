import { ApiProperty } from '@nestjs/swagger';

export class Schedule {
  @ApiProperty({ description: 'Unique identifier for the schedule' })
  id: string;

  @ApiProperty({ description: 'School this schedule belongs to' })
  schoolId: string;

  @ApiProperty({ description: 'Academic period this schedule covers' })
  academicPeriodId: string;

  @ApiProperty({ description: 'Name of the schedule' })
  name: string;

  @ApiProperty({ description: 'Description of the schedule' })
  description?: string;

  @ApiProperty({ description: 'Start date of the schedule' })
  startDate: Date;

  @ApiProperty({ description: 'End date of the schedule' })
  endDate: Date;

  @ApiProperty({ description: 'Current status of the schedule', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ARCHIVED'] })
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'ARCHIVED';

  @ApiProperty({ description: 'Version number of the schedule' })
  version: number;

  @ApiProperty({ description: 'Whether this is the current active schedule' })
  isActive: boolean;

  @ApiProperty({ description: 'User who created the schedule' })
  createdBy: string;

  @ApiProperty({ description: 'User who last approved the schedule' })
  approvedBy?: string;

  @ApiProperty({ description: 'Approval timestamp' })
  approvedAt?: Date;

  @ApiProperty({ description: 'Optimization score of the schedule (0-100)' })
  optimizationScore?: number;

  @ApiProperty({ description: 'Number of conflicts in the schedule' })
  conflictCount?: number;

  @ApiProperty({ description: 'Schedule generation metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class ScheduleSession {
  @ApiProperty({ description: 'Unique identifier for the session' })
  id: string;

  @ApiProperty({ description: 'Schedule this session belongs to' })
  scheduleId: string;

  @ApiProperty({ description: 'Subject being taught' })
  subjectId: string;

  @ApiProperty({ description: 'Class attending the session' })
  classId: string;

  @ApiProperty({ description: 'Teacher conducting the session' })
  teacherId: string;

  @ApiProperty({ description: 'Room where the session takes place' })
  roomId: string;

  @ApiProperty({ description: 'Time slot of the session' })
  timeSlotId: string;

  @ApiProperty({ description: 'Specific date of the session' })
  date: Date;

  @ApiProperty({ description: 'Duration in minutes' })
  duration: number;

  @ApiProperty({ description: 'Type of session', enum: ['REGULAR', 'EXAM', 'LAB', 'SPECIAL', 'MAKEUP'] })
  type: 'REGULAR' | 'EXAM' | 'LAB' | 'SPECIAL' | 'MAKEUP';

  @ApiProperty({ description: 'Current status of the session', enum: ['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] })
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

  @ApiProperty({ description: 'Whether this session is recurring' })
  isRecurring: boolean;

  @ApiProperty({ description: 'Recurrence pattern if applicable' })
  recurrencePattern?: string;

  @ApiProperty({ description: 'Notes or special instructions for the session' })
  notes?: string;

  @ApiProperty({ description: 'Session metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class ScheduleConflict {
  @ApiProperty({ description: 'Unique identifier for the conflict' })
  id: string;

  @ApiProperty({ description: 'Schedule this conflict belongs to' })
  scheduleId: string;

  @ApiProperty({ description: 'Type of conflict', enum: ['TEACHER_CONFLICT', 'ROOM_CONFLICT', 'TIME_CONFLICT', 'CAPACITY_CONFLICT', 'RESOURCE_CONFLICT'] })
  type: 'TEACHER_CONFLICT' | 'ROOM_CONFLICT' | 'TIME_CONFLICT' | 'CAPACITY_CONFLICT' | 'RESOURCE_CONFLICT';

  @ApiProperty({ description: 'Severity of the conflict', enum: ['HIGH', 'MEDIUM', 'LOW'] })
  severity: 'HIGH' | 'MEDIUM' | 'LOW';

  @ApiProperty({ description: 'Description of the conflict' })
  description: string;

  @ApiProperty({ description: 'Sessions involved in the conflict' })
  affectedSessionIds: string[];

  @ApiProperty({ description: 'Suggested resolution for the conflict' })
  suggestedResolution?: string;

  @ApiProperty({ description: 'Whether the conflict has been resolved' })
  isResolved: boolean;

  @ApiProperty({ description: 'Resolution notes' })
  resolutionNotes?: string;

  @ApiProperty({ description: 'User who resolved the conflict' })
  resolvedBy?: string;

  @ApiProperty({ description: 'Resolution timestamp' })
  resolvedAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

