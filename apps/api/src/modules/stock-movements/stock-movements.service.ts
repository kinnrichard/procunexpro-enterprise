import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateReferenceNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const prefix = `SM-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await this.prisma.stockMovement.count({
      where: {
        tenantId,
        referenceNumber: { startsWith: prefix },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      type?: string;
      direction?: string;
      productId?: string;
      warehouseId?: string;
      createdDateFrom?: string;
      createdDateTo?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.type) where.type = params.type;
    else if (params.direction === 'in') where.type = { in: ['PURCHASE', 'TRANSFER_IN', 'RETURN', 'PRODUCTION_IN'] };
    else if (params.direction === 'out') where.type = { in: ['SALE', 'TRANSFER_OUT', 'WRITE_OFF', 'PRODUCTION_ISSUE', 'ADJUSTMENT'] };

    if (params.productId) where.productId = params.productId;

    if (params.search) {
      where.OR = [
        { referenceNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.warehouseId) {
      const warehouseOr = [
        { fromWarehouseId: params.warehouseId },
        { toWarehouseId: params.warehouseId },
      ];
      if (where.OR) {
        where.AND = [{ OR: warehouseOr }];
      } else {
        where.OR = warehouseOr;
      }
    }

    if (params.createdDateFrom || params.createdDateTo) {
      where.createdAt = {};
      if (params.createdDateFrom) where.createdAt.gte = new Date(params.createdDateFrom);
      if (params.createdDateTo) where.createdAt.lte = new Date(`${params.createdDateTo}T23:59:59.999Z`);
    }

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } },
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
          purchaseOrder: { select: { id: true, orderNumber: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id, tenantId },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } },
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, orderNumber: true } },
      },
    });
    if (!movement) throw new NotFoundException('Stock movement not found');
    return movement;
  }

  async create(tenantId: string, userId: string, data: any) {
    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const referenceNumber = await this.generateReferenceNumber(tenantId);
    const qty = data.quantity;

    // Inbound types add stock (and create a lot); the rest reduce it (FEFO-consume lots)
    const addTypes = ['PURCHASE', 'TRANSFER_IN', 'RETURN', 'PRODUCTION_IN'];
    const isAdd = addTypes.includes(data.type);

    if (!isAdd && product.currentStock < qty) {
      throw new BadRequestException(
        `Insufficient stock. Current: ${product.currentStock}, Requested: ${qty}`,
      );
    }

    const ops: any[] = [
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          referenceNumber,
          productId: data.productId,
          type: data.type,
          quantity: qty,
          fromWarehouseId: data.fromWarehouseId || null,
          toWarehouseId: data.toWarehouseId || null,
          fromLocationId: data.fromLocationId || null,
          toLocationId: data.toLocationId || null,
          purchaseOrderId: data.purchaseOrderId || null,
          reason: data.reason || null,
          notes: data.notes || null,
          performedBy: userId,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
        },
      }),
    ];

    if (isAdd) {
      // Create a stock lot at the destination so lot-based views (Item › Stock) reflect it
      ops.push(
        this.prisma.product.update({ where: { id: data.productId }, data: { currentStock: { increment: qty } } }),
        this.prisma.stockLot.create({
          data: {
            tenantId,
            productId: data.productId,
            lotNumber: referenceNumber,
            quantity: qty,
            initialQty: qty,
            warehouseId: data.toWarehouseId || null,
            areaId: data.toAreaId || null,
            locationId: data.toLocationId || null,
            source: `Movement ${referenceNumber}`,
            status: 'AVAILABLE',
            qcStatus: 'PASSED',
          },
        }),
      );
    } else {
      // Consume FEFO from the source warehouse's lots (or unassigned) — best-effort
      const lots = await this.prisma.stockLot.findMany({
        where: {
          tenantId, productId: data.productId, status: 'AVAILABLE', qcStatus: 'PASSED', quantity: { gt: 0 },
          ...(data.fromWarehouseId ? { OR: [{ warehouseId: data.fromWarehouseId }, { warehouseId: null }] } : {}),
        },
        orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
      });
      let remaining = qty;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(lot.quantity, remaining);
        const after = Math.round((lot.quantity - take) * 1e6) / 1e6;
        ops.push(this.prisma.stockLot.update({ where: { id: lot.id }, data: { quantity: after, ...(after <= 0 ? { status: 'DEPLETED' } : {}) } }));
        remaining = Math.round((remaining - take) * 1e6) / 1e6;
      }
      ops.push(this.prisma.product.update({ where: { id: data.productId }, data: { currentStock: { decrement: qty } } }));
    }

    const result = await this.prisma.$transaction(ops);
    return result[0];
  }
}
