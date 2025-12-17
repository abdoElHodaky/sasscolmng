import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  async create(createSchoolDto: CreateSchoolDto) {
    // Verify tenant exists and is active
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: createSchoolDto.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.isActive) {
      throw new BadRequestException('Cannot create school for inactive tenant');
    }

    // Check if school with same name already exists for this tenant
    const existingSchool = await this.prisma.school.findFirst({
      where: {
        name: createSchoolDto.name,
        tenantId: createSchoolDto.tenantId,
      },
    });

    if (existingSchool) {
      throw new BadRequestException(
        'School with this name already exists for this tenant',
      );
    }

    return this.prisma.school.create({
      data: createSchoolDto,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
        subjects: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        },
        classes: {
          select: {
            id: true,
            name: true,
            grade: true,
            capacity: true,
            isActive: true,
          },
        },
        rooms: {
          select: {
            id: true,
            name: true,
            type: true,
            capacity: true,
            isActive: true,
          },
        },
      },
    });
  }

  async findAll(paginationDto: PaginationDto, tenantId?: string) {
    const { page, limit, search, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Apply tenant filter if provided
    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [schools, total] = await Promise.all([
      this.prisma.school.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
          users: {
            select: {
              id: true,
              role: true,
              isActive: true,
            },
          },
          subjects: {
            select: {
              id: true,
              isActive: true,
            },
          },
          classes: {
            select: {
              id: true,
              isActive: true,
            },
          },
          rooms: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.school.count({ where }),
    ]);

    // Add computed fields
    const enrichedSchools = schools.map((school) => ({
      ...school,
      userCount: school.users.length,
      activeUserCount: school.users.filter((u) => u.isActive).length,
      subjectCount: school.subjects.length,
      activeSubjectCount: school.subjects.filter((s) => s.isActive).length,
      classCount: school.classes.length,
      activeClassCount: school.classes.filter((c) => c.isActive).length,
      roomCount: school.rooms.length,
      activeRoomCount: school.rooms.filter((r) => r.isActive).length,
    }));

    return new PaginatedResponseDto(enrichedSchools, total, page, limit);
  }

  async findById(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const school = await this.prisma.school.findFirst({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            isActive: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        subjects: {
          include: {
            teachers: {
              select: {
                id: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        classes: {
          include: {
            subjects: {
              include: {
                subject: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        rooms: true,
      },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return school;
  }

  async update(id: string, updateSchoolDto: UpdateSchoolDto, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const school = await this.prisma.school.findFirst({ where });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Check if name is being changed and if it already exists for this tenant
    if (updateSchoolDto.name) {
      const existingSchool = await this.prisma.school.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { name: updateSchoolDto.name },
            { tenantId: school.tenantId },
          ],
        },
      });

      if (existingSchool) {
        throw new BadRequestException(
          'School with this name already exists for this tenant',
        );
      }
    }

    return this.prisma.school.update({
      where: { id },
      data: updateSchoolDto,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  async remove(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const school = await this.prisma.school.findFirst({
      where,
      include: {
        users: true,
        subjects: true,
        classes: true,
        rooms: true,
      },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Check if school has associated data
    if (
      school.users.length > 0 ||
      school.subjects.length > 0 ||
      school.classes.length > 0 ||
      school.rooms.length > 0
    ) {
      throw new BadRequestException(
        'Cannot delete school with existing users, subjects, classes, or rooms. Please remove all associated data first.',
      );
    }

    await this.prisma.school.delete({
      where: { id },
    });

    return { message: 'School deleted successfully' };
  }

  async deactivateSchool(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const school = await this.prisma.school.findFirst({ where });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Deactivate school and all associated users, subjects, classes, and rooms
    await this.prisma.$transaction([
      this.prisma.school.update({
        where: { id },
        data: { isActive: false },
      }),
      this.prisma.user.updateMany({
        where: { schoolId: id },
        data: { isActive: false },
      }),
      this.prisma.subject.updateMany({
        where: { schoolId: id },
        data: { isActive: false },
      }),
      this.prisma.class.updateMany({
        where: { schoolId: id },
        data: { isActive: false },
      }),
      this.prisma.room.updateMany({
        where: { schoolId: id },
        data: { isActive: false },
      }),
    ]);

    return { message: 'School and all associated data deactivated successfully' };
  }

  async activateSchool(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const school = await this.prisma.school.findFirst({ where });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return this.prisma.school.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async getSchoolStats(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const school = await this.prisma.school.findFirst({ where });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const [
      userCount,
      activeUserCount,
      teacherCount,
      studentCount,
      subjectCount,
      activeSubjectCount,
      classCount,
      activeClassCount,
      roomCount,
      activeRoomCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { schoolId: id } }),
      this.prisma.user.count({ where: { schoolId: id, isActive: true } }),
      this.prisma.user.count({ where: { schoolId: id, role: 'TEACHER' } }),
      this.prisma.user.count({ where: { schoolId: id, role: 'STUDENT' } }),
      this.prisma.subject.count({ where: { schoolId: id } }),
      this.prisma.subject.count({ where: { schoolId: id, isActive: true } }),
      this.prisma.class.count({ where: { schoolId: id } }),
      this.prisma.class.count({ where: { schoolId: id, isActive: true } }),
      this.prisma.room.count({ where: { schoolId: id } }),
      this.prisma.room.count({ where: { schoolId: id, isActive: true } }),
    ]);

    return {
      school: {
        id: school.id,
        name: school.name,
        tenantId: school.tenantId,
        isActive: school.isActive,
      },
      statistics: {
        users: {
          total: userCount,
          active: activeUserCount,
          inactive: userCount - activeUserCount,
          teachers: teacherCount,
          students: studentCount,
        },
        academic: {
          subjects: {
            total: subjectCount,
            active: activeSubjectCount,
            inactive: subjectCount - activeSubjectCount,
          },
          classes: {
            total: classCount,
            active: activeClassCount,
            inactive: classCount - activeClassCount,
          },
          rooms: {
            total: roomCount,
            active: activeRoomCount,
            inactive: roomCount - activeRoomCount,
          },
        },
      },
    };
  }
}
