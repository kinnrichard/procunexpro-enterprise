import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LaborRatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.search) where.name = { contains: params.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.laborRate.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.laborRate.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findAllActive(tenantId: string) {
    const data = await this.prisma.laborRate.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, ratePerHour: true },
    });
    return { data };
  }

  async create(tenantId: string, data: any) {
    if (!data.name) throw new ConflictException('Name is required');
    const existing = await this.prisma.laborRate.findFirst({ where: { tenantId, name: data.name } });
    if (existing) throw new ConflictException('A labor rate with this name already exists');

    return this.prisma.laborRate.create({
      data: {
        tenantId,
        name: data.name,
        ratePerHour: data.ratePerHour ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.laborRate.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Labor rate not found');

    if (data.name && data.name !== item.name) {
      const dup = await this.prisma.laborRate.findFirst({ where: { tenantId, name: data.name, id: { not: id } } });
      if (dup) throw new ConflictException('A labor rate with this name already exists');
    }

    return this.prisma.laborRate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.ratePerHour !== undefined && { ratePerHour: data.ratePerHour }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.laborRate.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Labor rate not found');
    await this.prisma.laborRate.delete({ where: { id } });
    return { message: 'Labor rate deleted' };
  }
}
