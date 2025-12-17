import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTimeSlotDto, UpdateTimeSlotDto } from '../dto/create-time-slot.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class TimeSlotService {
  private readonly logger = new Logger(TimeSlotService.name);

  constructor(private prisma: PrismaService) {}

  async create(createTimeSlotDto: CreateTimeSlotDto) {
    try {
      // Validate that end time is after start time
      const startTime: Date = this.parseTime(createTimeSlotDto.startTime);
      const endTime: Date = this.parseTime(createTimeSlotDto.endTime);
      
      if (endTime <= startTime) {
        throw new BadRequestException('End time must be after start time');
      }

      // Calculate duration if not provided or validate if provided
      const calculatedDuration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes
      if (Math.abs(calculatedDuration - createTimeSlotDto.duration) > 1) {
        throw new BadRequestException('Duration does not match start and end times');
      }

      // Check for overlapping time slots on the same day
      await this.validateNoOverlap(
        createTimeSlotDto.schoolId,
        createTimeSlotDto.dayOfWeek,
        createTimeSlotDto.startTime,
        createTimeSlotDto.endTime
      );

      const timeSlot = await this.prisma.timeSlot.create({
        data: {
          ...createTimeSlotDto,
          isActive: true,
        },
      });

      this.logger.log(`Created time slot: ${timeSlot.name} for school ${timeSlot.schoolId}`);
      return timeSlot;
    } catch (error) {
      this.logger.error(`Failed to create time slot: ${error.message}`);
      throw error;
    }
  }

  async findAll(paginationDto: PaginationDto, schoolId?: string, dayOfWeek?: number, type?: string, tenantId?: string) {
    const { page = 1, limit = 10, search, sortBy = 'order', sortOrder = 'asc' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.school = { tenantId };
    }

    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (dayOfWeek !== undefined) {
      where.dayOfWeek = dayOfWeek;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [timeSlots, total] = await Promise.all([
      this.prisma.timeSlot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          school: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.timeSlot.count({ where }),
    ]);

    return {
      data: timeSlots,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, tenantId?: string) {
    const where: any = { id };

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.school = { tenantId };
    }

    const timeSlot = await this.prisma.timeSlot.findFirst({
      where,
      include: {
        school: {
          select: { id: true, name: true },
        },
      },
    });

    if (!timeSlot) {
      throw new NotFoundException('Time slot not found');
    }

    return timeSlot;
  }

  async findBySchoolAndDay(schoolId: string, dayOfWeek: number, tenantId?: string) {
    const where: any = { schoolId, dayOfWeek, isActive: true };

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.school = { tenantId };
    }

    return this.prisma.timeSlot.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        school: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async update(id: string, updateTimeSlotDto: UpdateTimeSlotDto, tenantId?: string) {
    // Verify time slot exists and user has access
    await this.findById(id, tenantId);

    try {
      // Validate times if both are provided
      if (updateTimeSlotDto.startTime && updateTimeSlotDto.endTime) {
        const startTime: Date = this.parseTime(updateTimeSlotDto.startTime);
        const endTime: Date = this.parseTime(updateTimeSlotDto.endTime);
        
        if (endTime <= startTime) {
          throw new BadRequestException('End time must be after start time');
        }

        // Calculate duration if not provided
        if (!updateTimeSlotDto.duration) {
          updateTimeSlotDto.duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        }
      }

      const timeSlot = await this.prisma.timeSlot.update({
        where: { id },
        data: updateTimeSlotDto,
        include: {
          school: {
            select: { id: true, name: true },
          },
        },
      });

      this.logger.log(`Updated time slot: ${timeSlot.id}`);
      return timeSlot;
    } catch (error) {
      this.logger.error(`Failed to update time slot ${id}: ${error.message}`);
      throw error;
    }
  }

  async deactivate(id: string, tenantId?: string) {
    // Verify time slot exists and user has access
    await this.findById(id, tenantId);

    const timeSlot = await this.prisma.timeSlot.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Deactivated time slot: ${timeSlot.id}`);
    return { message: 'Time slot deactivated successfully' };
  }

  async activate(id: string, tenantId?: string) {
    // Verify time slot exists and user has access
    await this.findById(id, tenantId);

    const timeSlot = await this.prisma.timeSlot.update({
      where: { id },
      data: { isActive: true },
    });

    this.logger.log(`Activated time slot: ${timeSlot.id}`);
    return { message: 'Time slot activated successfully' };
  }

  async delete(id: string) {
    // Check if time slot is being used in any schedules
    const sessionsCount = await this.prisma.scheduleSession.count({
      where: { timeSlotId: id },
    });

    if (sessionsCount > 0) {
      throw new BadRequestException('Cannot delete time slot that is being used in schedules');
    }

    await this.prisma.timeSlot.delete({
      where: { id },
    });

    this.logger.log(`Deleted time slot: ${id}`);
    return { message: 'Time slot deleted successfully' };
  }

  async getTimeSlotStatistics(schoolId: string, tenantId?: string) {
    const where: any = { schoolId };

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.school = { tenantId };
    }

    const [total, active, byType, byDay] = await Promise.all([
      this.prisma.timeSlot.count({ where }),
      this.prisma.timeSlot.count({ where: { ...where, isActive: true } }),
      this.prisma.timeSlot.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
      }),
      this.prisma.timeSlot.groupBy({
        by: ['dayOfWeek'],
        where,
        _count: { id: true },
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      }, {}),
      byDay: byDay.reduce((acc, item) => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        acc[dayNames[item.dayOfWeek]] = item._count.id;
        return acc;
      }, {}),
    };
  }

  private parseTime(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private async validateNoOverlap(schoolId: string, dayOfWeek: number, startTime: string, endTime: string, excludeId?: string) {
    const where: any = {
      schoolId,
      dayOfWeek,
      isActive: true,
      OR: [
        {
          AND: [
            { startTime: { lte: startTime } },
            { endTime: { gt: startTime } },
          ],
        },
        {
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gte: endTime } },
          ],
        },
        {
          AND: [
            { startTime: { gte: startTime } },
            { endTime: { lte: endTime } },
          ],
        },
      ],
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const overlapping = await this.prisma.timeSlot.findFirst({ where });

    if (overlapping) {
      throw new BadRequestException(`Time slot overlaps with existing slot: ${overlapping.name}`);
    }
  }
}
