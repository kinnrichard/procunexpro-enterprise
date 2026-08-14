import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const round = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class InventoryBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { currentStock: true, costPrice: true, reorderPoint: true },
    });
    const totalValue = round(products.reduce((s, p) => s + p.currentStock * p.costPrice, 0));
    const lowStock = products.filter((p) => p.reorderPoint > 0 && p.currentStock <= p.reorderPoint).length;
    return { data: { totalSkus: products.length, totalValue, lowStock } };
  }

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; lowStock?: boolean; warehouseId?: string },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 15;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, isActive: true };
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { sku: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where, skip, take: limit, orderBy: { name: 'asc' },
        select: {
          id: true, name: true, sku: true, unit: true, inventoryType: true,
          currentStock: true, reorderPoint: true, costPrice: true,
          category: { select: { name: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const productIds = products.map((p) => p.id);

    // Per-warehouse + per-location available quantities from lots (null = "Unassigned")
    const lotSums = productIds.length
      ? await this.prisma.stockLot.groupBy({
          by: ['productId', 'warehouseId', 'areaId', 'locationId'],
          // physical on-hand by location — include QC-held lots (still physically present)
          where: { tenantId, productId: { in: productIds }, status: 'AVAILABLE', quantity: { gt: 0 } },
          _sum: { quantity: true },
        })
      : [];

    const warehouses = await this.prisma.warehouse.findMany({ where: { tenantId }, select: { id: true, name: true } });
    const whName = new Map(warehouses.map((w) => [w.id, w.name]));
    const areas = await this.prisma.warehouseArea.findMany({ where: { warehouse: { tenantId } }, select: { id: true, name: true } });
    const areaName = new Map(areas.map((a) => [a.id, a.name]));
    const locations = await this.prisma.warehouseLocation.findMany({ where: { warehouse: { tenantId } }, select: { id: true, name: true } });
    const locName = new Map(locations.map((l) => [l.id, l.name]));

    const byProduct = new Map<string, Array<{ warehouse: string; area: string | null; location: string | null; quantity: number }>>();
    for (const g of lotSums) {
      const list = byProduct.get(g.productId) || [];
      list.push({
        warehouse: g.warehouseId ? (whName.get(g.warehouseId) || 'Unknown') : 'Unassigned',
        area: g.areaId ? (areaName.get(g.areaId) || null) : null,
        location: g.locationId ? (locName.get(g.locationId) || null) : null,
        quantity: round(g._sum.quantity || 0),
      });
      byProduct.set(g.productId, list);
    }

    let data = products.map((p) => {
      const breakdown = (byProduct.get(p.id) || []).sort((a, b) => b.quantity - a.quantity);
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        inventoryType: p.inventoryType,
        category: p.category?.name || null,
        onHand: p.currentStock,
        reorderPoint: p.reorderPoint,
        unitCost: p.costPrice,
        stockValue: round(p.currentStock * p.costPrice),
        lowStock: p.reorderPoint > 0 && p.currentStock <= p.reorderPoint,
        warehouses: breakdown,
      };
    });

    if (params.lowStock) data = data.filter((r) => r.lowStock);
    if (params.warehouseId) {
      const wantName = whName.get(params.warehouseId);
      data = data
        .map((r) => ({ ...r, warehouses: r.warehouses.filter((w) => w.warehouse === wantName) }))
        .filter((r) => r.warehouses.length > 0);
    }

    return { data, total: params.lowStock || params.warehouseId ? data.length : total, page, limit };
  }
}
