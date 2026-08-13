import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const round = (n: number) => Math.round(n * 1e6) / 1e6;

@Injectable()
export class StockTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.search) where.transferNumber = { contains: params.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, tenantId },
      include: {
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
      },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }

  async create(tenantId: string, userId: string, data: any) {
    const { fromWarehouseId, toWarehouseId } = data;
    if (!fromWarehouseId || !toWarehouseId) throw new BadRequestException('Both source and destination warehouses are required');
    if (fromWarehouseId === toWarehouseId) throw new BadRequestException('Source and destination must differ');

    const rows: any[] = Array.isArray(data?.items) ? data.items.filter((i: any) => i.productId && i.quantity > 0) : [];
    if (rows.length === 0) throw new BadRequestException('No items to transfer');

    const [fromWh, toWh] = await Promise.all([
      this.prisma.warehouse.findFirst({ where: { id: fromWarehouseId, tenantId } }),
      this.prisma.warehouse.findFirst({ where: { id: toWarehouseId, tenantId } }),
    ]);
    if (!fromWh || !toWh) throw new NotFoundException('Warehouse not found');

    const today = new Date();
    const trPrefix = `TR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const trCount = await this.prisma.stockTransfer.count({ where: { tenantId, transferNumber: { startsWith: trPrefix } } });
    const transferNumber = `${trPrefix}-${String(trCount + 1).padStart(4, '0')}`;

    const smPrefix = `SM-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    let smSeq = await this.prisma.stockMovement.count({ where: { tenantId, referenceNumber: { startsWith: smPrefix } } });
    const nextSm = () => `${smPrefix}-${String(++smSeq).padStart(4, '0')}`;

    const ops: any[] = [];

    // Allocate each item FEFO from source-warehouse lots (strict: must cover the qty)
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const need = round(r.quantity);
      const lots = await this.prisma.stockLot.findMany({
        where: {
          tenantId, productId: r.productId, status: 'AVAILABLE', qcStatus: 'PASSED', quantity: { gt: 0 },
          OR: [{ warehouseId: fromWarehouseId }, { warehouseId: null }],
        },
        orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
      });
      const available = round(lots.reduce((s, l) => s + l.quantity, 0));
      if (available < need) {
        throw new BadRequestException(`Insufficient stock at ${fromWh.name} for one of the items (available ${available}, need ${need})`);
      }

      let remaining = need;
      let earliestExpiry: Date | null = null;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(lot.quantity, remaining);
        const after = round(lot.quantity - take);
        if (lot.expiryDate && (!earliestExpiry || lot.expiryDate < earliestExpiry)) earliestExpiry = lot.expiryDate;
        ops.push(this.prisma.stockLot.update({ where: { id: lot.id }, data: { quantity: after, ...(after <= 0 ? { status: 'DEPLETED' } : {}) } }));
        remaining = round(remaining - take);
      }

      // Destination lot (new, at target warehouse)
      ops.push(this.prisma.stockLot.create({
        data: {
          tenantId, productId: r.productId, warehouseId: toWarehouseId,
          lotNumber: `${transferNumber}-${idx + 1}`,
          quantity: need, initialQty: need,
          expiryDate: earliestExpiry,
          source: `Transfer ${transferNumber} from ${fromWh.name}`,
          status: 'AVAILABLE', qcStatus: 'PASSED',
        },
      }));

      // Movements out + in (net-zero to currentStock)
      ops.push(
        this.prisma.stockMovement.create({ data: { tenantId, referenceNumber: nextSm(), productId: r.productId, type: 'TRANSFER_OUT', quantity: need, fromWarehouseId, reason: `Transfer ${transferNumber} to ${toWh.name}`, performedBy: userId } }),
        this.prisma.stockMovement.create({ data: { tenantId, referenceNumber: nextSm(), productId: r.productId, type: 'TRANSFER_IN', quantity: need, toWarehouseId, reason: `Transfer ${transferNumber} from ${fromWh.name}`, performedBy: userId } }),
      );
    }

    ops.push(this.prisma.stockTransfer.create({
      data: {
        tenantId, transferNumber, fromWarehouseId, toWarehouseId, createdById: userId, notes: data.notes || null,
        items: { create: rows.map((r) => ({ productId: r.productId, quantity: round(r.quantity), uom: r.uom || 'pcs' })) },
      },
    }));

    await this.prisma.$transaction(ops);
    const created = await this.prisma.stockTransfer.findFirst({ where: { tenantId, transferNumber } });
    return this.findOne(tenantId, created!.id);
  }
}
