import { ApiProperty } from '@nestjs/swagger';

export class SchedulingPreference {
  @ApiProperty({ description: 'Unique identifier for the preference' })
  id: string;

  @ApiProperty({ description: 'School this preference belongs to' })
  schoolId: string;

  @ApiProperty({ description: 'Type of preference', enum: ['TEACHER_PREFERENCE', 'ROOM_PREFERENCE', 'TIME_PREFERENCE', 'WORKLOAD_DISTRIBUTION', 'SUBJECT_PREFERENCE', 'CLASS_PREFERENCE'] })
  type: 'TEACHER_PREFERENCE' | 'ROOM_PREFERENCE' | 'TIME_PREFERENCE' | 'WORKLOAD_DISTRIBUTION' | 'SUBJECT_PREFERENCE' | 'CLASS_PREFERENCE';

  @ApiProperty({ description: 'Entity this preference applies to (teacherId, roomId, etc.)' })
  entityId: string;

  @ApiProperty({ description: 'Entity type', enum: ['TEACHER', 'ROOM', 'SUBJECT', 'CLASS', 'SCHOOL'] })
  entityType: 'TEACHER' | 'ROOM' | 'SUBJECT' | 'CLASS' | 'SCHOOL';

  @ApiProperty({ description: 'Name of the preference' })
  name: string;

  @ApiProperty({ description: 'Description of the preference' })
  description?: string;

  @ApiProperty({ description: 'Weight/priority of the preference (1-10)' })
  weight: number;

  @ApiProperty({ description: 'Whether this is a hard constraint or soft preference' })
  isHardConstraint: boolean;

  @ApiProperty({ description: 'Preference parameters as JSON' })
  parameters: Record<string, any>;

  @ApiProperty({ description: 'Whether this preference is active' })
  isActive: boolean;

  @ApiProperty({ description: 'User who created the preference' })
  createdBy: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class SchedulingRule {
  @ApiProperty({ description: 'Unique identifier for the rule' })
  id: string;

  @ApiProperty({ description: 'School this rule belongs to' })
  schoolId: string;

  @ApiProperty({ description: 'Name of the rule' })
  name: string;

  @ApiProperty({ description: 'Description of the rule' })
  description: string;

  @ApiProperty({ description: 'Type of rule', enum: ['INSTITUTIONAL_POLICY', 'TEACHER_AVAILABILITY', 'ROOM_AVAILABILITY', 'TIME_RESTRICTION', 'WORKLOAD_LIMIT', 'CONSECUTIVE_PERIODS'] })
  type: 'INSTITUTIONAL_POLICY' | 'TEACHER_AVAILABILITY' | 'ROOM_AVAILABILITY' | 'TIME_RESTRICTION' | 'WORKLOAD_LIMIT' | 'CONSECUTIVE_PERIODS';

  @ApiProperty({ description: 'Priority of the rule (1-10)' })
  priority: number;

  @ApiProperty({ description: 'Whether this rule is mandatory' })
  isMandatory: boolean;

  @ApiProperty({ description: 'Rule conditions and parameters' })
  conditions: Record<string, any>;

  @ApiProperty({ description: 'Actions to take when rule is violated' })
  actions: Record<string, any>;

  @ApiProperty({ description: 'Whether this rule is active' })
  isActive: boolean;

  @ApiProperty({ description: 'User who created the rule' })
  createdBy: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class TeacherAvailability {
  @ApiProperty({ description: 'Unique identifier for the availability record' })
  id: string;

  @ApiProperty({ description: 'Teacher this availability applies to' })
  teacherId: string;

  @ApiProperty({ description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)' })
  dayOfWeek: number;

  @ApiProperty({ description: 'Start time of availability in HH:mm format' })
  startTime: string;

  @ApiProperty({ description: 'End time of availability in HH:mm format' })
  endTime: string;

  @ApiProperty({ description: 'Type of availability', enum: ['AVAILABLE', 'PREFERRED', 'UNAVAILABLE', 'LIMITED'] })
  type: 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE' | 'LIMITED';

  @ApiProperty({ description: 'Maximum number of sessions during this time' })
  maxSessions?: number;

  @ApiProperty({ description: 'Specific date if this is a one-time availability change' })
  specificDate?: Date;

  @ApiProperty({ description: 'Start date for recurring availability' })
  effectiveFrom: Date;

  @ApiProperty({ description: 'End date for recurring availability' })
  effectiveTo?: Date;

  @ApiProperty({ description: 'Notes about the availability' })
  notes?: string;

  @ApiProperty({ description: 'Whether this availability is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

