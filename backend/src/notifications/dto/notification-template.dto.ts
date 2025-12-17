import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class CreateNotificationTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Template description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Template type' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Template subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Template content with variables' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Template variables schema' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tenant ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Template subject' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Template content with variables' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Template variables schema' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}
