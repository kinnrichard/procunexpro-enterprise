import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface LotAllocation {
  lotId: string;
  lotNumber: string;
  take: number;
  remainingAfter: number;
}

@Injectable()
export class StockLotsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; productId?: string; status?: string; qcStatus?: string; search?: string },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.productId) where.productId = params.productId;
    if (params.status) where.status = params.status;
    if (params.qcStatus) where.qcStatus = params.qcStatus;
    if (params.search) {
      where.OR = [
        { lotNumber: { contains: params.search, mode: 'insensitive' } },
        { product: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.stockLot.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          warehouse: { select: { id: true, name: true } },
        },
      }),
      this.prisma.stockLot.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // Lots already expired or expiring within `days`, still holding stock
  async expiring(tenantId: string, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const data = await this.prisma.stockLot.findMany({
      where: {
        tenantId,
        quantity: { gt: 0 },
        expiryDate: { not: null, lte: cutoff },
        status: { not: 'DEPLETED' },
      },
      orderBy: [{ expiryDate: 'asc' }],
      include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      take: 100,
    });
    return { data };
  }

  async create(tenantId: string, data: any) {
    const product = await this.prisma.product.findFirst({ where: { id: data.productId, tenantId } });
    if (!product) throw new NotFoundException('Product not found');

    const qty = data.quantity ?? 0;
    // Manual lot creation also tops up the product's aggregate stock
    const [lot] = await this.prisma.$transaction([
      this.prisma.stockLot.create({
        data: {
          tenantId,
          productId: data.productId,
          lotNumber: data.lotNumber,
          quantity: qty,
          initialQty: qty,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          source: data.source || 'Manual',
          status: 'AVAILABLE',
        },
      }),
      this.prisma.product.update({ where: { id: data.productId }, data: { currentStock: { increment: qty } } }),
    ]);
    return lot;
  }

  async update(tenantId: string, id: string, data: any) {
    const lot = await this.prisma.stockLot.findFirst({ where: { id, tenantId } });
    if (!lot) throw new NotFoundException('Lot not found');
    return this.prisma.stockLot.update({
      where: { id },
      data: {
        ...(data.lotNumber !== undefined && { lotNumber: data.lotNumber }),
        ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate ? new Date(data.expiryDate) : null }),
        ...(data.source !== undefined && { source: data.source }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.qcStatus !== undefined && { qcStatus: data.qcStatus }),
      },
    });
  }

  /**
   * Read available lots for a product, oldest-expiry-first (FEFO), and compute how to
   * draw `quantity` across them. Best-effort: if lots hold less than needed, allocates
   * what exists (remainder is treated as unlotted stock). Pure read — caller applies ops
   * inside its own transaction.
   */
  async allocateFEFO(tenantId: string, productId: string, quantity: number): Promise<LotAllocation[]> {
    if (quantity <= 0) return [];
    const lots = await this.prisma.stockLot.findMany({
      // Only QC-passed, available lots are consumable
      where: { tenantId, productId, status: 'AVAILABLE', qcStatus: 'PASSED', quantity: { gt: 0 } },
      orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
    });

    const allocations: LotAllocation[] = [];
    let remaining = quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.quantity, remaining);
      const remainingAfter = Math.round((lot.quantity - take) * 1e6) / 1e6;
      allocations.push({ lotId: lot.id, lotNumber: lot.lotNumber, take, remainingAfter });
      remaining -= take;
    }
    return allocations;
  }
}
