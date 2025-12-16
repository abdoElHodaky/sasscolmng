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

import { TimeSlotService } from '../services/time-slot.service';
import { CreateTimeSlotDto, UpdateTimeSlotDto } from '../dto/create-time-slot.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Time Slots')
@Controller('time-slots')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class TimeSlotController {
  constructor(private readonly timeSlotService: TimeSlotService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new time slot' })
  @ApiResponse({ status: 201, description: 'Time slot created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createTimeSlotDto: CreateTimeSlotDto, @Request() req) {
    // Only super admins and school admins can create time slots
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.timeSlotService.create(createTimeSlotDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all time slots with pagination' })
  @ApiResponse({ status: 200, description: 'Time slots retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'schoolId', required: false, type: String })
  @ApiQuery({ name: 'dayOfWeek', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('schoolId') schoolId: string,
    @Query('dayOfWeek') dayOfWeek: string,
    @Query('type') type: string,
    @Request() req
  ) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    const dayOfWeekNum = dayOfWeek ? parseInt(dayOfWeek) : undefined;
    
    return this.timeSlotService.findAll(paginationDto, schoolId, dayOfWeekNum, type, tenantId);
  }

  @Get('school/:schoolId/day/:dayOfWeek')
  @ApiOperation({ summary: 'Get time slots for a specific school and day' })
  @ApiResponse({ status: 200, description: 'Time slots retrieved successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  findBySchoolAndDay(
    @Param('schoolId') schoolId: string,
    @Param('dayOfWeek') dayOfWeek: string,
    @Request() req
  ) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    const dayOfWeekNum = parseInt(dayOfWeek);
    
    return this.timeSlotService.findBySchoolAndDay(schoolId, dayOfWeekNum, tenantId);
  }

  @Get('stats/:schoolId')
  @ApiOperation({ summary: 'Get time slot statistics for a school' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'School not found' })
  getStatistics(@Param('schoolId') schoolId: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.timeSlotService.getTimeSlotStatistics(schoolId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get time slot by ID' })
  @ApiResponse({ status: 200, description: 'Time slot retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Time slot not found' })
  findOne(@Param('id') id: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.timeSlotService.findById(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update time slot' })
  @ApiResponse({ status: 200, description: 'Time slot updated successfully' })
  @ApiResponse({ status: 404, description: 'Time slot not found' })
  update(@Param('id') id: string, @Body() updateTimeSlotDto: UpdateTimeSlotDto, @Request() req) {
    // Only super admins and school admins can update time slots
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.timeSlotService.update(id, updateTimeSlotDto, tenantId);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate time slot' })
  @ApiResponse({ status: 200, description: 'Time slot deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Time slot not found' })
  deactivate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can deactivate time slots
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.timeSlotService.deactivate(id, tenantId);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate time slot' })
  @ApiResponse({ status: 200, description: 'Time slot activated successfully' })
  @ApiResponse({ status: 404, description: 'Time slot not found' })
  activate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can activate time slots
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.timeSlotService.activate(id, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete time slot' })
  @ApiResponse({ status: 200, description: 'Time slot deleted successfully' })
  @ApiResponse({ status: 404, description: 'Time slot not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete time slot in use' })
  remove(@Param('id') id: string, @Request() req) {
    // Only super admins can delete time slots
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Access denied');
    }

    return this.timeSlotService.delete(id);
  }
}

