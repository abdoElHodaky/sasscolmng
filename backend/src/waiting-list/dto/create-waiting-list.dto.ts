import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WaitingListPriority } from '@prisma/client';

export class CreateWaitingListDto {
  @ApiProperty({ description: 'School ID' })
  @IsString()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({ description: 'Subject ID' })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: 'Class ID' })
  @IsString()
  @IsNotEmpty()
  classId: string;

  @ApiPropertyOptional({ description: 'Teacher ID' })
  @IsString()
  @IsOptional()
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Room ID' })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Time slot ID' })
  @IsString()
  @IsOptional()
  timeSlotId?: string;

  @ApiPropertyOptional({ 
    description: 'Priority level',
    enum: WaitingListPriority,
    default: WaitingListPriority.MEDIUM
  })
  @IsEnum(WaitingListPriority)
  @IsOptional()
  priority?: WaitingListPriority;

  @ApiProperty({ description: 'User ID who requested this' })
  @IsString()
  @IsNotEmpty()
  requestedBy: string;

  @ApiProperty({ description: 'Reason for the waiting list entry' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
