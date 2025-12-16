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

import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Schools')
@Controller('schools')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new school' })
  @ApiResponse({ status: 201, description: 'School created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createSchoolDto: CreateSchoolDto, @Request() req) {
    // Only super admins and school admins can create schools
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Non-super-admins can only create schools for their own tenant
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      createSchoolDto.tenantId = req.user.tenantId;
    }

    return this.schoolsService.create(createSchoolDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schools with pagination' })
  @ApiResponse({ status: 200, description: 'Schools retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  findAll(@Query() paginationDto: PaginationDto, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.schoolsService.findAll(paginationDto, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get school by ID' })
  @ApiResponse({ status: 200, description: 'School retrieved successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  findOne(@Param('id') id: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.schoolsService.findById(id, tenantId);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get school statistics' })
  @ApiResponse({ status: 200, description: 'School statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  getSchoolStats(@Param('id') id: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.schoolsService.getSchoolStats(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update school' })
  @ApiResponse({ status: 200, description: 'School updated successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  update(@Param('id') id: string, @Body() updateSchoolDto: UpdateSchoolDto, @Request() req) {
    // Only super admins and school admins can update schools
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.schoolsService.update(id, updateSchoolDto, tenantId);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate school' })
  @ApiResponse({ status: 200, description: 'School deactivated successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  deactivate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can deactivate schools
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.schoolsService.deactivateSchool(id, tenantId);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate school' })
  @ApiResponse({ status: 200, description: 'School activated successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  activate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can activate schools
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.schoolsService.activateSchool(id, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete school' })
  @ApiResponse({ status: 200, description: 'School deleted successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  remove(@Param('id') id: string, @Request() req) {
    // Only super admins can delete schools
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Only super admins can delete schools');
    }

    return this.schoolsService.remove(id);
  }
}
