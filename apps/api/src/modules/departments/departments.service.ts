import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      parentId?: string;
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
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.status) {
      where.isActive = params.status === 'ACTIVE';
    }

    if (params.parentId) {
      where.parentId = params.parentId;
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
      this.prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { children: true, users: true } },
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, tenantId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, code: true } },
        _count: { select: { children: true, users: true } },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.department.findFirst({
      where: { tenantId, code: data.code },
    });
    if (existing) throw new ConflictException('Department code already exists');

    return this.prisma.department.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        description: data.description || null,
        parentId: data.parentId || null,
        managerId: data.managerId || null,
        isActive: data.isActive === undefined ? true : data.isActive,
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, users: true } },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const dept = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException('Department not found');

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.parentId !== undefined && { parentId: data.parentId || null }),
        ...(data.managerId !== undefined && { managerId: data.managerId || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, users: true } },
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const dept = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException('Department not found');
    await this.prisma.department.delete({ where: { id } });
    return { message: 'Department deleted' };
  }
}
