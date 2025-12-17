import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'CurrentPassword123!',
  })
  @IsString({ message: 'Current password must be a string' })
  currentPassword: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters, must contain uppercase, lowercase, number, and special character)',
    example: 'NewSecurePassword123!',
    minLength: 8,
  })
  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password (must match new password)',
    example: 'NewSecurePassword123!',
  })
  @IsString({ message: 'Password confirmation must be a string' })
  confirmPassword: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Password changed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Timestamp of password change',
    example: '2024-12-17T10:30:00Z',
  })
  changedAt: Date;
}

