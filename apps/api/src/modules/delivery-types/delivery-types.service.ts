import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DeliveryTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (params.search) where.name = { contains: params.search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.prisma.deliveryType.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.deliveryType.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findAllActive(tenantId: string) {
    const data = await this.prisma.deliveryType.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } });
    return { data };
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.deliveryType.findFirst({ where: { tenantId, name: data.name } });
    if (existing) throw new ConflictException('Delivery type already exists');
    return this.prisma.deliveryType.create({ data: { tenantId, name: data.name, isActive: data.isActive ?? true } });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.deliveryType.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Delivery type not found');
    if (data.name && data.name !== item.name) {
      const dup = await this.prisma.deliveryType.findFirst({ where: { tenantId, name: data.name, id: { not: id } } });
      if (dup) throw new ConflictException('Delivery type already exists');
    }
    return this.prisma.deliveryType.update({ where: { id }, data: { ...(data.name !== undefined && { name: data.name }), ...(data.isActive !== undefined && { isActive: data.isActive }) } });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.deliveryType.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Delivery type not found');
    await this.prisma.deliveryType.delete({ where: { id } });
    return { message: 'Delivery type deleted' };
  }
}
