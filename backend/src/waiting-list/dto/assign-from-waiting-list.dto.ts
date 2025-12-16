import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignFromWaitingListDto {
  @ApiProperty({ description: 'Waiting list entry ID to assign' })
  @IsString()
  @IsNotEmpty()
  waitingListId: string;

  @ApiProperty({ description: 'Schedule ID to assign to' })
  @IsString()
  @IsNotEmpty()
  scheduleId: string;

  @ApiProperty({ description: 'User ID who is making the assignment' })
  @IsString()
  @IsNotEmpty()
  assignedBy: string;

  @ApiPropertyOptional({ description: 'Additional notes for the assignment' })
  @IsString()
  @IsOptional()
  notes?: string;
}
