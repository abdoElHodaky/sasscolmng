import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsInt,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsArray,
} from 'class-validator';
import { RoomType } from '@prisma/client';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room name',
    example: 'Room 101',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Room type',
    enum: RoomType,
    example: RoomType.CLASSROOM,
  })
  @IsEnum(RoomType)
  type: RoomType;

  @ApiProperty({
    description: 'Room capacity (maximum number of occupants)',
    example: 30,
    minimum: 1,
    maximum: 200,
  })
  @IsInt()
  @Min(1)
  @Max(200)
  capacity: number;

  @ApiProperty({
    description: 'Room description',
    example: 'Spacious classroom with modern equipment',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Room location/floor',
    example: 'First Floor, East Wing',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  location?: string;

  @ApiProperty({
    description: 'Room features and equipment',
    example: ['Projector', 'Whiteboard', 'Air Conditioning', 'WiFi'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiProperty({
    description: 'School ID that owns this room',
    example: 'uuid-school-id',
  })
  @IsUUID()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({
    description: 'Whether room is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

