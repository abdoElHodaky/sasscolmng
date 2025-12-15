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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WaitingListService } from './waiting-list.service';
import { CreateWaitingListDto, UpdateWaitingListDto, AssignFromWaitingListDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../tenant/guards/tenant.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, WaitingListStatus, WaitingListPriority } from '@prisma/client';
import { RateLimit, CommonRateLimits } from '../common/guards/rate-limit.guard';

@ApiTags('Waiting List Management')
@ApiBearerAuth()
@Controller('waiting-list')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class WaitingListController {
  constructor(private readonly waitingListService: WaitingListService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @RateLimit(CommonRateLimits.STANDARD)
  @ApiOperation({ summary: 'Create a new waiting list entry' })
  @ApiResponse({
    status: 201,
    description: 'Waiting list entry created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or duplicate entry',
  })
  create(@Body() createWaitingListDto: CreateWaitingListDto) {
    return this.waitingListService.create(createWaitingListDto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @RateLimit(CommonRateLimits.GENEROUS)
  @ApiOperation({ summary: 'Get all waiting list entries for a school' })
  @ApiQuery({ name: 'schoolId', required: true, description: 'School ID' })
  @ApiQuery({ name: 'status', required: false, enum: WaitingListStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'priority', required: false, enum: WaitingListPriority, description: 'Filter by priority' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({
    status: 200,
    description: 'Waiting list entries retrieved successfully',
  })
  findAll(
    @Query('schoolId') schoolId: string,
    @Query('status') status?: WaitingListStatus,
    @Query('priority') priority?: WaitingListPriority,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    
    return this.waitingListService.findAll(schoolId, status, priority, pageNum, limitNum);
  }

  @Get('statistics/:schoolId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @RateLimit(CommonRateLimits.STANDARD)
  @ApiOperation({ summary: 'Get waiting list statistics for a school' })
  @ApiResponse({
    status: 200,
    description: 'Waiting list statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalEntries: { type: 'number' },
        pendingEntries: { type: 'number' },
        inProgressEntries: { type: 'number' },
        assignedEntries: { type: 'number' },
        cancelledEntries: { type: 'number' },
        highPriorityEntries: { type: 'number' },
        averageWaitTime: { type: 'number', description: 'Average wait time in hours' },
        assignmentRate: { type: 'number', description: 'Assignment rate percentage' },
      },
    },
  })
  getStatistics(@Param('schoolId') schoolId: string) {
    return this.waitingListService.getStatistics(schoolId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @RateLimit(CommonRateLimits.GENEROUS)
  @ApiOperation({ summary: 'Get a specific waiting list entry' })
  @ApiResponse({
    status: 200,
    description: 'Waiting list entry retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Waiting list entry not found',
  })
  findOne(@Param('id') id: string) {
    return this.waitingListService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @RateLimit(CommonRateLimits.STANDARD)
  @ApiOperation({ summary: 'Update a waiting list entry' })
  @ApiResponse({
    status: 200,
    description: 'Waiting list entry updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot update assigned entry',
  })
  @ApiResponse({
    status: 404,
    description: 'Waiting list entry not found',
  })
  update(@Param('id') id: string, @Body() updateWaitingListDto: UpdateWaitingListDto) {
    return this.waitingListService.update(id, updateWaitingListDto);
  }

  @Post('assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @RateLimit(CommonRateLimits.STRICT)
  @ApiOperation({ summary: 'Assign a waiting list entry to a schedule' })
  @ApiResponse({
    status: 201,
    description: 'Waiting list entry assigned successfully',
    schema: {
      type: 'object',
      properties: {
        waitingListEntry: { type: 'object', description: 'Updated waiting list entry' },
        scheduleSession: { type: 'object', description: 'Created schedule session' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - entry not pending or validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Waiting list entry not found',
  })
  assignFromWaitingList(@Body() assignDto: AssignFromWaitingListDto) {
    return this.waitingListService.assignFromWaitingList(assignDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @RateLimit(CommonRateLimits.STANDARD)
  @ApiOperation({ summary: 'Delete a waiting list entry' })
  @ApiResponse({
    status: 200,
    description: 'Waiting list entry deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot delete assigned entry',
  })
  @ApiResponse({
    status: 404,
    description: 'Waiting list entry not found',
  })
  remove(@Param('id') id: string) {
    return this.waitingListService.remove(id);
  }
}
