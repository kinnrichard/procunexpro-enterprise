import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WarehousesService {
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
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { locations: true, products: true } },
        },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
      include: {
        locations: true,
        _count: { select: { locations: true, products: true } },
      },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.warehouse.findFirst({
      where: { tenantId, code: data.code },
    });
    if (existing) throw new ConflictException('Warehouse code already exists');

    return this.prisma.warehouse.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        address: data.address || null,
        city: data.city || null,
        managerId: data.managerId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        _count: { select: { locations: true, products: true } },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, tenantId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.managerId !== undefined && { managerId: data.managerId || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        _count: { select: { locations: true, products: true } },
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, tenantId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    await this.prisma.warehouse.delete({ where: { id } });
    return { message: 'Warehouse deleted' };
  }

  // --- Locations ---

  async getLocations(warehouseId: string, tenantId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    return this.prisma.warehouseLocation.findMany({
      where: { warehouseId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { products: true } },
      },
    });
  }

  async createLocation(warehouseId: string, tenantId: string, data: any) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const existing = await this.prisma.warehouseLocation.findFirst({
      where: { warehouseId, code: data.code },
    });
    if (existing) throw new ConflictException('Location code already exists in this warehouse');

    return this.prisma.warehouseLocation.create({
      data: {
        warehouseId,
        name: data.name,
        code: data.code,
        description: data.description || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async deleteLocation(warehouseId: string, locationId: string, tenantId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const location = await this.prisma.warehouseLocation.findFirst({
      where: { id: locationId, warehouseId },
    });
    if (!location) throw new NotFoundException('Location not found');

    await this.prisma.warehouseLocation.delete({ where: { id: locationId } });
    return { message: 'Location deleted' };
  }
}
