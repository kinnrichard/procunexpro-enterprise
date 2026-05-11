import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OriginsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string }) {
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
      this.prisma.origin.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.origin.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findAllActive(tenantId: string) {
    const data = await this.prisma.origin.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
    return { data };
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.origin.findFirst({
      where: { tenantId, name: data.name },
    });
    if (existing) throw new ConflictException('Origin already exists');

    return this.prisma.origin.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code || null,
        isActive: data.isActive ?? true,
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.origin.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Origin not found');

    if (data.name && data.name !== item.name) {
      const duplicate = await this.prisma.origin.findFirst({
        where: { tenantId, name: data.name, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('Origin already exists');
    }

    return this.prisma.origin.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.origin.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Origin not found');
    await this.prisma.origin.delete({ where: { id } });
    return { message: 'Origin deleted' };
  }
}
