import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, IsEnum, IsOptional, IsNumber, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScheduleDto {
  @ApiProperty({ description: 'School ID this schedule belongs to' })
  @IsString()
  schoolId: string;

  @ApiProperty({ description: 'Academic period ID this schedule covers' })
  @IsString()
  academicPeriodId: string;

  @ApiProperty({ description: 'Name of the schedule' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the schedule', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Start date of the schedule' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date of the schedule' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Schedule generation metadata', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateScheduleDto {
  @ApiProperty({ description: 'Name of the schedule', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Description of the schedule', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Start date of the schedule', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'End date of the schedule', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Current status of the schedule', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ARCHIVED'], required: false })
  @IsOptional()
  @IsEnum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ARCHIVED'])
  status?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'ARCHIVED';

  @ApiProperty({ description: 'Schedule generation metadata', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateScheduleSessionDto {
  @ApiProperty({ description: 'Schedule ID this session belongs to' })
  @IsString()
  scheduleId: string;

  @ApiProperty({ description: 'Subject ID being taught' })
  @IsString()
  subjectId: string;

  @ApiProperty({ description: 'Class ID attending the session' })
  @IsString()
  classId: string;

  @ApiProperty({ description: 'Teacher ID conducting the session' })
  @IsString()
  teacherId: string;

  @ApiProperty({ description: 'Room ID where the session takes place' })
  @IsString()
  roomId: string;

  @ApiProperty({ description: 'Time slot ID of the session' })
  @IsString()
  timeSlotId: string;

  @ApiProperty({ description: 'Specific date of the session' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Duration in minutes' })
  @IsNumber()
  @Min(1)
  duration: number;

  @ApiProperty({ description: 'Type of session', enum: ['REGULAR', 'EXAM', 'LAB', 'SPECIAL', 'MAKEUP'] })
  @IsEnum(['REGULAR', 'EXAM', 'LAB', 'SPECIAL', 'MAKEUP'])
  type: 'REGULAR' | 'EXAM' | 'LAB' | 'SPECIAL' | 'MAKEUP';

  @ApiProperty({ description: 'Whether this session is recurring', required: false })
  @IsOptional()
  isRecurring?: boolean;

  @ApiProperty({ description: 'Recurrence pattern if applicable', required: false })
  @IsOptional()
  @IsString()
  recurrencePattern?: string;

  @ApiProperty({ description: 'Notes or special instructions for the session', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Session metadata', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateScheduleSessionDto {
  @ApiProperty({ description: 'Teacher ID conducting the session', required: false })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiProperty({ description: 'Room ID where the session takes place', required: false })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiProperty({ description: 'Time slot ID of the session', required: false })
  @IsOptional()
  @IsString()
  timeSlotId?: string;

  @ApiProperty({ description: 'Specific date of the session', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ description: 'Duration in minutes', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @ApiProperty({ description: 'Type of session', enum: ['REGULAR', 'EXAM', 'LAB', 'SPECIAL', 'MAKEUP'], required: false })
  @IsOptional()
  @IsEnum(['REGULAR', 'EXAM', 'LAB', 'SPECIAL', 'MAKEUP'])
  type?: 'REGULAR' | 'EXAM' | 'LAB' | 'SPECIAL' | 'MAKEUP';

  @ApiProperty({ description: 'Current status of the session', enum: ['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'], required: false })
  @IsOptional()
  @IsEnum(['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
  status?: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

  @ApiProperty({ description: 'Notes or special instructions for the session', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Session metadata', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ScheduleGenerationRequestDto {
  @ApiProperty({ description: 'School ID to generate schedule for' })
  @IsString()
  schoolId: string;

  @ApiProperty({ description: 'Academic period ID' })
  @IsString()
  academicPeriodId: string;

  @ApiProperty({ description: 'Start date for schedule generation' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date for schedule generation' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Optimization level', enum: ['BASIC', 'STANDARD', 'ADVANCED'], required: false })
  @IsOptional()
  @IsEnum(['BASIC', 'STANDARD', 'ADVANCED'])
  optimizationLevel?: 'BASIC' | 'STANDARD' | 'ADVANCED';

  @ApiProperty({ description: 'Maximum solving time in seconds', required: false })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(3600)
  maxSolvingTimeSeconds?: number;

  @ApiProperty({ description: 'Include existing sessions in optimization', required: false })
  @IsOptional()
  includeExistingSessions?: boolean;

  @ApiProperty({ description: 'Additional generation parameters', required: false })
  @IsOptional()
  parameters?: Record<string, any>;
}

