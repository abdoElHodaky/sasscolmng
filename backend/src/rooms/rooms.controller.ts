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
import { UserRole, RoomType } from '@prisma/client';

import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Rooms')
@Controller('rooms')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createRoomDto: CreateRoomDto, @Request() req) {
    // Only super admins and school admins can create rooms
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    return this.roomsService.create(createRoomDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all rooms with pagination' })
  @ApiResponse({ status: 200, description: 'Rooms retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'schoolId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: RoomType })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('schoolId') schoolId: string,
    @Query('type') type: RoomType,
    @Request() req,
  ) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.roomsService.findAll(paginationDto, schoolId, tenantId, type);
  }

  @Get('by-type/:schoolId/:type')
  @ApiOperation({ summary: 'Get rooms by type for a specific school' })
  @ApiResponse({ status: 200, description: 'Rooms retrieved successfully' })
  getRoomsByType(@Param('schoolId') schoolId: string, @Param('type') type: RoomType, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.roomsService.getRoomsByType(schoolId, type, tenantId);
  }

  @Get('available/:schoolId')
  @ApiOperation({ summary: 'Get available rooms for a time period' })
  @ApiResponse({ status: 200, description: 'Available rooms retrieved successfully' })
  @ApiQuery({ name: 'startTime', required: true, type: String })
  @ApiQuery({ name: 'endTime', required: true, type: String })
  getAvailableRooms(
    @Param('schoolId') schoolId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Request() req,
  ) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.roomsService.getAvailableRooms(
      schoolId,
      new Date(startTime),
      new Date(endTime),
      tenantId,
    );
  }

  @Get('stats/:schoolId')
  @ApiOperation({ summary: 'Get room statistics for a school' })
  @ApiResponse({ status: 200, description: 'Room statistics retrieved successfully' })
  getRoomStats(@Param('schoolId') schoolId: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.roomsService.getRoomStats(schoolId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room by ID' })
  @ApiResponse({ status: 200, description: 'Room retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  findOne(@Param('id') id: string, @Request() req) {
    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.roomsService.findById(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update room' })
  @ApiResponse({ status: 200, description: 'Room updated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto, @Request() req) {
    // Only super admins and school admins can update rooms
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.roomsService.update(id, updateRoomDto, tenantId);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate room' })
  @ApiResponse({ status: 200, description: 'Room deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  deactivate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can deactivate rooms
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.roomsService.deactivateRoom(id, tenantId);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate room' })
  @ApiResponse({ status: 200, description: 'Room activated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  activate(@Param('id') id: string, @Request() req) {
    // Only super admins and school admins can activate rooms
    if (![UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(req.user.role)) {
      throw new Error('Access denied');
    }

    // Filter by tenant for non-super-admin users
    const tenantId = req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.tenantId;
    return this.roomsService.activateRoom(id, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete room' })
  @ApiResponse({ status: 200, description: 'Room deleted successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  remove(@Param('id') id: string, @Request() req) {
    // Only super admins can delete rooms
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      throw new Error('Only super admins can delete rooms');
    }

    return this.roomsService.remove(id);
  }
}

