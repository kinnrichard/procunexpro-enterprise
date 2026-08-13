import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const WEB_BASE = process.env.WEB_URL || 'http://localhost:3005';

@Injectable()
export class DeliveryReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  private signUrl(token: string) {
    return `${WEB_BASE}/dr/sign/${token}`;
  }

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.status) where.status = params.status;
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
    return { data: data.map((d) => ({ ...d, signUrl: this.signUrl(d.token) })), total, page, limit };
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
    return { ...dr, signUrl: this.signUrl(dr.token) };
  }

  // Release finished goods to a customer and create the DR (with external sign token)
  async create(tenantId: string, userId: string, data: any) {
    const customer = await this.prisma.customer.findFirst({ where: { id: data.customerId, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const rows: any[] = Array.isArray(data?.items) ? data.items.filter((i: any) => i.productId && i.quantity > 0) : [];
    if (rows.length === 0) throw new BadRequestException('No items to release');

    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: rows.map((r) => r.productId) } },
      select: { id: true, name: true, unit: true, currentStock: true },
    });
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const today = new Date();
    const drPrefix = `DR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const drCount = await this.prisma.deliveryReceipt.count({ where: { tenantId, drNumber: { startsWith: drPrefix } } });
    const drNumber = `${drPrefix}-${String(drCount + 1).padStart(4, '0')}`;

    const smPrefix = `SM-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    let smSeq = await this.prisma.stockMovement.count({ where: { tenantId, referenceNumber: { startsWith: smPrefix } } });
    const nextSm = () => `${smPrefix}-${String(++smSeq).padStart(4, '0')}`;

    const ops: any[] = [];

    for (const r of rows) {
      const need = round(r.quantity);
      const prod = prodMap.get(r.productId);
      if (!prod) throw new NotFoundException('Product not found');
      if (prod.currentStock < need) {
        throw new BadRequestException(`Insufficient stock for ${prod.name} (available ${prod.currentStock}, need ${need})`);
      }

      // Draw down finished-good lots FEFO (QC-passed), best-effort
      const lots = await this.prisma.stockLot.findMany({
        where: { tenantId, productId: r.productId, status: 'AVAILABLE', qcStatus: 'PASSED', quantity: { gt: 0 }, ...(data.warehouseId ? { OR: [{ warehouseId: data.warehouseId }, { warehouseId: null }] } : {}) },
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
        this.prisma.stockMovement.create({ data: { tenantId, referenceNumber: nextSm(), productId: r.productId, type: 'SALE', quantity: need, fromWarehouseId: data.warehouseId || null, reason: `Released via ${drNumber} to ${customer.name}`, performedBy: userId } }),
      );
    }

    ops.push(this.prisma.deliveryReceipt.create({
      data: {
        tenantId, drNumber, customerId: data.customerId, warehouseId: data.warehouseId || null,
        status: 'RELEASED', releasedAt: today, notes: data.notes || null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : today,
        token: randomUUID(), createdById: userId,
        items: { create: rows.map((r) => ({ productId: r.productId, quantity: round(r.quantity), uom: r.uom || prodMap.get(r.productId)?.unit || 'pcs' })) },
      },
    }));

    await this.prisma.$transaction(ops);
    const created = await this.prisma.deliveryReceipt.findFirst({ where: { tenantId, drNumber } });
    return this.findOne(tenantId, created!.id);
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
