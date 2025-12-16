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

import { ScheduleService } from '../services/schedule.service';
import { SchedulingEngineService } from '../services/scheduling-engine.service';
import { 
  CreateScheduleDto, 
  UpdateScheduleDto, 
  CreateScheduleSessionDto, 
  UpdateScheduleSessionDto,
  ScheduleGenerationRequestDto 
} from '../dto/create-schedule.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Schedules')
@Controller('schedules')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly schedulingEngineService: SchedulingEngineService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new schedule' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createScheduleDto: CreateScheduleDto, @Request() req) {
    // Only super admins and school admins can create schedules
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.scheduleService.create(createScheduleDto, req.user.id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate a new schedule using AI optimization' })
  @ApiResponse({ status: 201, description: 'Schedule generation started' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  generateSchedule(@Body() generateRequest: ScheduleGenerationRequestDto, @Request() req) {
    // Only super admins and school admins can generate schedules
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.schedulingEngineService.generateSchedule(generateRequest, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schedules with pagination' })
  @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'schoolId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('schoolId') schoolId: string,
    @Query('status') status: string,
    @Request() req
  ) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.scheduleService.findAll(paginationDto, schoolId, status, tenantId);
  }

  @Get('stats/:schoolId')
  @ApiOperation({ summary: 'Get schedule statistics for a school' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  getStatistics(@Param('schoolId') schoolId: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.scheduleService.getScheduleStatistics(schoolId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get schedule by ID' })
  @ApiResponse({ status: 200, description: 'Schedule retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  findOne(@Param('id') id: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.scheduleService.findById(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update schedule' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  update(@Param('id') id: string, @Body() updateScheduleDto: UpdateScheduleDto, @Request() req) {
    // Only super admins and school admins can update schedules
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.scheduleService.update(id, updateScheduleDto, tenantId);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve schedule' })
  @ApiResponse({ status: 200, description: 'Schedule approved successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 400, description: 'Schedule cannot be approved' })
  approve(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can approve schedules
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.scheduleService.approve(id, req.user.id, tenantId);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate schedule' })
  @ApiResponse({ status: 200, description: 'Schedule activated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 400, description: 'Schedule cannot be activated' })
  activate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can activate schedules
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.scheduleService.activate(id, tenantId);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive schedule' })
  @ApiResponse({ status: 200, description: 'Schedule archived successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  archive(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can archive schedules
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.scheduleService.archive(id, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete schedule' })
  @ApiResponse({ status: 200, description: 'Schedule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete schedule with sessions' })
  remove(@Param('id') id: string, @Request() req) {
    // Only super admins can delete schedules
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Access denied');
    }

    return this.scheduleService.delete(id);
  }

  // Schedule Session Management
  @Post('sessions')
  @ApiOperation({ summary: 'Create a new schedule session' })
  @ApiResponse({ status: 201, description: 'Session created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request or conflicts detected' })
  createSession(@Body() createSessionDto: CreateScheduleSessionDto, @Request() req) {
    // Only super admins and school admins can create sessions
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.scheduleService.createSession(createSessionDto);
  }

  @Patch('sessions/:sessionId')
  @ApiOperation({ summary: 'Update schedule session' })
  @ApiResponse({ status: 200, description: 'Session updated successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  updateSession(
    @Param('sessionId') sessionId: string,
    @Body() updateSessionDto: UpdateScheduleSessionDto,
    @Request() req
  ) {
    // Only super admins and school admins can update sessions
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.scheduleService.updateSession(sessionId, updateSessionDto, tenantId);
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: 'Delete schedule session' })
  @ApiResponse({ status: 200, description: 'Session deleted successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  removeSession(@Param('sessionId') sessionId: string, @Request() req) {
    // Only super admins and school admins can delete sessions
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.scheduleService.deleteSession(sessionId, tenantId);
  }
}
