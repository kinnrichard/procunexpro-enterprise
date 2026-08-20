import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { ApprovalsService } from '../approvals/approvals.service';

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const WEB_BASE = process.env.WEB_URL || 'http://localhost:3005';

@Injectable()
export class DeliveryReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
  ) {}

  private signUrl(token: string) {
    return `${WEB_BASE}/dr/sign/${token}`;
  }

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string; status?: string; customerId?: string; createdDateFrom?: string; createdDateTo?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.status) where.status = params.status;
    if (params.customerId) where.customerId = params.customerId;
    if (params.createdDateFrom || params.createdDateTo) {
      where.createdAt = {};
      if (params.createdDateFrom) where.createdAt.gte = new Date(params.createdDateFrom);
      if (params.createdDateTo) where.createdAt.lte = new Date(`${params.createdDateTo}T23:59:59.999Z`);
    }
    if (params.search) {
      where.OR = [
        { drNumber: { contains: params.search, mode: 'insensitive' } },
        { customer: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.deliveryReceipt.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { customer: { select: { id: true, name: true } }, _count: { select: { items: true } } },
      }),
      this.prisma.deliveryReceipt.count({ where }),
    ]);
    const approvals = await this.approvals.getRequestsMap(tenantId, 'DELIVERY', data.map((d) => d.id));
    return { data: data.map((d) => ({ ...d, signUrl: this.signUrl(d.token), approval: approvals.get(d.id) || null })), total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const dr = await this.prisma.deliveryReceipt.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
      },
    });
    if (!dr) throw new NotFoundException('Delivery receipt not found');
    const approval = await this.approvals.getRequest(tenantId, 'DELIVERY', id);
    return { ...dr, signUrl: this.signUrl(dr.token), approval };
  }

  /**
   * Creates a DRAFT delivery receipt (header only by default). Items are added
   * on the detail page, then `release()` runs the workflow + FEFO draw. Items may
   * still be passed here (optional) but nothing is released at create time.
   */
  async create(tenantId: string, userId: string, data: any) {
    const customer = await this.prisma.customer.findFirst({ where: { id: data.customerId, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const rows: any[] = Array.isArray(data?.items) ? data.items.filter((i: any) => i.productId && i.quantity > 0) : [];
    let itemCreate: any;
    if (rows.length) {
      const products = await this.prisma.product.findMany({
        where: { tenantId, id: { in: rows.map((r) => r.productId) } },
        select: { id: true, unit: true },
      });
      const prodMap = new Map(products.map((p) => [p.id, p]));
      itemCreate = { create: rows.map((r) => ({ productId: r.productId, quantity: round(r.quantity), uom: r.uom || prodMap.get(r.productId)?.unit || 'pcs' })) };
    }

    const today = new Date();
    const drPrefix = `DR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const drCount = await this.prisma.deliveryReceipt.count({ where: { tenantId, drNumber: { startsWith: drPrefix } } });
    const drNumber = `${drPrefix}-${String(drCount + 1).padStart(4, '0')}`;

    const dr = await this.prisma.deliveryReceipt.create({
      data: {
        tenantId, drNumber, customerId: data.customerId,
        warehouseId: data.warehouseId || null, areaId: data.areaId || null, locationId: data.locationId || null,
        status: 'DRAFT', notes: data.notes || null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : today,
        token: randomUUID(), createdById: userId,
        ...(itemCreate ? { items: itemCreate } : {}),
      },
    });
    return this.findOne(tenantId, dr.id);
  }

  // A DR can only be edited while it's a DRAFT that hasn't been submitted for approval.
  private async assertEditable(tenantId: string, id: string) {
    const dr = await this.prisma.deliveryReceipt.findFirst({ where: { id, tenantId } });
    if (!dr) throw new NotFoundException('Delivery receipt not found');
    if (dr.status !== 'DRAFT') throw new BadRequestException('Only draft deliveries can be edited');
    const approval = await this.approvals.getRequest(tenantId, 'DELIVERY', id);
    if (approval?.status === 'PENDING') throw new BadRequestException('This delivery is awaiting approval and cannot be edited');
    return dr;
  }

  /** Update draft header fields (customer/warehouse/location/date/notes). */
  async updateHeader(tenantId: string, id: string, data: any) {
    await this.assertEditable(tenantId, id);
    if (data.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: data.customerId, tenantId } });
      if (!customer) throw new NotFoundException('Customer not found');
    }
    await this.prisma.deliveryReceipt.update({
      where: { id },
      data: {
        ...(data.customerId !== undefined && { customerId: data.customerId }),
        ...(data.warehouseId !== undefined && { warehouseId: data.warehouseId || null }),
        ...(data.areaId !== undefined && { areaId: data.areaId || null }),
        ...(data.locationId !== undefined && { locationId: data.locationId || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.deliveryDate !== undefined && { deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : new Date() }),
      },
    });
    return this.findOne(tenantId, id);
  }

  // Strict stock guard: can't deliver an out-of-stock item or more than on-hand.
  private assertStock(product: { name: string; currentStock: number; unit: string | null }, quantity: number) {
    if (product.currentStock <= 0) {
      throw new BadRequestException(`${product.name} has no stock on hand and cannot be delivered`);
    }
    if (round(quantity) > product.currentStock) {
      throw new BadRequestException(`Only ${product.currentStock} ${product.unit || ''} of ${product.name} in stock`.trim());
    }
  }

  async addItem(tenantId: string, id: string, data: any) {
    await this.assertEditable(tenantId, id);
    if (!data?.productId || !(data.quantity > 0)) throw new BadRequestException('Product and a quantity greater than 0 are required');
    const product = await this.prisma.product.findFirst({ where: { id: data.productId, tenantId }, select: { id: true, name: true, unit: true, currentStock: true } });
    if (!product) throw new NotFoundException('Product not found');
    this.assertStock(product, data.quantity);
    await this.prisma.deliveryReceiptItem.create({
      data: { deliveryReceiptId: id, productId: data.productId, quantity: round(data.quantity), uom: data.uom || product.unit || 'pcs' },
    });
    return this.findOne(tenantId, id);
  }

  async updateItem(tenantId: string, id: string, itemId: string, data: any) {
    await this.assertEditable(tenantId, id);
    const item = await this.prisma.deliveryReceiptItem.findFirst({ where: { id: itemId, deliveryReceiptId: id } });
    if (!item) throw new NotFoundException('Item not found');
    if (data.quantity !== undefined) {
      if (!(data.quantity > 0)) throw new BadRequestException('Quantity must be greater than 0');
      const product = await this.prisma.product.findFirst({ where: { id: item.productId, tenantId }, select: { name: true, unit: true, currentStock: true } });
      if (product) this.assertStock(product, data.quantity);
    }
    await this.prisma.deliveryReceiptItem.update({
      where: { id: itemId },
      data: {
        ...(data.quantity !== undefined && { quantity: round(data.quantity) }),
        ...(data.uom !== undefined && { uom: data.uom || item.uom }),
      },
    });
    return this.findOne(tenantId, id);
  }

  async removeItem(tenantId: string, id: string, itemId: string) {
    await this.assertEditable(tenantId, id);
    await this.prisma.deliveryReceiptItem.deleteMany({ where: { id: itemId, deliveryReceiptId: id } });
    return this.findOne(tenantId, id);
  }

  /**
   * Releases a draft: validates items, then runs the DELIVERY workflow. If a
   * workflow is configured the DR is submitted for approval (stays DRAFT until
   * cleared); otherwise the FEFO draw runs now and it becomes RELEASED.
   */
  async release(tenantId: string, id: string, userId: string) {
    const dr = await this.prisma.deliveryReceipt.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!dr) throw new NotFoundException('Delivery receipt not found');
    if (dr.status !== 'DRAFT') throw new BadRequestException('Only draft deliveries can be released');
    if (dr.items.length === 0) throw new BadRequestException('Add at least one item before releasing');

    // Pre-check stock for a better error before we start the workflow.
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: dr.items.map((r) => r.productId) } },
      select: { id: true, name: true, currentStock: true },
    });
    const prodMap = new Map(products.map((p) => [p.id, p]));
    for (const r of dr.items) {
      const prod = prodMap.get(r.productId);
      if (!prod) throw new NotFoundException('Product not found');
      if (prod.currentStock < round(r.quantity)) {
        throw new BadRequestException(`Insufficient stock for ${prod.name} (available ${prod.currentStock}, need ${round(r.quantity)})`);
      }
    }

    const { required } = await this.approvals.ensureRequest(tenantId, 'DELIVERY', id, userId);
    if (!required) await this.applyRelease(tenantId, id, userId);
    return this.findOne(tenantId, id);
  }

  /** Records an approval on the current stage; releases the goods once fully approved. */
  async approve(tenantId: string, id: string, userId: string, userRole: string) {
    const dr = await this.prisma.deliveryReceipt.findFirst({ where: { id, tenantId } });
    if (!dr) throw new NotFoundException('Delivery receipt not found');
    if (dr.status !== 'DRAFT') throw new BadRequestException('This delivery is no longer awaiting approval');
    const outcome = await this.approvals.decide(tenantId, 'DELIVERY', id, userId, userRole, 'APPROVED');
    if (outcome.approved) await this.applyRelease(tenantId, id, userId);
    return this.findOne(tenantId, id);
  }

  /** Rejects the delivery without drawing any stock; it stays DRAFT. */
  async reject(tenantId: string, id: string, userId: string, userRole: string, reason?: string) {
    const dr = await this.prisma.deliveryReceipt.findFirst({ where: { id, tenantId } });
    if (!dr) throw new NotFoundException('Delivery receipt not found');
    if (dr.status !== 'DRAFT') throw new BadRequestException('This delivery is no longer awaiting approval');
    await this.approvals.decide(tenantId, 'DELIVERY', id, userId, userRole, 'REJECTED', reason);
    await this.prisma.deliveryReceipt.update({ where: { id }, data: { approvedById: userId, approvedAt: new Date(), rejectionReason: reason || null } });
    return this.findOne(tenantId, id);
  }

  /** Releases the delivery: FEFO draw + on-hand decrement + SALE movements + RELEASED. */
  private async applyRelease(tenantId: string, id: string, approverId: string) {
    const dr = await this.prisma.deliveryReceipt.findFirst({
      where: { id, tenantId },
      include: { items: true, customer: { select: { name: true } } },
    });
    if (!dr) throw new NotFoundException('Delivery receipt not found');
    const rows = dr.items;

    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: rows.map((r) => r.productId) } },
      select: { id: true, name: true, currentStock: true },
    });
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const today = new Date();
    const smPrefix = `SM-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    let smSeq = await this.prisma.stockMovement.count({ where: { tenantId, referenceNumber: { startsWith: smPrefix } } });
    const nextSm = () => `${smPrefix}-${String(++smSeq).padStart(4, '0')}`;

    const ops: any[] = [
      this.prisma.deliveryReceipt.update({ where: { id }, data: { status: 'RELEASED', releasedAt: today, approvedById: approverId, approvedAt: today, rejectionReason: null } }),
    ];

    for (const r of rows) {
      const need = round(r.quantity);
      const prod = prodMap.get(r.productId);
      if (!prod) throw new NotFoundException('Product not found');
      if (prod.currentStock < need) {
        throw new BadRequestException(`Insufficient stock for ${prod.name} (available ${prod.currentStock}, need ${need})`);
      }

      const lots = await this.prisma.stockLot.findMany({
        where: {
          tenantId, productId: r.productId, status: 'AVAILABLE', qcStatus: 'PASSED', quantity: { gt: 0 },
          ...(dr.warehouseId ? { OR: [{ warehouseId: dr.warehouseId }, { warehouseId: null }] } : {}),
          ...(dr.areaId ? { areaId: dr.areaId } : {}),
          ...(dr.locationId ? { locationId: dr.locationId } : {}),
        },
        orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
      });
      let remaining = need;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(lot.quantity, remaining);
        const after = round(lot.quantity - take);
        ops.push(this.prisma.stockLot.update({ where: { id: lot.id }, data: { quantity: after, ...(after <= 0 ? { status: 'DEPLETED' } : {}) } }));
        remaining = round(remaining - take);
      }

      ops.push(
        this.prisma.product.update({ where: { id: r.productId }, data: { currentStock: { decrement: need } } }),
        this.prisma.stockMovement.create({ data: { tenantId, referenceNumber: nextSm(), productId: r.productId, type: 'SALE', quantity: need, fromWarehouseId: dr.warehouseId || null, fromLocationId: dr.locationId || null, reason: `Released via ${dr.drNumber} to ${dr.customer?.name || ''}`, performedBy: approverId } }),
      );
    }

    await this.prisma.$transaction(ops);
  }

  async cancel(tenantId: string, id: string) {
    const dr = await this.prisma.deliveryReceipt.findFirst({ where: { id, tenantId } });
    if (!dr) throw new NotFoundException('Delivery receipt not found');
    if (dr.status === 'SIGNED') throw new BadRequestException('Cannot cancel a signed delivery receipt');
    await this.prisma.deliveryReceipt.update({ where: { id }, data: { status: 'CANCELLED' } });
    return this.findOne(tenantId, id);
  }

  // ---- Public (no auth, token-based) ----

  async getByToken(token: string) {
    const dr = await this.prisma.deliveryReceipt.findUnique({
      where: { token },
      include: {
        customer: { select: { id: true, name: true, address: true, contactPerson: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
        tenant: { select: { companyName: true } },
      },
    });
    if (!dr) throw new NotFoundException('Delivery receipt not found');
    return {
      drNumber: dr.drNumber,
      status: dr.status,
      deliveryDate: dr.deliveryDate,
      notes: dr.notes,
      company: dr.tenant?.companyName,
      customer: dr.customer,
      items: dr.items,
      signedByName: dr.signedByName,
      signatureData: dr.signatureData,
      signedAt: dr.signedAt,
    };
  }

  async signByToken(token: string, body: any) {
    const dr = await this.prisma.deliveryReceipt.findUnique({ where: { token } });
    if (!dr) throw new NotFoundException('Delivery receipt not found');
    if (dr.status === 'SIGNED') throw new BadRequestException('This delivery receipt is already signed');
    if (dr.status === 'CANCELLED') throw new BadRequestException('This delivery receipt was cancelled');
    if (!body?.signedByName) throw new BadRequestException('Please enter the name of the person receiving');

    // Only accept an image data URL for the signature (unauthenticated endpoint)
    const signatureData = typeof body.signatureData === 'string' ? body.signatureData : null;
    if (signatureData && !signatureData.startsWith('data:image/')) {
      throw new BadRequestException('Invalid signature data');
    }

    await this.prisma.deliveryReceipt.update({
      where: { token },
      data: { status: 'SIGNED', signedByName: String(body.signedByName).slice(0, 200), signatureData, signedAt: new Date() },
    });
    return { message: 'Signed', drNumber: dr.drNumber };
  }
}
