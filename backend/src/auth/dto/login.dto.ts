import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiPropertyOptional({
    description: 'Remember me option for extended session',
    example: false,
    default: false,
  })
  @IsOptional()
  rememberMe?: boolean;

  @ApiPropertyOptional({
    description: 'Tenant ID for multi-tenant login',
    example: 'tenant-uuid-123',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

