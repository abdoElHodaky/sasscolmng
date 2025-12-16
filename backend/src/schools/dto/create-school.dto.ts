import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsUrl,
  MinLength,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class CreateSchoolDto {
  @ApiProperty({
    description: 'School name',
    example: 'Greenwood Elementary School',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'School description',
    example: 'A nurturing environment for young learners',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'School address',
    example: '456 Learning Avenue, Education City, EC 67890',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address: string;

  @ApiProperty({
    description: 'School contact phone',
    example: '+1-555-987-6543',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'School contact email',
    example: 'info@greenwood-elementary.edu',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'School website URL',
    example: 'https://www.greenwood-elementary.edu',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  website?: string;

  @ApiProperty({
    description: 'School logo URL',
    example: 'https://cdn.greenwood-elementary.edu/logo.png',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  logo?: string;

  @ApiProperty({
    description: 'Tenant ID that owns this school',
    example: 'uuid-tenant-id',
  })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({
    description: 'Whether school is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

