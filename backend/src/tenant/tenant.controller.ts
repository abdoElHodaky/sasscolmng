import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';

import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  create(@Body() createTenantDto: CreateTenantDto, @Request() req) {
    // Only super admins can create tenants
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Only super admins can create tenants');
    }
    return this.tenantService.create(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tenants (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  findAll(@Query() paginationDto: PaginationDto, @Request() req) {
    // Only super admins can view all tenants
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Only super admins can view all tenants');
    }
    return this.tenantService.findAll(paginationDto);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current user tenant information' })
  @ApiResponse({ status: 200, description: 'Current tenant retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getCurrentTenant(@Request() req) {
    return this.tenantService.findById(req.user.tenantId);
  }

  @Get('subdomain/:subdomain')
  @ApiOperation({ summary: 'Get tenant by subdomain (public endpoint)' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findBySubdomain(@Param('subdomain') subdomain: string) {
    return this.tenantService.findBySubdomain(subdomain);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('id') id: string, @Request() req) {
    // Super admins can view any tenant, others can only view their own
    if (req.user.role !== UserRole.SUPER_ADMIN && req.user.tenantId !== id) {
      throw new Error('Access denied');
    }
    return this.tenantService.findById(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get tenant statistics' })
  @ApiResponse({ status: 200, description: 'Tenant statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getTenantStats(@Param('id') id: string, @Request() req) {
    // Super admins can view any tenant stats, others can only view their own
    if (req.user.role !== UserRole.SUPER_ADMIN && req.user.tenantId !== id) {
      throw new Error('Access denied');
    }
    return this.tenantService.getTenantStats(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto, @Request() req) {
    // Super admins can update any tenant, school admins can update their own tenant
    if (
      req.user.role !== UserRole.SUPER_ADMIN &&
      (req.user.role !== UserRole.SCHOOL_ADMIN || req.user.tenantId !== id)
    ) {
      throw new Error('Access denied');
    }
    return this.tenantService.update(id, updateTenantDto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate tenant (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  deactivate(@Param('id') id: string, @Request() req) {
    // Only super admins can deactivate tenants
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Only super admins can deactivate tenants');
    }
    return this.tenantService.deactivateTenant(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate tenant (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant activated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  activate(@Param('id') id: string, @Request() req) {
    // Only super admins can activate tenants
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Only super admins can activate tenants');
    }
    return this.tenantService.activateTenant(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tenant (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  remove(@Param('id') id: string, @Request() req) {
    // Only super admins can delete tenants
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Only super admins can delete tenants');
    }
    return this.tenantService.remove(id);
  }
}
