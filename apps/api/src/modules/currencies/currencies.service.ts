import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CurrenciesService {
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
      this.prisma.currency.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.currency.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findAllActive(tenantId: string) {
    const data = await this.prisma.currency.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { data };
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.currency.findFirst({
      where: { tenantId, code: data.code },
    });
    if (existing) throw new ConflictException('Currency code already exists');

    if (data.isDefault) {
      await this.prisma.currency.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
    }

    return this.prisma.currency.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        symbol: data.symbol || null,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.currency.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Currency not found');

    if (data.code && data.code !== item.code) {
      const duplicate = await this.prisma.currency.findFirst({
        where: { tenantId, code: data.code, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('Currency code already exists');
    }

    if (data.isDefault) {
      await this.prisma.currency.updateMany({ where: { tenantId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }

    return this.prisma.currency.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.symbol !== undefined && { symbol: data.symbol || null }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.currency.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Currency not found');
    await this.prisma.currency.delete({ where: { id } });
    return { message: 'Currency deleted' };
  }
}
