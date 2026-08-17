import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ApprovalsService } from '../approvals/approvals.service';

@Injectable()
export class GoodsReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
  ) {}

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
    const approvals = await this.approvals.getRequestsMap(tenantId, 'GOODS_RECEIPT', data.map((g) => g.id));
    const withApproval = data.map((g) => ({ ...g, approval: approvals.get(g.id) || null }));
    return { data: withApproval, total, page, limit };
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
    const approval = await this.approvals.getRequest(tenantId, 'GOODS_RECEIPT', id);
    return { ...receipt, approval };
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

  /**
   * Records a goods receipt. Stock is NOT posted until the configured approval
   * workflow is satisfied — lots, stock movements, on-hand increments and PO
   * reconciliation all happen on final approval. No workflow → posts immediately.
   */
  async create(tenantId: string, userId: string, data: any) {
    const rows: any[] = Array.isArray(data?.items) ? data.items.filter((i: any) => i.productId && i.quantity > 0) : [];
    if (rows.length === 0) throw new BadRequestException('No items to receive');

    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: rows.map((r) => r.productId) } },
      select: { id: true, unit: true },
    });
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const receiptNumber = await this.genNumber(tenantId, 'goodsReceipt', 'GR');

    const gr = await this.prisma.goodsReceipt.create({
      data: {
        tenantId,
        receiptNumber,
        purchaseOrderId: data.purchaseOrderId || null,
        supplierDrRef: data.supplierDrRef || null,
        receivedById: userId,
        warehouseId: data.warehouseId || null,
        areaId: data.areaId || null,
        locationId: data.locationId || null,
        status: 'PENDING',
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
    });

    const { required } = await this.approvals.ensureRequest(tenantId, 'GOODS_RECEIPT', gr.id, userId);
    if (!required) await this.applyReceipt(tenantId, gr.id, userId);
    return this.findOne(tenantId, gr.id);
  }

  /** Records an approval on the current stage; posts the receipt once fully approved. */
  async approve(tenantId: string, id: string, userId: string, userRole: string) {
    const gr = await this.prisma.goodsReceipt.findFirst({ where: { id, tenantId } });
    if (!gr) throw new NotFoundException('Goods receipt not found');
    if (gr.status !== 'PENDING') throw new BadRequestException(`Only pending receipts can be approved (current: ${gr.status})`);
    const outcome = await this.approvals.decide(tenantId, 'GOODS_RECEIPT', id, userId, userRole, 'APPROVED');
    if (outcome.approved) await this.applyReceipt(tenantId, id, userId);
    return this.findOne(tenantId, id);
  }

  /** Rejects the receipt without posting any stock. */
  async reject(tenantId: string, id: string, userId: string, userRole: string, reason?: string) {
    const gr = await this.prisma.goodsReceipt.findFirst({ where: { id, tenantId } });
    if (!gr) throw new NotFoundException('Goods receipt not found');
    if (gr.status !== 'PENDING') throw new BadRequestException(`Only pending receipts can be rejected (current: ${gr.status})`);
    await this.approvals.decide(tenantId, 'GOODS_RECEIPT', id, userId, userRole, 'REJECTED', reason);
    await this.prisma.goodsReceipt.update({ where: { id }, data: { status: 'REJECTED', approvedById: userId, approvedAt: new Date(), rejectionReason: reason || null } });
    return this.findOne(tenantId, id);
  }

  /** Posts the receipt: on-hand increment + lots + stock movements + PO reconciliation. */
  private async applyReceipt(tenantId: string, id: string, approverId: string) {
    const gr = await this.prisma.goodsReceipt.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!gr) throw new NotFoundException('Goods receipt not found');
    const rows = gr.items;

    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: rows.map((r) => r.productId) } },
      select: { id: true, qcRequired: true },
    });
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const today = new Date();
    const smPrefix = `SM-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const smBase = await this.prisma.stockMovement.count({ where: { tenantId, referenceNumber: { startsWith: smPrefix } } });

    const ops: any[] = [
      this.prisma.goodsReceipt.update({ where: { id }, data: { status: 'APPROVED', approvedById: approverId, approvedAt: new Date(), rejectionReason: null } }),
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
            toWarehouseId: gr.warehouseId || null,
            toLocationId: gr.locationId || null,
            reason: `Goods receipt ${gr.receiptNumber}${gr.supplierDrRef ? ` (DR ${gr.supplierDrRef})` : ''}`,
            performedBy: approverId,
          },
        }),
        this.prisma.stockLot.create({
          data: {
            tenantId,
            productId: r.productId,
            lotNumber: r.lotNumber || `${gr.receiptNumber}-${idx + 1}`,
            quantity: r.quantity,
            initialQty: r.quantity,
            warehouseId: gr.warehouseId || null,
            areaId: gr.areaId || null,
            locationId: gr.locationId || null,
            expiryDate: r.expiryDate || null,
            source: `GR ${gr.receiptNumber}`,
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
    if (gr.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({ where: { id: gr.purchaseOrderId, tenantId }, include: { items: true } });
      if (po) {
        const fully = po.items.every((i) => i.receivedQty >= i.quantity);
        await this.prisma.purchaseOrder.update({
          where: { id: po.id },
          data: { status: fully ? 'RECEIVED' : 'PARTIALLY_RECEIVED', ...(fully && { receivedAt: new Date() }) },
        });
      }
    }
  }
}
