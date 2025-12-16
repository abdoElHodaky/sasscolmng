import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsUrl,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Tenant name',
    example: 'Greenwood High School District',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Unique subdomain for tenant',
    example: 'greenwood-high',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Subdomain can only contain lowercase letters, numbers, and hyphens',
  })
  subdomain: string;

  @ApiProperty({
    description: 'Tenant description',
    example: 'A leading educational institution providing quality education',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Contact email for the tenant',
    example: 'admin@greenwood-high.edu',
  })
  @IsEmail()
  @IsNotEmpty()
  contactEmail: string;

  @ApiProperty({
    description: 'Contact phone number',
    example: '+1-555-123-4567',
    required: false,
  })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiProperty({
    description: 'Tenant website URL',
    example: 'https://www.greenwood-high.edu',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  website?: string;

  @ApiProperty({
    description: 'Tenant logo URL',
    example: 'https://cdn.greenwood-high.edu/logo.png',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  logo?: string;

  @ApiProperty({
    description: 'Tenant address',
    example: '123 Education Street, Learning City, LC 12345',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  address?: string;

  @ApiProperty({
    description: 'Tenant timezone',
    example: 'America/New_York',
    required: false,
  })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({
    description: 'Whether tenant is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

