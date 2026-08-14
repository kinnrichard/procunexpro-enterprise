import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class GoodsReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  private async genNumber(tenantId: string, model: 'goodsReceipt', prefix: string): Promise<string> {
    const today = new Date();
    const p = `${prefix}-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await (this.prisma[model] as any).count({ where: { tenantId, receiptNumber: { startsWith: p } } });
    return `${p}-${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string; purchaseOrderId?: string; dateFrom?: string; dateTo?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.purchaseOrderId) where.purchaseOrderId = params.purchaseOrderId;

    if (params.dateFrom || params.dateTo) {
      where.receiptDate = {};
      if (params.dateFrom) where.receiptDate.gte = new Date(params.dateFrom);
      if (params.dateTo) where.receiptDate.lte = new Date(`${params.dateTo}T23:59:59.999Z`);
    }

    if (params.search) {
      where.OR = [
        { receiptNumber: { contains: params.search, mode: 'insensitive' } },
        { supplierDrRef: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.goodsReceipt.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { purchaseOrder: { select: { id: true, orderNumber: true } }, _count: { select: { items: true } } },
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const receipt = await this.prisma.goodsReceipt.findFirst({
      where: { id, tenantId },
      include: {
        purchaseOrder: { select: { id: true, orderNumber: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
      },
    });
    if (!receipt) throw new NotFoundException('Goods receipt not found');
    return receipt;
  }

  // POs that still have quantity to receive, with their outstanding items
  async receivablePurchaseOrders(tenantId: string) {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, status: { in: ['SENT', 'PARTIALLY_RECEIVED'] } },
      include: {
        vendor: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, qcRequired: true } } } },
      },
      orderBy: { orderDate: 'desc' },
    });
    const data = pos.map((po) => ({
      id: po.id,
      orderNumber: po.orderNumber,
      vendorName: po.vendor?.name,
      items: po.items
        .map((i) => ({
          purchaseOrderItemId: i.id,
          productId: i.productId,
          name: i.product?.name,
          sku: i.product?.sku,
          uom: i.uom,
          ordered: i.quantity,
          received: i.receivedQty,
          outstanding: Math.round((i.quantity - i.receivedQty) * 1e6) / 1e6,
        }))
        .filter((i) => i.outstanding > 0),
    })).filter((po) => po.items.length > 0);
    return { data };
  }

  async create(tenantId: string, userId: string, data: any) {
    const rows: any[] = Array.isArray(data?.items) ? data.items.filter((i: any) => i.productId && i.quantity > 0) : [];
    if (rows.length === 0) throw new BadRequestException('No items to receive');

    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: rows.map((r) => r.productId) } },
      select: { id: true, unit: true, qcRequired: true },
    });
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const receiptNumber = await this.genNumber(tenantId, 'goodsReceipt', 'GR');

    // Movement reference numbers (pre-allocated)
    const today = new Date();
    const smPrefix = `SM-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const smBase = await this.prisma.stockMovement.count({ where: { tenantId, referenceNumber: { startsWith: smPrefix } } });

    const ops: any[] = [
      this.prisma.goodsReceipt.create({
        data: {
          tenantId,
          receiptNumber,
          purchaseOrderId: data.purchaseOrderId || null,
          supplierDrRef: data.supplierDrRef || null,
          receivedById: userId,
          notes: data.notes || null,
          items: {
            create: rows.map((r) => ({
              purchaseOrderItemId: r.purchaseOrderItemId || null,
              productId: r.productId,
              quantity: r.quantity,
              uom: r.uom || prodMap.get(r.productId)?.unit || 'pcs',
              lotNumber: r.lotNumber || null,
              expiryDate: r.expiryDate ? new Date(r.expiryDate) : null,
            })),
          },
        },
      }),
    ];

    rows.forEach((r, idx) => {
      const prod = prodMap.get(r.productId);
      ops.push(
        this.prisma.product.update({ where: { id: r.productId }, data: { currentStock: { increment: r.quantity } } }),
        this.prisma.stockMovement.create({
          data: {
            tenantId,
            referenceNumber: `${smPrefix}-${String(smBase + idx + 1).padStart(4, '0')}`,
            productId: r.productId,
            type: 'PURCHASE',
            quantity: r.quantity,
            toWarehouseId: data.warehouseId || null,
            toLocationId: data.locationId || null,
            reason: `Goods receipt ${receiptNumber}${data.supplierDrRef ? ` (DR ${data.supplierDrRef})` : ''}`,
            performedBy: userId,
          },
        }),
        this.prisma.stockLot.create({
          data: {
            tenantId,
            productId: r.productId,
            lotNumber: r.lotNumber || `${receiptNumber}-${idx + 1}`,
            quantity: r.quantity,
            initialQty: r.quantity,
            warehouseId: data.warehouseId || null,
            locationId: data.locationId || null,
            expiryDate: r.expiryDate ? new Date(r.expiryDate) : null,
            source: `GR ${receiptNumber}`,
            status: 'AVAILABLE',
            qcStatus: prod?.qcRequired ? 'PENDING' : 'PASSED',
          },
        }),
      );
      if (r.purchaseOrderItemId) {
        ops.push(this.prisma.purchaseOrderItem.update({ where: { id: r.purchaseOrderItemId }, data: { receivedQty: { increment: r.quantity } } }));
      }
    });

    await this.prisma.$transaction(ops);

    // Reconcile PO status (fully vs partially received)
    if (data.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({ where: { id: data.purchaseOrderId, tenantId }, include: { items: true } });
      if (po) {
        const fully = po.items.every((i) => i.receivedQty >= i.quantity);
        await this.prisma.purchaseOrder.update({
          where: { id: po.id },
          data: { status: fully ? 'RECEIVED' : 'PARTIALLY_RECEIVED', ...(fully && { receivedAt: new Date() }) },
        });
      }
    }

    const created = await this.prisma.goodsReceipt.findFirst({ where: { tenantId, receiptNumber } });
    return this.findOne(tenantId, created!.id);
  }
}
