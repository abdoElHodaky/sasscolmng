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

import { PreferencesService } from '../services/preferences.service';
import { 
  CreateSchedulingPreferenceDto, 
  UpdateSchedulingPreferenceDto,
  CreateSchedulingRuleDto,
  UpdateSchedulingRuleDto,
  CreateTeacherAvailabilityDto,
  UpdateTeacherAvailabilityDto
} from '../dto/create-preference.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Scheduling Preferences')
@Controller('scheduling/preferences')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  // Scheduling Preferences
  @Post()
  @ApiOperation({ summary: 'Create a new scheduling preference' })
  @ApiResponse({ status: 201, description: 'Preference created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  createPreference(@Body() createPreferenceDto: CreateSchedulingPreferenceDto, @Request() req) {
    // Only super admins and school admins can create preferences
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.preferencesService.createPreference(createPreferenceDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all scheduling preferences with pagination' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'schoolId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  findAllPreferences(
    @Query() paginationDto: PaginationDto,
    @Query('schoolId') schoolId: string,
    @Query('type') type: string,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Request() req
  ) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.preferencesService.findAllPreferences(
      paginationDto, 
      schoolId, 
      type, 
      entityType, 
      entityId, 
      tenantId
    );
  }

  @Get('stats/:schoolId')
  @ApiOperation({ summary: 'Get preference statistics for a school' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  getPreferenceStatistics(@Param('schoolId') schoolId: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.preferencesService.getPreferenceStatistics(schoolId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get preference by ID' })
  @ApiResponse({ status: 200, description: 'Preference retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Preference not found' })
  findOnePreference(@Param('id') id: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.preferencesService.findPreferenceById(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update preference' })
  @ApiResponse({ status: 200, description: 'Preference updated successfully' })
  @ApiResponse({ status: 404, description: 'Preference not found' })
  updatePreference(
    @Param('id') id: string, 
    @Body() updatePreferenceDto: UpdateSchedulingPreferenceDto, 
    @Request() req
  ) {
    // Only super admins and school admins can update preferences
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.preferencesService.updatePreference(id, updatePreferenceDto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete preference' })
  @ApiResponse({ status: 200, description: 'Preference deleted successfully' })
  @ApiResponse({ status: 404, description: 'Preference not found' })
  removePreference(@Param('id') id: string, @Request() req) {
    // Only super admins can delete preferences
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Access denied');
    }

    return this.preferencesService.deletePreference(id);
  }

  // Scheduling Rules
  @Post('rules')
  @ApiOperation({ summary: 'Create a new scheduling rule' })
  @ApiResponse({ status: 201, description: 'Rule created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  createRule(@Body() createRuleDto: CreateSchedulingRuleDto, @Request() req) {
    // Only super admins and school admins can create rules
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.preferencesService.createRule(createRuleDto, req.user.id);
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get all scheduling rules with pagination' })
  @ApiResponse({ status: 200, description: 'Rules retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'schoolId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'isMandatory', required: false, type: Boolean })
  findAllRules(
    @Query() paginationDto: PaginationDto,
    @Query('schoolId') schoolId: string,
    @Query('type') type: string,
    @Query('isMandatory') isMandatory: string,
    @Request() req
  ) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    const isMandatoryBool = isMandatory === 'true' ? true : isMandatory === 'false' ? false : undefined;
    return this.preferencesService.findAllRules(
      paginationDto, 
      schoolId, 
      type, 
      isMandatoryBool, 
      tenantId
    );
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get rule by ID' })
  @ApiResponse({ status: 200, description: 'Rule retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  findOneRule(@Param('id') id: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.preferencesService.findRuleById(id, tenantId);
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update rule' })
  @ApiResponse({ status: 200, description: 'Rule updated successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  updateRule(
    @Param('id') id: string, 
    @Body() updateRuleDto: UpdateSchedulingRuleDto, 
    @Request() req
  ) {
    // Only super admins and school admins can update rules
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.preferencesService.updateRule(id, updateRuleDto, tenantId);
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Delete rule' })
  @ApiResponse({ status: 200, description: 'Rule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  removeRule(@Param('id') id: string, @Request() req) {
    // Only super admins can delete rules
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Access denied');
    }

    return this.preferencesService.deleteRule(id);
  }

  // Teacher Availability
  @Post('availability')
  @ApiOperation({ summary: 'Create teacher availability' })
  @ApiResponse({ status: 201, description: 'Availability created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  createAvailability(@Body() createAvailabilityDto: CreateTeacherAvailabilityDto, @Request() req) {
    // Teachers can create their own availability, admins can create for any teacher
    if (req.user.role === UserRole.TEACHER && createAvailabilityDto.teacherId !== req.user.id) {
      throw new Error('Teachers can only manage their own availability');
    }

    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.preferencesService.createAvailability(createAvailabilityDto);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Get teacher availability with pagination' })
  @ApiResponse({ status: 200, description: 'Availability retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'teacherId', required: false, type: String })
  @ApiQuery({ name: 'dayOfWeek', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  findAllAvailability(
    @Query() paginationDto: PaginationDto,
    @Query('teacherId') teacherId: string,
    @Query('dayOfWeek') dayOfWeek: string,
    @Query('type') type: string,
    @Request() req
  ) {
    // Teachers can only see their own availability
    let filterTeacherId = teacherId;
    if (req.user.role === UserRole.TEACHER) {
      filterTeacherId = req.user.id;
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    const dayOfWeekNum = dayOfWeek ? parseInt(dayOfWeek) : undefined;
    
    return this.preferencesService.findAllAvailability(
      paginationDto, 
      filterTeacherId, 
      dayOfWeekNum, 
      type, 
      tenantId
    );
  }

  @Get('availability/teacher/:teacherId')
  @ApiOperation({ summary: 'Get availability for a specific teacher' })
  @ApiResponse({ status: 200, description: 'Teacher availability retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Teacher not found' })
  findTeacherAvailability(@Param('teacherId') teacherId: string, @Request() req) {
    // Teachers can only see their own availability
    if (req.user.role === UserRole.TEACHER && teacherId !== req.user.id) {
      throw new Error('Teachers can only view their own availability');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.preferencesService.findTeacherAvailability(teacherId, tenantId);
  }

  @Get('availability/:id')
  @ApiOperation({ summary: 'Get availability by ID' })
  @ApiResponse({ status: 200, description: 'Availability retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Availability not found' })
  findOneAvailability(@Param('id') id: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.preferencesService.findAvailabilityById(id, tenantId);
  }

  @Patch('availability/:id')
  @ApiOperation({ summary: 'Update availability' })
  @ApiResponse({ status: 200, description: 'Availability updated successfully' })
  @ApiResponse({ status: 404, description: 'Availability not found' })
  updateAvailability(
    @Param('id') id: string, 
    @Body() updateAvailabilityDto: UpdateTeacherAvailabilityDto, 
    @Request() req
  ) {
    // Teachers can only update their own availability
    // This would require checking if the availability belongs to the teacher
    // For now, we'll allow admins and the owning teacher

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.preferencesService.updateAvailability(id, updateAvailabilityDto, tenantId, req.user.id, req.user.role);
  }

  @Delete('availability/:id')
  @ApiOperation({ summary: 'Delete availability' })
  @ApiResponse({ status: 200, description: 'Availability deleted successfully' })
  @ApiResponse({ status: 404, description: 'Availability not found' })
  removeAvailability(@Param('id') id: string, @Request() req) {
    // Teachers can only delete their own availability
    // Admins can delete any availability

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.preferencesService.deleteAvailability(id, tenantId, req.user.id, req.user.role);
  }

  // Bulk Operations
  @Post('bulk/preferences')
  @ApiOperation({ summary: 'Create multiple preferences at once' })
  @ApiResponse({ status: 201, description: 'Preferences created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  createBulkPreferences(@Body() preferences: CreateSchedulingPreferenceDto[], @Request() req) {
    // Only super admins and school admins can create bulk preferences
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.preferencesService.createBulkPreferences(preferences, req.user.id);
  }

  @Post('bulk/availability')
  @ApiOperation({ summary: 'Create multiple availability records at once' })
  @ApiResponse({ status: 201, description: 'Availability records created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  createBulkAvailability(@Body() availabilities: CreateTeacherAvailabilityDto[], @Request() req) {
    // Only super admins and school admins can create bulk availability
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.preferencesService.createBulkAvailability(availabilities);
  }

  // Template Operations
  @Get('templates/preferences')
  @ApiOperation({ summary: 'Get preference templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  getPreferenceTemplates(@Request() req) {
    return this.preferencesService.getPreferenceTemplates();
  }

  @Get('templates/rules')
  @ApiOperation({ summary: 'Get rule templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  getRuleTemplates(@Request() req) {
    return this.preferencesService.getRuleTemplates();
  }
}

