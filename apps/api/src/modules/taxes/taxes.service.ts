import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TaxesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.tax.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.tax.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findAllActive(tenantId: string) {
    const data = await this.prisma.tax.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { data };
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.tax.findFirst({ where: { tenantId, name: data.name } });
    if (existing) throw new ConflictException('Tax name already exists');

    if (data.isDefault) {
      await this.prisma.tax.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
    }

    return this.prisma.tax.create({
      data: { tenantId, name: data.name, rate: data.rate, isDefault: data.isDefault ?? false, isActive: data.isActive ?? true },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.tax.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Tax not found');

    if (data.name && data.name !== item.name) {
      const dup = await this.prisma.tax.findFirst({ where: { tenantId, name: data.name, id: { not: id } } });
      if (dup) throw new ConflictException('Tax name already exists');
    }

    if (data.isDefault) {
      await this.prisma.tax.updateMany({ where: { tenantId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }

    return this.prisma.tax.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.rate !== undefined && { rate: data.rate }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.tax.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Tax not found');
    await this.prisma.tax.delete({ where: { id } });
    return { message: 'Tax deleted' };
  }
}
