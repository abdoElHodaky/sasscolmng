import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async create(createSubjectDto: CreateSubjectDto) {
    // Verify school exists and is active
    const school = await this.prisma.school.findUnique({
      where: { id: createSubjectDto.schoolId },
      include: { tenant: true },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    if (!school.isActive) {
      throw new BadRequestException('Cannot create subject for inactive school');
    }

    // Check if subject with same code already exists for this school
    const existingSubject = await this.prisma.subject.findFirst({
      where: {
        code: createSubjectDto.code,
        schoolId: createSubjectDto.schoolId,
      },
    });

    if (existingSubject) {
      throw new BadRequestException(
        'Subject with this code already exists for this school',
      );
    }

    return this.prisma.subject.create({
      data: createSubjectDto,
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
        teachers: {
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
        classSubjects: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                grade: true,
                capacity: true,
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
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [subjects, total] = await Promise.all([
      this.prisma.subject.findMany({
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
          teachers: {
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
          classSubjects: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.subject.count({ where }),
    ]);

    // Add computed fields
    const enrichedSubjects = subjects.map((subject) => ({
      ...subject,
      teacherCount: subject.teachers.length,
      classCount: subject.classSubjects.length,
      activeClassCount: subject.classSubjects.filter((cs) => cs.class.isActive).length,
    }));

    return new PaginatedResponseDto(enrichedSubjects, total, page, limit);
  }

  async findById(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const subject = await this.prisma.subject.findFirst({
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
        teachers: {
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
        classSubjects: {
          include: {
            class: {
              include: {
                students: {
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
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return subject;
  }

  async update(id: string, updateSubjectDto: UpdateSubjectDto, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const subject = await this.prisma.subject.findFirst({ 
      where,
      include: { school: true },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    // Check if code is being changed and if it already exists for this school
    if (updateSubjectDto.code) {
      const existingSubject = await this.prisma.subject.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { code: updateSubjectDto.code },
            { schoolId: subject.schoolId },
          ],
        },
      });

      if (existingSubject) {
        throw new BadRequestException(
          'Subject with this code already exists for this school',
        );
      }
    }

    return this.prisma.subject.update({
      where: { id },
      data: updateSubjectDto,
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
        teachers: {
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

    const subject = await this.prisma.subject.findFirst({
      where,
      include: {
        teachers: true,
        classSubjects: true,
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    // Check if subject has associated data
    if (subject.teachers.length > 0 || subject.classSubjects.length > 0) {
      throw new BadRequestException(
        'Cannot delete subject with existing teacher assignments or classes. Please remove all associations first.',
      );
    }

    await this.prisma.subject.delete({
      where: { id },
    });

    return { message: 'Subject deleted successfully' };
  }

  async deactivateSubject(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const subject = await this.prisma.subject.findFirst({ where });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return this.prisma.subject.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activateSubject(id: string, tenantId?: string) {
    const where: any = { id };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const subject = await this.prisma.subject.findFirst({ where });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return this.prisma.subject.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async assignTeacher(subjectId: string, teacherId: string, tenantId?: string) {
    const where: any = { id: subjectId };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const subject = await this.prisma.subject.findFirst({ where });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    // Verify teacher exists and belongs to the same school
    const teacher = await this.prisma.teacherProfile.findFirst({
      where: {
        id: teacherId,
        user: { schoolId: subject.schoolId },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found or does not belong to this school');
    }

    // Check if assignment already exists
    const existingAssignment = await this.prisma.teacherSubject.findFirst({
      where: {
        subjectId,
        teacherId,
      },
    });

    if (existingAssignment) {
      throw new BadRequestException('Teacher is already assigned to this subject');
    }

    return this.prisma.teacherSubject.create({
      data: {
        subjectId,
        teacherId,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async removeTeacher(subjectId: string, teacherId: string, tenantId?: string) {
    const where: any = { id: subjectId };
    
    // Apply tenant filter if provided
    if (tenantId) {
      where.school = { tenantId };
    }

    const subject = await this.prisma.subject.findFirst({ where });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    const assignment = await this.prisma.teacherSubject.findFirst({
      where: {
        subjectId,
        teacherId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Teacher assignment not found');
    }

    await this.prisma.teacherSubject.delete({
      where: { id: assignment.id },
    });

    return { message: 'Teacher removed from subject successfully' };
  }
}
