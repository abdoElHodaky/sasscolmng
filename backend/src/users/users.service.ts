import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: createUserDto,
      include: {
        tenant: true,
        school: true,
        teacherProfile: true,
        studentProfile: true,
      },
    });

    // Create role-specific profile
    if (user.role === UserRole.TEACHER) {
      await this.prisma.teacherProfile.create({
        data: {
          userId: user.id,
        },
      });
    } else if (user.role === UserRole.STUDENT) {
      await this.prisma.studentProfile.create({
        data: {
          userId: user.id,
        },
      });
    }

    const { password, ...result } = user;
    return result;
  }

  async findAll(paginationDto: PaginationDto, tenantId?: string) {
    const { page, limit, search, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          tenant: true,
          school: true,
          teacherProfile: true,
          studentProfile: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Remove password from results
    const sanitizedUsers = users.map(({ password, ...user }) => user);

    return new PaginatedResponseDto(sanitizedUsers, total, page, limit);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        tenant: true,
        school: true,
        teacherProfile: true,
        studentProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, ...result } = user;
    return result;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        school: true,
        teacherProfile: true,
        studentProfile: true,
      },
    });
  }

  async findByIdWithPassword(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        tenant: true,
        school: true,
        teacherProfile: true,
        studentProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is being changed and if it already exists
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      include: {
        tenant: true,
        school: true,
        teacherProfile: true,
        studentProfile: true,
      },
    });

    const { password, ...result } = updatedUser;
    return result;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  async updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async updatePassword(id: string, hashedPassword: string) {
    return this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async deactivateUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activateUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async getUsersByRole(role: UserRole, tenantId?: string) {
    const where: any = { role };
    
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        teacherProfile: true,
        studentProfile: true,
      },
    });

    return users.map(({ password, ...user }) => user);
  }

  async getUserStats(tenantId?: string) {
    const where: any = {};
    
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const [
      totalUsers,
      activeUsers,
      teacherCount,
      studentCount,
      adminCount,
    ] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { ...where, isActive: true } }),
      this.prisma.user.count({ where: { ...where, role: UserRole.TEACHER } }),
      this.prisma.user.count({ where: { ...where, role: UserRole.STUDENT } }),
      this.prisma.user.count({ 
        where: { 
          ...where, 
          role: { in: [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN] } 
        } 
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      teacherCount,
      studentCount,
      adminCount,
    };
  }
}
