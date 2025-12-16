import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateScheduleDto, UpdateScheduleDto, CreateScheduleSessionDto, UpdateScheduleSessionDto } from '../dto/create-schedule.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private prisma: PrismaService) {}

  async create(createScheduleDto: CreateScheduleDto, userId: string) {
    try {
      // Validate that end date is after start date
      const startDate = new Date(createScheduleDto.startDate);
      const endDate = new Date(createScheduleDto.endDate);
      
      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date');
      }

      // Check if there's already an active schedule for this period
      const existingActiveSchedule = await this.prisma.schedule.findFirst({
        where: {
          schoolId: createScheduleDto.schoolId,
          isActive: true,
          OR: [
            {
              AND: [
                { startDate: { lte: startDate } },
                { endDate: { gt: startDate } },
              ],
            },
            {
              AND: [
                { startDate: { lt: endDate } },
                { endDate: { gte: endDate } },
              ],
            },
            {
              AND: [
                { startDate: { gte: startDate } },
                { endDate: { lte: endDate } },
              ],
            },
          ],
        },
      });

      if (existingActiveSchedule) {
        throw new BadRequestException('An active schedule already exists for this time period');
      }

      const schedule = await this.prisma.schedule.create({
        data: {
          ...createScheduleDto,
          startDate,
          endDate,
          status: 'DRAFT',
          version: 1,
          isActive: false,
          createdBy: userId,
          conflictCount: 0,
        },
      });

      this.logger.log(`Created schedule: ${schedule.name} for school ${schedule.schoolId}`);
      return schedule;
    } catch (error) {
      this.logger.error(`Failed to create schedule: ${error.message}`);
      throw error;
    }
  }

  async findAll(paginationDto: PaginationDto, schoolId?: string, status?: string, tenantId?: string) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.school = { tenantId };
    }

    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [schedules, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          school: {
            select: { id: true, name: true },
          },
          _count: {
            select: { sessions: true },
          },
        },
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return {
      data: schedules,
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

    const schedule = await this.prisma.schedule.findFirst({
      where,
      include: {
        school: {
          select: { id: true, name: true },
        },
        sessions: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            class: { select: { id: true, name: true, grade: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
            room: { select: { id: true, name: true, type: true } },
            timeSlot: { select: { id: true, name: true, startTime: true, endTime: true, dayOfWeek: true } },
          },
        },
        conflicts: true,
        _count: {
          select: { sessions: true },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto, tenantId?: string) {
    // Verify schedule exists and user has access
    await this.findById(id, tenantId);

    try {
      // Validate dates if both are provided
      if (updateScheduleDto.startDate && updateScheduleDto.endDate) {
        const startDate = new Date(updateScheduleDto.startDate);
        const endDate = new Date(updateScheduleDto.endDate);
        
        if (endDate <= startDate) {
          throw new BadRequestException('End date must be after start date');
        }
      }

      const schedule = await this.prisma.schedule.update({
        where: { id },
        data: {
          ...updateScheduleDto,
          startDate: updateScheduleDto.startDate ? new Date(updateScheduleDto.startDate) : undefined,
          endDate: updateScheduleDto.endDate ? new Date(updateScheduleDto.endDate) : undefined,
        },
        include: {
          school: {
            select: { id: true, name: true },
          },
        },
      });

      this.logger.log(`Updated schedule: ${schedule.id}`);
      return schedule;
    } catch (error) {
      this.logger.error(`Failed to update schedule ${id}: ${error.message}`);
      throw error;
    }
  }

  async approve(id: string, userId: string, tenantId?: string) {
    // Verify schedule exists and user has access
    const schedule = await this.findById(id, tenantId);

    if (schedule.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only schedules pending approval can be approved');
    }

    const updatedSchedule = await this.prisma.schedule.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    this.logger.log(`Approved schedule: ${updatedSchedule.id}`);
    return { message: 'Schedule approved successfully' };
  }

  async activate(id: string, tenantId?: string) {
    // Verify schedule exists and user has access
    const schedule = await this.findById(id, tenantId);

    if (schedule.status !== 'APPROVED') {
      throw new BadRequestException('Only approved schedules can be activated');
    }

    // Deactivate any existing active schedules for the same school and period
    await this.prisma.schedule.updateMany({
      where: {
        schoolId: schedule.schoolId,
        isActive: true,
        id: { not: id },
      },
      data: { isActive: false, status: 'ARCHIVED' },
    });

    const updatedSchedule = await this.prisma.schedule.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        isActive: true,
      },
    });

    this.logger.log(`Activated schedule: ${updatedSchedule.id}`);
    return { message: 'Schedule activated successfully' };
  }

  async archive(id: string, tenantId?: string) {
    // Verify schedule exists and user has access
    await this.findById(id, tenantId);

    const schedule = await this.prisma.schedule.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        isActive: false,
      },
    });

    this.logger.log(`Archived schedule: ${schedule.id}`);
    return { message: 'Schedule archived successfully' };
  }

  async delete(id: string) {
    // Check if schedule has sessions
    const sessionsCount = await this.prisma.scheduleSession.count({
      where: { scheduleId: id },
    });

    if (sessionsCount > 0) {
      throw new BadRequestException('Cannot delete schedule that has sessions. Archive it instead.');
    }

    await this.prisma.schedule.delete({
      where: { id },
    });

    this.logger.log(`Deleted schedule: ${id}`);
    return { message: 'Schedule deleted successfully' };
  }

  // Schedule Session Management
  async createSession(createSessionDto: CreateScheduleSessionDto) {
    try {
      // Validate that the schedule exists
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: createSessionDto.scheduleId },
      });

      if (!schedule) {
        throw new NotFoundException('Schedule not found');
      }

      // Check for conflicts
      const conflicts = await this.checkSessionConflicts(createSessionDto);
      if (conflicts.length > 0) {
        throw new BadRequestException(`Session conflicts detected: ${conflicts.join(', ')}`);
      }

      const session = await this.prisma.scheduleSession.create({
        data: {
          ...createSessionDto,
          date: new Date(createSessionDto.date),
          status: 'SCHEDULED',
          isRecurring: createSessionDto.isRecurring || false,
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true, grade: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          room: { select: { id: true, name: true, type: true } },
          timeSlot: { select: { id: true, name: true, startTime: true, endTime: true, dayOfWeek: true } },
        },
      });

      this.logger.log(`Created schedule session: ${session.id}`);
      return session;
    } catch (error) {
      this.logger.error(`Failed to create schedule session: ${error.message}`);
      throw error;
    }
  }

  async updateSession(id: string, updateSessionDto: UpdateScheduleSessionDto, tenantId?: string) {
    // Verify session exists and user has access
    const existingSession = await this.prisma.scheduleSession.findFirst({
      where: {
        id,
        ...(tenantId && {
          schedule: {
            school: { tenantId },
          },
        }),
      },
    });

    if (!existingSession) {
      throw new NotFoundException('Schedule session not found');
    }

    try {
      const session = await this.prisma.scheduleSession.update({
        where: { id },
        data: {
          ...updateSessionDto,
          date: updateSessionDto.date ? new Date(updateSessionDto.date) : undefined,
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true, grade: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          room: { select: { id: true, name: true, type: true } },
          timeSlot: { select: { id: true, name: true, startTime: true, endTime: true, dayOfWeek: true } },
        },
      });

      this.logger.log(`Updated schedule session: ${session.id}`);
      return session;
    } catch (error) {
      this.logger.error(`Failed to update schedule session ${id}: ${error.message}`);
      throw error;
    }
  }

  async deleteSession(id: string, tenantId?: string) {
    // Verify session exists and user has access
    const session = await this.prisma.scheduleSession.findFirst({
      where: {
        id,
        ...(tenantId && {
          schedule: {
            school: { tenantId },
          },
        }),
      },
    });

    if (!session) {
      throw new NotFoundException('Schedule session not found');
    }

    await this.prisma.scheduleSession.delete({
      where: { id },
    });

    this.logger.log(`Deleted schedule session: ${id}`);
    return { message: 'Schedule session deleted successfully' };
  }

  async getScheduleStatistics(schoolId: string, tenantId?: string) {
    const where: any = { schoolId };

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.school = { tenantId };
    }

    const [total, byStatus, activeSessions, totalConflicts] = await Promise.all([
      this.prisma.schedule.count({ where }),
      this.prisma.schedule.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.scheduleSession.count({
        where: {
          schedule: where,
          status: 'SCHEDULED',
        },
      }),
      this.prisma.scheduleConflict.count({
        where: {
          schedule: where,
          isResolved: false,
        },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {}),
      activeSessions,
      totalConflicts,
    };
  }

  private async checkSessionConflicts(sessionDto: CreateScheduleSessionDto): Promise<string[]> {
    const conflicts: string[] = [];
    const sessionDate = new Date(sessionDto.date);

    // Check teacher conflict
    const teacherConflict = await this.prisma.scheduleSession.findFirst({
      where: {
        teacherId: sessionDto.teacherId,
        timeSlotId: sessionDto.timeSlotId,
        date: sessionDate,
        status: { not: 'CANCELLED' },
      },
    });

    if (teacherConflict) {
      conflicts.push('Teacher is already scheduled at this time');
    }

    // Check room conflict
    const roomConflict = await this.prisma.scheduleSession.findFirst({
      where: {
        roomId: sessionDto.roomId,
        timeSlotId: sessionDto.timeSlotId,
        date: sessionDate,
        status: { not: 'CANCELLED' },
      },
    });

    if (roomConflict) {
      conflicts.push('Room is already booked at this time');
    }

    // Check class conflict
    const classConflict = await this.prisma.scheduleSession.findFirst({
      where: {
        classId: sessionDto.classId,
        timeSlotId: sessionDto.timeSlotId,
        date: sessionDate,
        status: { not: 'CANCELLED' },
      },
    });

    if (classConflict) {
      conflicts.push('Class already has a session at this time');
    }

    return conflicts;
  }
}

