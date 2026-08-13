import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SYSTEM_INVENTORY_TYPES } from './inventory-types.constants';

@Injectable()
export class InventoryTypesService {
  constructor(private readonly prisma: PrismaService) {}

  // Idempotently ensure the built-in types exist (don't overwrite admin edits to label/hasComposition).
  async ensureSystemTypes(tenantId: string) {
    for (const t of SYSTEM_INVENTORY_TYPES) {
      await this.prisma.inventoryType.upsert({
        where: { tenantId_key: { tenantId, key: t.key } },
        create: {
          tenantId, key: t.key, label: t.label, description: t.description,
          hasComposition: t.hasComposition, sortOrder: t.sortOrder, isSystem: true,
        },
        update: { isSystem: true },
      });
    }
  }

  async list(tenantId: string) {
    await this.ensureSystemTypes(tenantId);
    return this.prisma.inventoryType.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  private toKey(input: string): string {
    return input
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '_')
      .replaceAll(/^_+|_+$/g, '');
  }

  async create(tenantId: string, data: { label?: string; key?: string; description?: string; hasComposition?: boolean }) {
    const label = (data.label || '').trim();
    if (!label) throw new BadRequestException('Type name is required');
    const key = this.toKey(data.key?.trim() || label);
    if (!key) throw new BadRequestException('Invalid type name');
    const existing = await this.prisma.inventoryType.findUnique({ where: { tenantId_key: { tenantId, key } } });
    if (existing) throw new BadRequestException('A type with a similar name already exists');

    const agg = await this.prisma.inventoryType.aggregate({ where: { tenantId }, _max: { sortOrder: true } });
    return this.prisma.inventoryType.create({
      data: {
        tenantId, key, label,
        description: data.description?.trim() || null,
        hasComposition: !!data.hasComposition,
        isSystem: false,
        sortOrder: (agg._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async update(tenantId: string, id: string, data: { label?: string; description?: string; hasComposition?: boolean; sortOrder?: number }) {
    const t = await this.prisma.inventoryType.findFirst({ where: { id, tenantId } });
    if (!t) throw new NotFoundException('Inventory type not found');
    return this.prisma.inventoryType.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label.trim() || t.label }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.hasComposition !== undefined && { hasComposition: !!data.hasComposition }),
        ...(data.sortOrder !== undefined && { sortOrder: Number(data.sortOrder) }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const t = await this.prisma.inventoryType.findFirst({ where: { id, tenantId } });
    if (!t) throw new NotFoundException('Inventory type not found');
    if (t.isSystem) throw new BadRequestException('Built-in inventory types cannot be deleted');
    const inUse = await this.prisma.product.count({ where: { tenantId, inventoryType: t.key } });
    if (inUse > 0) throw new BadRequestException(`${inUse} item(s) use this type — reassign them first`);
    await this.prisma.inventoryType.delete({ where: { id } });
    return { success: true };
  }
}
