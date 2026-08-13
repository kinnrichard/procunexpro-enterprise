import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { SYSTEM_ROLES } from '../roles/roles.constants';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      role?: string;
      status?: string;
      createdDateFrom?: string;
      createdDateTo?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.role) {
      where.role = params.role;
    }

    if (params.status) {
      where.isActive = params.status === 'ACTIVE';
    }

    if (params.createdDateFrom || params.createdDateTo) {
      where.createdAt = {};
      if (params.createdDateFrom) {
        where.createdAt.gte = new Date(params.createdDateFrom);
      }
      if (params.createdDateTo) {
        where.createdAt.lte = new Date(`${params.createdDateTo}T23:59:59.999Z`);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          phone: true,
          avatar: true,
          departmentId: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        phone: true,
        avatar: true,
        departmentId: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertValidRole(tenantId: string, role?: string) {
    if (!role) return;
    if (SYSTEM_ROLES.some((r) => r.key === role)) return; // built-ins are always valid
    const exists = await this.prisma.role.findUnique({ where: { tenantId_key: { tenantId, key: role } } });
    if (!exists) throw new BadRequestException(`Unknown role "${role}"`);
  }

  async create(tenantId: string, data: any) {
    await this.assertValidRole(tenantId, data.role);
    if (data.role === 'SUPERADMIN') {
      throw new BadRequestException('The SUPERADMIN role is reserved for the developer account and cannot be assigned.');
    }
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        OR: [{ username: data.username }, { email: data.email }],
      },
    });
    if (existing) throw new ConflictException('Username or email already exists');

    const passwordHash = await bcrypt.hash(data.password || 'changeme123!', 10);

    return this.prisma.user.create({
      data: {
        tenantId,
        username: data.username,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        role: data.role || 'VIEWER',
        departmentId: data.departmentId || null,
        phone: data.phone || null,
        isActive: data.isActive === undefined ? true : data.isActive,
        mustChangePassword: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        departmentId: true,
        createdAt: true,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    await this.assertValidRole(tenantId, data.role);
    // SUPERADMIN is a constant developer-only role — can't be granted, and can't be removed from a SUPERADMIN via the app.
    if (data.role === 'SUPERADMIN' && user.role !== 'SUPERADMIN') {
      throw new BadRequestException('The SUPERADMIN role is reserved and cannot be assigned.');
    }
    if (user.role === 'SUPERADMIN' && data.role !== undefined && data.role !== 'SUPERADMIN') {
      throw new BadRequestException('The developer (SUPERADMIN) role cannot be changed.');
    }

    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        departmentId: true,
        updatedAt: true,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted' };
  }

  async activate(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, username: true, isActive: true },
    });
  }

  async deactivate(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, username: true, isActive: true },
    });
  }
}
