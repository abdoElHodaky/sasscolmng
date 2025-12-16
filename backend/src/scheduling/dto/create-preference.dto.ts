import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsBoolean, IsOptional, IsDateString, Min, Max, Matches } from 'class-validator';

export class CreateSchedulingPreferenceDto {
  @ApiProperty({ description: 'School ID this preference belongs to' })
  @IsString()
  schoolId: string;

  @ApiProperty({ description: 'Type of preference', enum: ['TEACHER_PREFERENCE', 'ROOM_PREFERENCE', 'TIME_PREFERENCE', 'WORKLOAD_DISTRIBUTION', 'SUBJECT_PREFERENCE', 'CLASS_PREFERENCE'] })
  @IsEnum(['TEACHER_PREFERENCE', 'ROOM_PREFERENCE', 'TIME_PREFERENCE', 'WORKLOAD_DISTRIBUTION', 'SUBJECT_PREFERENCE', 'CLASS_PREFERENCE'])
  type: 'TEACHER_PREFERENCE' | 'ROOM_PREFERENCE' | 'TIME_PREFERENCE' | 'WORKLOAD_DISTRIBUTION' | 'SUBJECT_PREFERENCE' | 'CLASS_PREFERENCE';

  @ApiProperty({ description: 'Entity ID this preference applies to' })
  @IsString()
  entityId: string;

  @ApiProperty({ description: 'Entity type', enum: ['TEACHER', 'ROOM', 'SUBJECT', 'CLASS', 'SCHOOL'] })
  @IsEnum(['TEACHER', 'ROOM', 'SUBJECT', 'CLASS', 'SCHOOL'])
  entityType: 'TEACHER' | 'ROOM' | 'SUBJECT' | 'CLASS' | 'SCHOOL';

  @ApiProperty({ description: 'Name of the preference' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the preference', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Weight/priority of the preference (1-10)' })
  @IsNumber()
  @Min(1)
  @Max(10)
  weight: number;

  @ApiProperty({ description: 'Whether this is a hard constraint or soft preference' })
  @IsBoolean()
  isHardConstraint: boolean;

  @ApiProperty({ description: 'Preference parameters as JSON' })
  parameters: Record<string, any>;
}

export class UpdateSchedulingPreferenceDto {
  @ApiProperty({ description: 'Name of the preference', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Description of the preference', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Weight/priority of the preference (1-10)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  weight?: number;

  @ApiProperty({ description: 'Whether this is a hard constraint or soft preference', required: false })
  @IsOptional()
  @IsBoolean()
  isHardConstraint?: boolean;

  @ApiProperty({ description: 'Preference parameters as JSON', required: false })
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiProperty({ description: 'Whether this preference is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSchedulingRuleDto {
  @ApiProperty({ description: 'School ID this rule belongs to' })
  @IsString()
  schoolId: string;

  @ApiProperty({ description: 'Name of the rule' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the rule' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Type of rule', enum: ['INSTITUTIONAL_POLICY', 'TEACHER_AVAILABILITY', 'ROOM_AVAILABILITY', 'TIME_RESTRICTION', 'WORKLOAD_LIMIT', 'CONSECUTIVE_PERIODS'] })
  @IsEnum(['INSTITUTIONAL_POLICY', 'TEACHER_AVAILABILITY', 'ROOM_AVAILABILITY', 'TIME_RESTRICTION', 'WORKLOAD_LIMIT', 'CONSECUTIVE_PERIODS'])
  type: 'INSTITUTIONAL_POLICY' | 'TEACHER_AVAILABILITY' | 'ROOM_AVAILABILITY' | 'TIME_RESTRICTION' | 'WORKLOAD_LIMIT' | 'CONSECUTIVE_PERIODS';

  @ApiProperty({ description: 'Priority of the rule (1-10)' })
  @IsNumber()
  @Min(1)
  @Max(10)
  priority: number;

  @ApiProperty({ description: 'Whether this rule is mandatory' })
  @IsBoolean()
  isMandatory: boolean;

  @ApiProperty({ description: 'Rule conditions and parameters' })
  conditions: Record<string, any>;

  @ApiProperty({ description: 'Actions to take when rule is violated' })
  actions: Record<string, any>;
}

export class UpdateSchedulingRuleDto {
  @ApiProperty({ description: 'Name of the rule', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Description of the rule', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Priority of the rule (1-10)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiProperty({ description: 'Whether this rule is mandatory', required: false })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiProperty({ description: 'Rule conditions and parameters', required: false })
  @IsOptional()
  conditions?: Record<string, any>;

  @ApiProperty({ description: 'Actions to take when rule is violated', required: false })
  @IsOptional()
  actions?: Record<string, any>;

  @ApiProperty({ description: 'Whether this rule is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateTeacherAvailabilityDto {
  @ApiProperty({ description: 'Teacher ID this availability applies to' })
  @IsString()
  teacherId: string;

  @ApiProperty({ description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)' })
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Start time of availability in HH:mm format' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Start time must be in HH:mm format' })
  startTime: string;

  @ApiProperty({ description: 'End time of availability in HH:mm format' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'End time must be in HH:mm format' })
  endTime: string;

  @ApiProperty({ description: 'Type of availability', enum: ['AVAILABLE', 'PREFERRED', 'UNAVAILABLE', 'LIMITED'] })
  @IsEnum(['AVAILABLE', 'PREFERRED', 'UNAVAILABLE', 'LIMITED'])
  type: 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE' | 'LIMITED';

  @ApiProperty({ description: 'Maximum number of sessions during this time', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxSessions?: number;

  @ApiProperty({ description: 'Specific date if this is a one-time availability change', required: false })
  @IsOptional()
  @IsDateString()
  specificDate?: string;

  @ApiProperty({ description: 'Start date for recurring availability' })
  @IsDateString()
  effectiveFrom: string;

  @ApiProperty({ description: 'End date for recurring availability', required: false })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiProperty({ description: 'Notes about the availability', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTeacherAvailabilityDto {
  @ApiProperty({ description: 'Start time of availability in HH:mm format', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Start time must be in HH:mm format' })
  startTime?: string;

  @ApiProperty({ description: 'End time of availability in HH:mm format', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'End time must be in HH:mm format' })
  endTime?: string;

  @ApiProperty({ description: 'Type of availability', enum: ['AVAILABLE', 'PREFERRED', 'UNAVAILABLE', 'LIMITED'], required: false })
  @IsOptional()
  @IsEnum(['AVAILABLE', 'PREFERRED', 'UNAVAILABLE', 'LIMITED'])
  type?: 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE' | 'LIMITED';

  @ApiProperty({ description: 'Maximum number of sessions during this time', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxSessions?: number;

  @ApiProperty({ description: 'End date for recurring availability', required: false })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiProperty({ description: 'Notes about the availability', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Whether this availability is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

