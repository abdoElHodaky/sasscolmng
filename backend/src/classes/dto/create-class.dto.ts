import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateClassDto {
  @ApiProperty({
    description: 'Class name',
    example: 'Grade 5A',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Grade level',
    example: 5,
    minimum: 1,
    maximum: 12,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  grade: number;

  @ApiProperty({
    description: 'Class capacity (maximum number of students)',
    example: 30,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  capacity: number;

  @ApiProperty({
    description: 'Class description',
    example: 'Advanced mathematics class for grade 5 students',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'School ID that owns this class',
    example: 'uuid-school-id',
  })
  @IsUUID()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({
    description: 'Whether class is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

