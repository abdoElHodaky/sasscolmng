import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsBoolean, IsOptional, Min, Max, Matches } from 'class-validator';

export class CreateTimeSlotDto {
  @ApiProperty({ description: 'School ID this time slot belongs to' })
  @IsString()
  schoolId: string;

  @ApiProperty({ description: 'Name of the time slot' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)' })
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Start time in HH:mm format' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Start time must be in HH:mm format' })
  startTime: string;

  @ApiProperty({ description: 'End time in HH:mm format' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'End time must be in HH:mm format' })
  endTime: string;

  @ApiProperty({ description: 'Duration in minutes' })
  @IsNumber()
  @Min(1)
  duration: number;

  @ApiProperty({ description: 'Type of time slot', enum: ['REGULAR', 'BREAK', 'LUNCH', 'ASSEMBLY', 'EXAM'] })
  @IsEnum(['REGULAR', 'BREAK', 'LUNCH', 'ASSEMBLY', 'EXAM'])
  type: 'REGULAR' | 'BREAK' | 'LUNCH' | 'ASSEMBLY' | 'EXAM';

  @ApiProperty({ description: 'Order/sequence of this time slot in the day' })
  @IsNumber()
  @Min(1)
  order: number;

  @ApiProperty({ description: 'Maximum number of sessions that can be scheduled in this slot', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxSessions?: number;

  @ApiProperty({ description: 'Additional metadata for the time slot', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateTimeSlotDto {
  @ApiProperty({ description: 'Name of the time slot', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiProperty({ description: 'Start time in HH:mm format', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Start time must be in HH:mm format' })
  startTime?: string;

  @ApiProperty({ description: 'End time in HH:mm format', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'End time must be in HH:mm format' })
  endTime?: string;

  @ApiProperty({ description: 'Duration in minutes', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @ApiProperty({ description: 'Type of time slot', enum: ['REGULAR', 'BREAK', 'LUNCH', 'ASSEMBLY', 'EXAM'], required: false })
  @IsOptional()
  @IsEnum(['REGULAR', 'BREAK', 'LUNCH', 'ASSEMBLY', 'EXAM'])
  type?: 'REGULAR' | 'BREAK' | 'LUNCH' | 'ASSEMBLY' | 'EXAM';

  @ApiProperty({ description: 'Whether this time slot is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Order/sequence of this time slot in the day', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  order?: number;

  @ApiProperty({ description: 'Maximum number of sessions that can be scheduled in this slot', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxSessions?: number;

  @ApiProperty({ description: 'Additional metadata for the time slot', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

