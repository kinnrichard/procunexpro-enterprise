import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ManufacturersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.manufacturer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.manufacturer.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findAllActive(tenantId: string) {
    const data = await this.prisma.manufacturer.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return { data };
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.manufacturer.findFirst({
      where: { tenantId, name: data.name },
    });
    if (existing) throw new ConflictException('Manufacturer already exists');

    return this.prisma.manufacturer.create({
      data: { tenantId, name: data.name, isActive: data.isActive ?? true },
      include: { _count: { select: { products: true } } },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.manufacturer.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Manufacturer not found');

    if (data.name && data.name !== item.name) {
      const duplicate = await this.prisma.manufacturer.findFirst({
        where: { tenantId, name: data.name, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('Manufacturer already exists');
    }

    return this.prisma.manufacturer.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.manufacturer.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Manufacturer not found');
    await this.prisma.manufacturer.delete({ where: { id } });
    return { message: 'Manufacturer deleted' };
  }
}
