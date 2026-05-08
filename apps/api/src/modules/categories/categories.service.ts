import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string },
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

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { children: true, products: true } },
        },
      }),
      this.prisma.category.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findRoots(tenantId: string) {
    const data = await this.prisma.category.findMany({
      where: { tenantId, parentId: null, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
    return { data };
  }

  async findSubcategories(tenantId: string, parentId: string) {
    const data = await this.prisma.category.findMany({
      where: { tenantId, parentId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
    return { data };
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, code: true } },
        _count: { select: { children: true, products: true } },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.category.findFirst({
      where: { tenantId, code: data.code },
    });
    if (existing) throw new ConflictException('Category code already exists');

    return this.prisma.category.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        description: data.description || null,
        parentId: data.parentId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, products: true } },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const category = await this.prisma.category.findFirst({ where: { id, tenantId } });
    if (!category) throw new NotFoundException('Category not found');

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.parentId !== undefined && { parentId: data.parentId || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, products: true } },
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, tenantId } });
    if (!category) throw new NotFoundException('Category not found');
    await this.prisma.category.delete({ where: { id } });
    return { message: 'Category deleted' };
  }
}
