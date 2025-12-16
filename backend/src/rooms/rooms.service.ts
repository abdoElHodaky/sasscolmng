import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { RoomType } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async create(createRoomDto: CreateRoomDto) {
    // Verify school exists and is active
    const school = await this.prisma.school.findUnique({
      where: { id: createRoomDto.schoolId },
      include: { tenant: true },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    if (!school.isActive) {
      throw new BadRequestException('Cannot create room for inactive school');
    }

    // Check if room with same name already exists for this school
    const existingRoom = await this.prisma.room.findFirst({
      where: {
        name: createRoomDto.name,
        schoolId: createRoomDto.schoolId,
      },
    });

    if (existingRoom) {
      throw new BadRequestException(
        'Room with this name already exists for this school',
      );
    }

    return this.prisma.room.create({
      data: createRoomDto,
      include: {
        school: {
          select: {
            id: true,
            name: true,
            tenant: {
              select: {
                id: true,
                name: true,
                subdomain: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll(paginationDto: PaginationDto, schoolId?: string, tenantId?: string, type?: RoomType) {
    const { page, limit, search, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Apply school filter if provided
    if (schoolId) {
      where.schoolId = schoolId;
    } else if (tenantId) {
      // Filter by tenant through school relationship
      where.school = { tenantId };
    }

    // Apply room type filter if provided
    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          school: {
            select: {
              id: true,
              name: true,
              tenant: {
                select: {
                  id: true,
                  name: true,
                  subdomain: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.room.count({ where }),
    ]);

    return new PaginatedResponseDto(rooms, total, page, limit);
  }

  async findById(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const room = await this.prisma.room.findFirst({
      where,
      include: {
        school: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                subdomain: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async update(id: string, updateRoomDto: UpdateRoomDto, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const room = await this.prisma.room.findFirst({ 
      where,
      include: { school: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Check if name is being changed and if it already exists for this school
    if (updateRoomDto.name) {
      const existingRoom = await this.prisma.room.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { name: updateRoomDto.name },
            { schoolId: room.schoolId },
          ],
        },
      });

      if (existingRoom) {
        throw new BadRequestException(
          'Room with this name already exists for this school',
        );
      }
    }

    return this.prisma.room.update({
      where: { id },
      data: updateRoomDto,
      include: {
        school: {
          select: {
            id: true,
            name: true,
            tenant: {
              select: {
                id: true,
                name: true,
                subdomain: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const room = await this.prisma.room.findFirst({
      where,
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Check if room has any scheduled sessions (when scheduling is implemented)
    // For now, we'll just delete the room directly

    await this.prisma.room.delete({
      where: { id },
    });

    return { message: 'Room deleted successfully' };
  }

  async deactivateRoom(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const room = await this.prisma.room.findFirst({ where });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.prisma.room.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activateRoom(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const room = await this.prisma.room.findFirst({ where });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.prisma.room.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async getRoomsByType(schoolId: string, type: RoomType, tenantId?: string) {
    const where: any = { 
      schoolId,
      type,
      isActive: true,
    };

    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    return this.prisma.room.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        school: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getAvailableRooms(schoolId: string, startTime: Date, endTime: Date, tenantId?: string) {
    // This is a placeholder for future scheduling functionality
    // For now, return all active rooms
    const where: any = { 
      schoolId,
      isActive: true,
    };

    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    return this.prisma.room.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        school: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getRoomStats(schoolId: string, tenantId?: string) {
    const where: any = { schoolId };

    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const [
      totalRooms,
      activeRooms,
      roomsByType,
    ] = await Promise.all([
      this.prisma.room.count({ where }),
      this.prisma.room.count({ where: { ...where, isActive: true } }),
      this.prisma.room.groupBy({
        by: ['type'],
        where,
        _count: {
          type: true,
        },
      }),
    ]);

    const totalCapacity = await this.prisma.room.aggregate({
      where,
      _sum: {
        capacity: true,
      },
    });

    return {
      total: totalRooms,
      active: activeRooms,
      inactive: totalRooms - activeRooms,
      totalCapacity: totalCapacity._sum.capacity || 0,
      byType: roomsByType.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {} as Record<RoomType, number>),
    };
  }
}

