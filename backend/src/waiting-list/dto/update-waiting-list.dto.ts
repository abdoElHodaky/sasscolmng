import { PartialType } from '@nestjs/swagger';
import { CreateWaitingListDto } from './create-waiting-list.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WaitingListStatus, WaitingListPriority } from '@prisma/client';

export class UpdateWaitingListDto extends PartialType(CreateWaitingListDto) {
  @ApiPropertyOptional({ 
    description: 'Status of the waiting list entry',
    enum: WaitingListStatus
  })
  @IsEnum(WaitingListStatus)
  @IsOptional()
  status?: WaitingListStatus;

  @ApiPropertyOptional({ 
    description: 'Priority level',
    enum: WaitingListPriority
  })
  @IsEnum(WaitingListPriority)
  @IsOptional()
  priority?: WaitingListPriority;
}
