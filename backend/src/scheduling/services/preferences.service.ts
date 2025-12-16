import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { 
  CreateSchedulingPreferenceDto, 
  UpdateSchedulingPreferenceDto,
  CreateSchedulingRuleDto,
  UpdateSchedulingRuleDto,
  CreateTeacherAvailabilityDto,
  UpdateTeacherAvailabilityDto
} from '../dto/create-preference.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(private prisma: PrismaService) {}

  // Scheduling Preferences
  async createPreference(createPreferenceDto: CreateSchedulingPreferenceDto, userId: string) {
    try {
      // Validate that the entity exists
      await this.validateEntity(createPreferenceDto.entityType, createPreferenceDto.entityId);

      const preference = await this.prisma.schedulingPreference.create({
        data: {
          ...createPreferenceDto,
          createdBy: userId,
        },
      });

      this.logger.log(`Created scheduling preference: ${preference.name} for ${preference.entityType} ${preference.entityId}`);
      return preference;
    } catch (error) {
      this.logger.error(`Failed to create scheduling preference: ${error.message}`);
      throw error;
    }
  }

  async findAllPreferences(
    paginationDto: PaginationDto, 
    schoolId?: string, 
    type?: string, 
    entityType?: string, 
    entityId?: string, 
    tenantId?: string
  ) {
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

    if (type) {
      where.type = type;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [preferences, total] = await Promise.all([
      this.prisma.schedulingPreference.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          school: {
            select: { id: true, name: true },
          },
          creator: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.schedulingPreference.count({ where }),
    ]);

    return {
      data: preferences,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPreferenceById(id: string, tenantId?: string) {
    const where: any = { id };

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.school = { tenantId };
    }

    const preference = await this.prisma.schedulingPreference.findFirst({
      where,
      include: {
        school: {
          select: { id: true, name: true },
        },
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!preference) {
      throw new NotFoundException('Scheduling preference not found');
    }

    return preference;
  }

  async updatePreference(id: string, updatePreferenceDto: UpdateSchedulingPreferenceDto, tenantId?: string) {
    // Verify preference exists and user has access
    await this.findPreferenceById(id, tenantId);

    try {
      const preference = await this.prisma.schedulingPreference.update({
        where: { id },
        data: updatePreferenceDto,
        include: {
          school: {
            select: { id: true, name: true },
          },
        },
      });

      this.logger.log(`Updated scheduling preference: ${preference.id}`);
      return preference;
    } catch (error) {
      this.logger.error(`Failed to update scheduling preference ${id}: ${error.message}`);
      throw error;
    }
  }

  async deletePreference(id: string) {
    await this.prisma.schedulingPreference.delete({
      where: { id },
    });

    this.logger.log(`Deleted scheduling preference: ${id}`);
    return { message: 'Scheduling preference deleted successfully' };
  }

  async getPreferenceStatistics(schoolId: string, tenantId?: string) {
    const where: any = { schoolId };

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.school = { tenantId };
    }

    const [total, active, byType, byEntityType] = await Promise.all([
      this.prisma.schedulingPreference.count({ where }),
      this.prisma.schedulingPreference.count({ where: { ...where, isActive: true } }),
      this.prisma.schedulingPreference.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
      }),
      this.prisma.schedulingPreference.groupBy({
        by: ['entityType'],
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
      byEntityType: byEntityType.reduce((acc, item) => {
        acc[item.entityType] = item._count.id;
        return acc;
      }, {}),
    };
  }

  // Scheduling Rules
  async createRule(createRuleDto: CreateSchedulingRuleDto, userId: string) {
    try {
      const rule = await this.prisma.schedulingRule.create({
        data: {
          ...createRuleDto,
          createdBy: userId,
        },
      });

      this.logger.log(`Created scheduling rule: ${rule.name} for school ${rule.schoolId}`);
      return rule;
    } catch (error) {
      this.logger.error(`Failed to create scheduling rule: ${error.message}`);
      throw error;
    }
  }

  async findAllRules(
    paginationDto: PaginationDto, 
    schoolId?: string, 
    type?: string, 
    isMandatory?: boolean, 
    tenantId?: string
  ) {
    const { page = 1, limit = 10, search, sortBy = 'priority', sortOrder = 'desc' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.school = { tenantId };
    }

    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (type) {
      where.type = type;
    }

    if (isMandatory !== undefined) {
      where.isMandatory = isMandatory;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rules, total] = await Promise.all([
      this.prisma.schedulingRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          school: {
            select: { id: true, name: true },
          },
          creator: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.schedulingRule.count({ where }),
    ]);

    return {
      data: rules,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findRuleById(id: string, tenantId?: string) {
    const where: any = { id };

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.school = { tenantId };
    }

    const rule = await this.prisma.schedulingRule.findFirst({
      where,
      include: {
        school: {
          select: { id: true, name: true },
        },
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!rule) {
      throw new NotFoundException('Scheduling rule not found');
    }

    return rule;
  }

  async updateRule(id: string, updateRuleDto: UpdateSchedulingRuleDto, tenantId?: string) {
    // Verify rule exists and user has access
    await this.findRuleById(id, tenantId);

    try {
      const rule = await this.prisma.schedulingRule.update({
        where: { id },
        data: updateRuleDto,
        include: {
          school: {
            select: { id: true, name: true },
          },
        },
      });

      this.logger.log(`Updated scheduling rule: ${rule.id}`);
      return rule;
    } catch (error) {
      this.logger.error(`Failed to update scheduling rule ${id}: ${error.message}`);
      throw error;
    }
  }

  async deleteRule(id: string) {
    await this.prisma.schedulingRule.delete({
      where: { id },
    });

    this.logger.log(`Deleted scheduling rule: ${id}`);
    return { message: 'Scheduling rule deleted successfully' };
  }

  // Teacher Availability
  async createAvailability(createAvailabilityDto: CreateTeacherAvailabilityDto) {
    try {
      // Validate that end time is after start time
      const startTime = this.parseTime(createAvailabilityDto.startTime);
      const endTime = this.parseTime(createAvailabilityDto.endTime);
      
      if (endTime <= startTime) {
        throw new BadRequestException('End time must be after start time');
      }

      // Check for overlapping availability for the same teacher and day
      await this.validateNoAvailabilityOverlap(
        createAvailabilityDto.teacherId,
        createAvailabilityDto.dayOfWeek,
        createAvailabilityDto.startTime,
        createAvailabilityDto.endTime,
        createAvailabilityDto.specificDate
      );

      const availability = await this.prisma.teacherAvailability.create({
        data: {
          ...createAvailabilityDto,
          effectiveFrom: new Date(createAvailabilityDto.effectiveFrom),
          effectiveTo: createAvailabilityDto.effectiveTo ? new Date(createAvailabilityDto.effectiveTo) : undefined,
          specificDate: createAvailabilityDto.specificDate ? new Date(createAvailabilityDto.specificDate) : undefined,
        },
      });

      this.logger.log(`Created teacher availability: ${availability.id} for teacher ${availability.teacherId}`);
      return availability;
    } catch (error) {
      this.logger.error(`Failed to create teacher availability: ${error.message}`);
      throw error;
    }
  }

  async findAllAvailability(
    paginationDto: PaginationDto, 
    teacherId?: string, 
    dayOfWeek?: number, 
    type?: string, 
    tenantId?: string
  ) {
    const { page = 1, limit = 10, sortBy = 'dayOfWeek', sortOrder = 'asc' } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.teacher = { tenantId };
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    if (dayOfWeek !== undefined) {
      where.dayOfWeek = dayOfWeek;
    }

    if (type) {
      where.type = type;
    }

    const [availabilities, total] = await Promise.all([
      this.prisma.teacherAvailability.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { dayOfWeek: 'asc' },
          { startTime: 'asc' },
        ],
        include: {
          teacher: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.teacherAvailability.count({ where }),
    ]);

    return {
      data: availabilities,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findTeacherAvailability(teacherId: string, tenantId?: string) {
    const where: any = { teacherId, isActive: true };

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.teacher = { tenantId };
    }

    const availabilities = await this.prisma.teacherAvailability.findMany({
      where,
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Group by day of week
    const groupedByDay = availabilities.reduce((acc, availability) => {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[availability.dayOfWeek];
      
      if (!acc[dayName]) {
        acc[dayName] = [];
      }
      acc[dayName].push(availability);
      return acc;
    }, {} as Record<string, any[]>);

    return {
      teacherId,
      availabilities,
      groupedByDay,
    };
  }

  async findAvailabilityById(id: string, tenantId?: string) {
    const where: any = { id };

    // Apply tenant filtering for non-super-admin users
    if (tenantId) {
      where.teacher = { tenantId };
    }

    const availability = await this.prisma.teacherAvailability.findFirst({
      where,
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!availability) {
      throw new NotFoundException('Teacher availability not found');
    }

    return availability;
  }

  async updateAvailability(
    id: string, 
    updateAvailabilityDto: UpdateTeacherAvailabilityDto, 
    tenantId?: string,
    userId?: string,
    userRole?: UserRole
  ) {
    // Verify availability exists and user has access
    const availability = await this.findAvailabilityById(id, tenantId);

    // Check if teacher is trying to update someone else's availability
    if (userRole === UserRole.TEACHER && availability.teacherId !== userId) {
      throw new ForbiddenException('Teachers can only update their own availability');
    }

    try {
      // Validate times if both are provided
      if (updateAvailabilityDto.startTime && updateAvailabilityDto.endTime) {
        const startTime = this.parseTime(updateAvailabilityDto.startTime);
        const endTime = this.parseTime(updateAvailabilityDto.endTime);
        
        if (endTime <= startTime) {
          throw new BadRequestException('End time must be after start time');
        }
      }

      const updatedAvailability = await this.prisma.teacherAvailability.update({
        where: { id },
        data: {
          ...updateAvailabilityDto,
          effectiveTo: updateAvailabilityDto.effectiveTo ? new Date(updateAvailabilityDto.effectiveTo) : undefined,
        },
        include: {
          teacher: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      this.logger.log(`Updated teacher availability: ${updatedAvailability.id}`);
      return updatedAvailability;
    } catch (error) {
      this.logger.error(`Failed to update teacher availability ${id}: ${error.message}`);
      throw error;
    }
  }

  async deleteAvailability(id: string, tenantId?: string, userId?: string, userRole?: UserRole) {
    // Verify availability exists and user has access
    const availability = await this.findAvailabilityById(id, tenantId);

    // Check if teacher is trying to delete someone else's availability
    if (userRole === UserRole.TEACHER && availability.teacherId !== userId) {
      throw new ForbiddenException('Teachers can only delete their own availability');
    }

    await this.prisma.teacherAvailability.delete({
      where: { id },
    });

    this.logger.log(`Deleted teacher availability: ${id}`);
    return { message: 'Teacher availability deleted successfully' };
  }

  // Bulk Operations
  async createBulkPreferences(preferences: CreateSchedulingPreferenceDto[], userId: string) {
    try {
      const createdPreferences = await this.prisma.$transaction(
        preferences.map(preference => 
          this.prisma.schedulingPreference.create({
            data: {
              ...preference,
              createdBy: userId,
            },
          })
        )
      );

      this.logger.log(`Created ${createdPreferences.length} scheduling preferences in bulk`);
      return {
        success: true,
        created: createdPreferences.length,
        preferences: createdPreferences,
      };
    } catch (error) {
      this.logger.error(`Failed to create bulk preferences: ${error.message}`);
      throw error;
    }
  }

  async createBulkAvailability(availabilities: CreateTeacherAvailabilityDto[]) {
    try {
      const createdAvailabilities = await this.prisma.$transaction(
        availabilities.map(availability => 
          this.prisma.teacherAvailability.create({
            data: {
              ...availability,
              effectiveFrom: new Date(availability.effectiveFrom),
              effectiveTo: availability.effectiveTo ? new Date(availability.effectiveTo) : undefined,
              specificDate: availability.specificDate ? new Date(availability.specificDate) : undefined,
            },
          })
        )
      );

      this.logger.log(`Created ${createdAvailabilities.length} teacher availabilities in bulk`);
      return {
        success: true,
        created: createdAvailabilities.length,
        availabilities: createdAvailabilities,
      };
    } catch (error) {
      this.logger.error(`Failed to create bulk availabilities: ${error.message}`);
      throw error;
    }
  }

  // Template Operations
  getPreferenceTemplates() {
    return {
      teacherPreference: {
        type: 'TEACHER_PREFERENCE',
        entityType: 'TEACHER',
        name: 'Teacher Time Preference',
        description: 'Teacher prefers specific time slots',
        weight: 8,
        isHardConstraint: false,
        parameters: {
          preferredTimeSlots: ['slot-id-1', 'slot-id-2'],
          avoidTimeSlots: ['slot-id-3'],
          maxConsecutiveSessions: 3,
        },
      },
      workloadDistribution: {
        type: 'WORKLOAD_DISTRIBUTION',
        entityType: 'TEACHER',
        name: 'Workload Distribution',
        description: 'Even distribution of teacher workload',
        weight: 7,
        isHardConstraint: false,
        parameters: {
          maxSessionsPerDay: 6,
          minSessionsPerDay: 2,
          targetSessionsPerDay: 4,
          maxConsecutiveDays: 5,
        },
      },
      roomPreference: {
        type: 'ROOM_PREFERENCE',
        entityType: 'SUBJECT',
        name: 'Subject Room Preference',
        description: 'Subject prefers specific room types',
        weight: 5,
        isHardConstraint: false,
        parameters: {
          preferredRoomTypes: ['LABORATORY', 'CLASSROOM'],
          avoidRoomTypes: ['AUDITORIUM'],
        },
      },
    };
  }

  getRuleTemplates() {
    return {
      institutionalPolicy: {
        type: 'INSTITUTIONAL_POLICY',
        name: 'No Classes After 4 PM',
        description: 'School policy: No regular classes after 4 PM',
        priority: 9,
        isMandatory: true,
        conditions: {
          timeAfter: '16:00',
          sessionTypes: ['REGULAR'],
        },
        actions: {
          block: true,
          message: 'Regular classes not allowed after 4 PM',
        },
      },
      workloadLimit: {
        type: 'WORKLOAD_LIMIT',
        name: 'Teacher Daily Limit',
        description: 'Teachers cannot have more than 8 sessions per day',
        priority: 8,
        isMandatory: true,
        conditions: {
          maxSessionsPerDay: 8,
          entityType: 'TEACHER',
        },
        actions: {
          block: true,
          message: 'Teacher daily session limit exceeded',
        },
      },
      consecutivePeriods: {
        type: 'CONSECUTIVE_PERIODS',
        name: 'Max Consecutive Subjects',
        description: 'No more than 2 consecutive periods of the same subject',
        priority: 6,
        isMandatory: false,
        conditions: {
          maxConsecutive: 2,
          entityType: 'SUBJECT',
        },
        actions: {
          warn: true,
          message: 'Too many consecutive periods of the same subject',
        },
      },
    };
  }

  // Helper Methods
  private parseTime(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private async validateEntity(entityType: string, entityId: string) {
    let exists = false;

    switch (entityType) {
      case 'TEACHER':
        exists = await this.prisma.user.findFirst({
          where: { id: entityId, role: 'TEACHER' },
        }) !== null;
        break;
      case 'ROOM':
        exists = await this.prisma.room.findFirst({
          where: { id: entityId },
        }) !== null;
        break;
      case 'SUBJECT':
        exists = await this.prisma.subject.findFirst({
          where: { id: entityId },
        }) !== null;
        break;
      case 'CLASS':
        exists = await this.prisma.class.findFirst({
          where: { id: entityId },
        }) !== null;
        break;
      case 'SCHOOL':
        exists = await this.prisma.school.findFirst({
          where: { id: entityId },
        }) !== null;
        break;
      default:
        throw new BadRequestException(`Invalid entity type: ${entityType}`);
    }

    if (!exists) {
      throw new NotFoundException(`${entityType} with ID ${entityId} not found`);
    }
  }

  private async validateNoAvailabilityOverlap(
    teacherId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    specificDate?: string,
    excludeId?: string
  ) {
    const where: any = {
      teacherId,
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

    if (specificDate) {
      where.specificDate = new Date(specificDate);
    }

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const overlapping = await this.prisma.teacherAvailability.findFirst({ where });

    if (overlapping) {
      throw new BadRequestException(`Teacher availability overlaps with existing availability`);
    }
  }
}

