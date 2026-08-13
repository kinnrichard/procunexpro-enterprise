import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface UomInfo {
  code: string;
  category: string;
  baseFactor: number;
}

/**
 * Convert a quantity between two units of the SAME category (e.g. kg -> g).
 * Falls back to the original quantity when either unit is unknown or the
 * categories differ (safest for mixed/legacy data).
 */
export function convertQuantity(
  qty: number,
  fromCode: string,
  toCode: string,
  map: Map<string, UomInfo>,
): number {
  if (!fromCode || !toCode || fromCode === toCode) return qty;
  const from = map.get(fromCode);
  const to = map.get(toCode);
  if (!from || !to || from.category !== to.category) return qty;
  // qty in base units = qty * from.baseFactor; then divide by target's factor
  return (qty * from.baseFactor) / to.baseFactor;
}

@Injectable()
export class UnitsOfMeasureService {
  constructor(private readonly prisma: PrismaService) {}

  async getMap(tenantId: string): Promise<Map<string, UomInfo>> {
    const units = await this.prisma.unitOfMeasure.findMany({
      where: { tenantId },
      select: { code: true, category: true, baseFactor: true },
    });
    return new Map(units.map((u) => [u.code, u]));
  }

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.unitOfMeasure.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ category: 'asc' }, { baseFactor: 'asc' }],
      }),
      this.prisma.unitOfMeasure.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findAllActive(tenantId: string) {
    const data = await this.prisma.unitOfMeasure.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ category: 'asc' }, { baseFactor: 'asc' }],
      select: { id: true, code: true, name: true, category: true, baseFactor: true },
    });
    return { data };
  }

  async create(tenantId: string, data: any) {
    const code = (data.code || '').trim();
    if (!code) throw new ConflictException('Unit code is required');

    const existing = await this.prisma.unitOfMeasure.findFirst({ where: { tenantId, code } });
    if (existing) throw new ConflictException('A unit with this code already exists');

    return this.prisma.unitOfMeasure.create({
      data: {
        tenantId,
        code,
        name: data.name || code,
        category: data.category || 'count',
        baseFactor: data.baseFactor ?? 1,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const item = await this.prisma.unitOfMeasure.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Unit not found');

    if (data.code && data.code !== item.code) {
      const duplicate = await this.prisma.unitOfMeasure.findFirst({
        where: { tenantId, code: data.code, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('A unit with this code already exists');
    }

    return this.prisma.unitOfMeasure.update({
      where: { id },
      data: {
        ...(data.code !== undefined && { code: data.code }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.baseFactor !== undefined && { baseFactor: data.baseFactor }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const item = await this.prisma.unitOfMeasure.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Unit not found');
    await this.prisma.unitOfMeasure.delete({ where: { id } });
    return { message: 'Unit deleted' };
  }
}
