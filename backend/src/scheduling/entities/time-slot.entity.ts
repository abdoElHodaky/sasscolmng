import { ApiProperty } from '@nestjs/swagger';

export class TimeSlot {
  @ApiProperty({ description: 'Unique identifier for the time slot' })
  id: string;

  @ApiProperty({ description: 'School this time slot belongs to' })
  schoolId: string;

  @ApiProperty({ description: 'Name of the time slot (e.g., "Period 1", "Morning Block")' })
  name: string;

  @ApiProperty({ description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)' })
  dayOfWeek: number;

  @ApiProperty({ description: 'Start time in HH:mm format' })
  startTime: string;

  @ApiProperty({ description: 'End time in HH:mm format' })
  endTime: string;

  @ApiProperty({ description: 'Duration in minutes' })
  duration: number;

  @ApiProperty({ description: 'Type of time slot', enum: ['REGULAR', 'BREAK', 'LUNCH', 'ASSEMBLY', 'EXAM'] })
  type: 'REGULAR' | 'BREAK' | 'LUNCH' | 'ASSEMBLY' | 'EXAM';

  @ApiProperty({ description: 'Whether this time slot is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Order/sequence of this time slot in the day' })
  order: number;

  @ApiProperty({ description: 'Maximum number of sessions that can be scheduled in this slot' })
  maxSessions?: number;

  @ApiProperty({ description: 'Additional metadata for the time slot' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class AcademicPeriod {
  @ApiProperty({ description: 'Unique identifier for the academic period' })
  id: string;

  @ApiProperty({ description: 'School this period belongs to' })
  schoolId: string;

  @ApiProperty({ description: 'Name of the period (e.g., "Fall Semester 2024")' })
  name: string;

  @ApiProperty({ description: 'Start date of the period' })
  startDate: Date;

  @ApiProperty({ description: 'End date of the period' })
  endDate: Date;

  @ApiProperty({ description: 'Type of academic period', enum: ['SEMESTER', 'QUARTER', 'TRIMESTER', 'YEAR'] })
  type: 'SEMESTER' | 'QUARTER' | 'TRIMESTER' | 'YEAR';

  @ApiProperty({ description: 'Whether this period is currently active' })
  isActive: boolean;

  @ApiProperty({ description: 'Time slots available during this period' })
  timeSlots?: TimeSlot[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

