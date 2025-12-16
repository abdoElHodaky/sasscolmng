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

import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Classes')
@Controller('classes')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new class' })
  @ApiResponse({ status: 201, description: 'Class created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createClassDto: CreateClassDto, @Request() req) {
    // Only super admins and school admins can create classes
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.classesService.create(createClassDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all classes with pagination' })
  @ApiResponse({ status: 200, description: 'Classes retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'schoolId', required: false, type: String })
  findAll(@Query() paginationDto: PaginationDto, @Query('schoolId') schoolId: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.classesService.findAll(paginationDto, schoolId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get class by ID' })
  @ApiResponse({ status: 200, description: 'Class retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  findOne(@Param('id') id: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.classesService.findById(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update class' })
  @ApiResponse({ status: 200, description: 'Class updated successfully' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  update(@Param('id') id: string, @Body() updateClassDto: UpdateClassDto, @Request() req) {
    // Only super admins and school admins can update classes
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.classesService.update(id, updateClassDto, tenantId);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate class' })
  @ApiResponse({ status: 200, description: 'Class deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  deactivate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can deactivate classes
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.classesService.deactivateClass(id, tenantId);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate class' })
  @ApiResponse({ status: 200, description: 'Class activated successfully' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  activate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can activate classes
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.classesService.activateClass(id, tenantId);
  }

  @Post(':id/subjects/:subjectId')
  @ApiOperation({ summary: 'Assign subject to class' })
  @ApiResponse({ status: 201, description: 'Subject assigned successfully' })
  @ApiResponse({ status: 404, description: 'Class or subject not found' })
  assignSubject(@Param('id') id: string, @Param('subjectId') subjectId: string, @Request() req) {
    // Only super admins and school admins can assign subjects
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.classesService.assignSubject(id, subjectId, tenantId);
  }

  @Delete(':id/subjects/:subjectId')
  @ApiOperation({ summary: 'Remove subject from class' })
  @ApiResponse({ status: 200, description: 'Subject removed successfully' })
  @ApiResponse({ status: 404, description: 'Class or subject assignment not found' })
  removeSubject(@Param('id') id: string, @Param('subjectId') subjectId: string, @Request() req) {
    // Only super admins and school admins can remove subjects
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.classesService.removeSubject(id, subjectId, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete class' })
  @ApiResponse({ status: 200, description: 'Class deleted successfully' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  remove(@Param('id') id: string, @Request() req) {
    // Only super admins can delete classes
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Only super admins can delete classes');
    }

    return this.classesService.remove(id);
  }
}

