import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    // Check if tenant with same name or subdomain already exists
    const existingTenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { name: createTenantDto.name },
          { subdomain: createTenantDto.subdomain },
        ],
      },
    });

    if (existingTenant) {
      throw new BadRequestException(
        'Tenant with this name or subdomain already exists',
      );
    }

    return this.prisma.tenant.create({
      data: createTenantDto,
      include: {
        schools: true,
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

  async findAll(paginationDto: PaginationDto) {
    const { page, limit, search, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          schools: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
          users: {
            select: {
              id: true,
              role: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    // Add computed fields
    const enrichedTenants = tenants.map((tenant) => ({
      ...tenant,
      schoolCount: tenant.schools.length,
      activeSchoolCount: tenant.schools.filter((s) => s.isActive).length,
      userCount: tenant.users.length,
      activeUserCount: tenant.users.filter((u) => u.isActive).length,
    }));

    return new PaginatedResponseDto(enrichedTenants, total, page, limit);
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        schools: {
          include: {
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
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findBySubdomain(subdomain: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
      include: {
        schools: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.isActive) {
      throw new BadRequestException('Tenant is not active');
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check if name or subdomain is being changed and if it already exists
    if (updateTenantDto.name || updateTenantDto.subdomain) {
      const existingTenant = await this.prisma.tenant.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                updateTenantDto.name ? { name: updateTenantDto.name } : {},
                updateTenantDto.subdomain ? { subdomain: updateTenantDto.subdomain } : {},
              ].filter(obj => Object.keys(obj).length > 0),
            },
          ],
        },
      });

      if (existingTenant) {
        throw new BadRequestException(
          'Tenant with this name or subdomain already exists',
        );
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
      include: {
        schools: true,
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

  async remove(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        schools: true,
        users: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check if tenant has active schools or users
    if (tenant.schools.length > 0 || tenant.users.length > 0) {
      throw new BadRequestException(
        'Cannot delete tenant with existing schools or users. Please remove all associated data first.',
      );
    }

    await this.prisma.tenant.delete({
      where: { id },
    });

    return { message: 'Tenant deleted successfully' };
  }

  async deactivateTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Deactivate tenant and all associated schools and users
    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id },
        data: { isActive: false },
      }),
      this.prisma.school.updateMany({
        where: { tenantId: id },
        data: { isActive: false },
      }),
      this.prisma.user.updateMany({
        where: { tenantId: id },
        data: { isActive: false },
      }),
    ]);

    return { message: 'Tenant and all associated data deactivated successfully' };
  }

  async activateTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async getTenantStats(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [
      schoolCount,
      activeSchoolCount,
      userCount,
      activeUserCount,
      subjectCount,
      classCount,
      roomCount,
    ] = await Promise.all([
      this.prisma.school.count({ where: { tenantId: id } }),
      this.prisma.school.count({ where: { tenantId: id, isActive: true } }),
      this.prisma.user.count({ where: { tenantId: id } }),
      this.prisma.user.count({ where: { tenantId: id, isActive: true } }),
      this.prisma.subject.count({ 
        where: { 
          school: { tenantId: id } 
        } 
      }),
      this.prisma.class.count({ 
        where: { 
          school: { tenantId: id } 
        } 
      }),
      this.prisma.room.count({ 
        where: { 
          school: { tenantId: id } 
        } 
      }),
    ]);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        isActive: tenant.isActive,
      },
      statistics: {
        schools: {
          total: schoolCount,
          active: activeSchoolCount,
          inactive: schoolCount - activeSchoolCount,
        },
        users: {
          total: userCount,
          active: activeUserCount,
          inactive: userCount - activeUserCount,
        },
        academic: {
          subjects: subjectCount,
          classes: classCount,
          rooms: roomCount,
        },
      },
    };
  }
}
