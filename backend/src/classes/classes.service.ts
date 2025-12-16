import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async create(createClassDto: CreateClassDto) {
    // Verify school exists and is active
    const school = await this.prisma.school.findUnique({
      where: { id: createClassDto.schoolId },
      include: { tenant: true },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    if (!school.isActive) {
      throw new BadRequestException('Cannot create class for inactive school');
    }

    // Check if class with same name already exists for this school
    const existingClass = await this.prisma.class.findFirst({
      where: {
        name: createClassDto.name,
        schoolId: createClassDto.schoolId,
      },
    });

    if (existingClass) {
      throw new BadRequestException(
        'Class with this name already exists for this school',
      );
    }

    return this.prisma.class.create({
      data: createClassDto,
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
        subjects: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                code: true,
                isActive: true,
              },
            },
          },
        },
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll(paginationDto: PaginationDto, schoolId?: string, tenantId?: string) {
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

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [classes, total] = await Promise.all([
      this.prisma.class.findMany({
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
          subjects: {
            include: {
              subject: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  isActive: true,
                },
              },
            },
          },
          students: {
            include: {
              user: {
                select: {
                  id: true,
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.class.count({ where }),
    ]);

    // Add computed fields
    const enrichedClasses = classes.map((classItem) => ({
      ...classItem,
      subjectCount: classItem.subjects.length,
      activeSubjectCount: classItem.subjects.filter((s) => s.subject.isActive).length,
      studentCount: classItem.students.length,
      activeStudentCount: classItem.students.filter((s) => s.user.isActive).length,
      availableCapacity: classItem.capacity - classItem.students.length,
    }));

    return new PaginatedResponseDto(enrichedClasses, total, page, limit);
  }

  async findById(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const classItem = await this.prisma.class.findFirst({
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
        subjects: {
          include: {
            subject: {
              include: {
                teachers: {
                  include: {
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
          },
        },
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isActive: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!classItem) {
      throw new NotFoundException('Class not found');
    }

    return classItem;
  }

  async update(id: string, updateClassDto: UpdateClassDto, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const classItem = await this.prisma.class.findFirst({ 
      where,
      include: { school: true },
    });

    if (!classItem) {
      throw new NotFoundException('Class not found');
    }

    // Check if name is being changed and if it already exists for this school
    if (updateClassDto.name) {
      const existingClass = await this.prisma.class.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { name: updateClassDto.name },
            { schoolId: classItem.schoolId },
          ],
        },
      });

      if (existingClass) {
        throw new BadRequestException(
          'Class with this name already exists for this school',
        );
      }
    }

    // Check if capacity is being reduced below current student count
    if (updateClassDto.capacity) {
      const currentStudentCount = await this.prisma.studentProfile.count({
        where: { classId: id },
      });

      if (updateClassDto.capacity < currentStudentCount) {
        throw new BadRequestException(
          `Cannot reduce capacity below current student count (${currentStudentCount})`,
        );
      }
    }

    return this.prisma.class.update({
      where: { id },
      data: updateClassDto,
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
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
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

    const classItem = await this.prisma.class.findFirst({
      where,
      include: {
        subjects: true,
        students: true,
      },
    });

    if (!classItem) {
      throw new NotFoundException('Class not found');
    }

    // Check if class has associated data
    if (classItem.subjects.length > 0 || classItem.students.length > 0) {
      throw new BadRequestException(
        'Cannot delete class with existing subject assignments or students. Please remove all associations first.',
      );
    }

    await this.prisma.class.delete({
      where: { id },
    });

    return { message: 'Class deleted successfully' };
  }

  async deactivateClass(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const classItem = await this.prisma.class.findFirst({ where });

    if (!classItem) {
      throw new NotFoundException('Class not found');
    }

    return this.prisma.class.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activateClass(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const classItem = await this.prisma.class.findFirst({ where });

    if (!classItem) {
      throw new NotFoundException('Class not found');
    }

    return this.prisma.class.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async assignSubject(classId: string, subjectId: string, tenantId?: string) {
    const where: any = { id: classId };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const classItem = await this.prisma.class.findFirst({ where });

    if (!classItem) {
      throw new NotFoundException('Class not found');
    }

    // Verify subject exists and belongs to the same school
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId: classItem.schoolId,
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found or does not belong to this school');
    }

    // Check if assignment already exists
    const existingAssignment = await this.prisma.classSubject.findFirst({
      where: {
        classId,
        subjectId,
      },
    });

    if (existingAssignment) {
      throw new BadRequestException('Subject is already assigned to this class');
    }

    return this.prisma.classSubject.create({
      data: {
        classId,
        subjectId,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async removeSubject(classId: string, subjectId: string, tenantId?: string) {
    const where: any = { id: classId };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const classItem = await this.prisma.class.findFirst({ where });

    if (!classItem) {
      throw new NotFoundException('Class not found');
    }

    const assignment = await this.prisma.classSubject.findFirst({
      where: {
        classId,
        subjectId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Subject assignment not found');
    }

    await this.prisma.classSubject.delete({
      where: { id: assignment.id },
    });

    return { message: 'Subject removed from class successfully' };
  }
}

