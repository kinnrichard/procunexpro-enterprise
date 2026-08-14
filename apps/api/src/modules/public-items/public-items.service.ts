import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PublicItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Minimal, unauthenticated item preview for a scanned QR. Keyed by the item's
   * globally-unique id, so no tenant context is needed. Intentionally omits
   * costs/pricing.
   */
  async findPublic(id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        inventoryType: true,
        unit: true,
        currentStock: true,
        isActive: true,
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
        manufacturer: { select: { name: true } },
        origin: { select: { name: true } },
      },
    });
    if (!p) throw new NotFoundException('Item not found');

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      inventoryType: p.inventoryType,
      unit: p.unit,
      currentStock: p.currentStock,
      isActive: p.isActive,
      category: p.category?.name || null,
      subCategory: p.subCategory?.name || null,
      manufacturer: p.manufacturer?.name || null,
      origin: p.origin?.name || null,
    };
  }
}
