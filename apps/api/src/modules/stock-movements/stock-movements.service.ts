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

  private static readonly ADD_TYPES = ['PURCHASE', 'TRANSFER_IN', 'RETURN', 'PRODUCTION_IN'];

  /**
   * Manual stock movements are created as PENDING and do NOT touch stock until a
   * manager approves them. Internal flows (goods receipts, production, transfers)
   * write their own APPROVED movements directly and are unaffected.
   */
  async create(tenantId: string, userId: string, data: any) {
    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, tenantId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const qty = data.quantity;
    const isAdd = StockMovementsService.ADD_TYPES.includes(data.type);

    // Sanity-check availability up front for a better UX; re-checked at approval.
    if (!isAdd && product.currentStock < qty) {
      throw new BadRequestException(
        `Insufficient stock. Current: ${product.currentStock}, Requested: ${qty}`,
      );
    }

    const referenceNumber = await this.generateReferenceNumber(tenantId);

    return this.prisma.stockMovement.create({
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
        status: 'PENDING',
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
      },
    });
  }

  /** Applies the pending movement's stock effect and marks it APPROVED. */
  async approve(tenantId: string, userId: string, id: string) {
    const movement = await this.prisma.stockMovement.findFirst({ where: { id, tenantId } });
    if (!movement) throw new NotFoundException('Stock movement not found');
    if (movement.status !== 'PENDING') {
      throw new BadRequestException(`Only pending movements can be approved (current: ${movement.status})`);
    }

    const product = await this.prisma.product.findFirst({ where: { id: movement.productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    const qty = movement.quantity;
    const isAdd = StockMovementsService.ADD_TYPES.includes(movement.type);

    if (!isAdd && product.currentStock < qty) {
      throw new BadRequestException(
        `Insufficient stock. Current: ${product.currentStock}, Requested: ${qty}`,
      );
    }

    const ops: any[] = [
      this.prisma.stockMovement.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date(), rejectionReason: null },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
        },
      }),
    ];

    if (isAdd) {
      ops.push(
        this.prisma.product.update({ where: { id: movement.productId }, data: { currentStock: { increment: qty } } }),
        this.prisma.stockLot.create({
          data: {
            tenantId,
            productId: movement.productId,
            lotNumber: movement.referenceNumber,
            quantity: qty,
            initialQty: qty,
            warehouseId: movement.toWarehouseId || null,
            locationId: movement.toLocationId || null,
            source: `Movement ${movement.referenceNumber}`,
            status: 'AVAILABLE',
            qcStatus: 'PASSED',
          },
        }),
      );
    } else {
      const lots = await this.prisma.stockLot.findMany({
        where: {
          tenantId, productId: movement.productId, status: 'AVAILABLE', qcStatus: 'PASSED', quantity: { gt: 0 },
          ...(movement.fromWarehouseId ? { OR: [{ warehouseId: movement.fromWarehouseId }, { warehouseId: null }] } : {}),
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
      ops.push(this.prisma.product.update({ where: { id: movement.productId }, data: { currentStock: { decrement: qty } } }));
    }

    const result = await this.prisma.$transaction(ops);
    return result[0];
  }

  /** Rejects a pending movement without touching stock. */
  async reject(tenantId: string, userId: string, id: string, reason?: string) {
    const movement = await this.prisma.stockMovement.findFirst({ where: { id, tenantId } });
    if (!movement) throw new NotFoundException('Stock movement not found');
    if (movement.status !== 'PENDING') {
      throw new BadRequestException(`Only pending movements can be rejected (current: ${movement.status})`);
    }
    return this.prisma.stockMovement.update({
      where: { id },
      data: { status: 'REJECTED', approvedById: userId, approvedAt: new Date(), rejectionReason: reason || null },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
      },
    });
  }
}
