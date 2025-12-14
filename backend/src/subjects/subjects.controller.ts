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

import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Subjects')
@Controller('subjects')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new subject' })
  @ApiResponse({ status: 201, description: 'Subject created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createSubjectDto: CreateSubjectDto, @Request() req) {
    // Only super admins and school admins can create subjects
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.subjectsService.create(createSubjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subjects with pagination' })
  @ApiResponse({ status: 200, description: 'Subjects retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'schoolId', required: false, type: String })
  findAll(@Query() paginationDto: PaginationDto, @Query('schoolId') schoolId: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.subjectsService.findAll(paginationDto, schoolId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subject by ID' })
  @ApiResponse({ status: 200, description: 'Subject retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  findOne(@Param('id') id: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.subjectsService.findById(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update subject' })
  @ApiResponse({ status: 200, description: 'Subject updated successfully' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  update(@Param('id') id: string, @Body() updateSubjectDto: UpdateSubjectDto, @Request() req) {
    // Only super admins and school admins can update subjects
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.subjectsService.update(id, updateSubjectDto, tenantId);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate subject' })
  @ApiResponse({ status: 200, description: 'Subject deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  deactivate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can deactivate subjects
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.subjectsService.deactivateSubject(id, tenantId);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate subject' })
  @ApiResponse({ status: 200, description: 'Subject activated successfully' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  activate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can activate subjects
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.subjectsService.activateSubject(id, tenantId);
  }

  @Post(':id/teachers/:teacherId')
  @ApiOperation({ summary: 'Assign teacher to subject' })
  @ApiResponse({ status: 201, description: 'Teacher assigned successfully' })
  @ApiResponse({ status: 404, description: 'Subject or teacher not found' })
  assignTeacher(@Param('id') id: string, @Param('teacherId') teacherId: string, @Request() req) {
    // Only super admins and school admins can assign teachers
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.subjectsService.assignTeacher(id, teacherId, tenantId);
  }

  @Delete(':id/teachers/:teacherId')
  @ApiOperation({ summary: 'Remove teacher from subject' })
  @ApiResponse({ status: 200, description: 'Teacher removed successfully' })
  @ApiResponse({ status: 404, description: 'Subject or teacher assignment not found' })
  removeTeacher(@Param('id') id: string, @Param('teacherId') teacherId: string, @Request() req) {
    // Only super admins and school admins can remove teachers
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.subjectsService.removeTeacher(id, teacherId, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subject' })
  @ApiResponse({ status: 200, description: 'Subject deleted successfully' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  remove(@Param('id') id: string, @Request() req) {
    // Only super admins can delete subjects
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Only super admins can delete subjects');
    }

    return this.subjectsService.remove(id);
  }
}

