import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ApprovalsService } from '../approvals/approvals.service';

const round = (n: number) => Math.round(n * 1e6) / 1e6;

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
  ) {}

  async findAll(
    tenantId: string,
    params: {
      page?: number; limit?: number; search?: string;
      fromWarehouseId?: string; toWarehouseId?: string; dateFrom?: string; dateTo?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.search) where.transferNumber = { contains: params.search, mode: 'insensitive' };
    if (params.fromWarehouseId) where.fromWarehouseId = params.fromWarehouseId;
    if (params.toWarehouseId) where.toWarehouseId = params.toWarehouseId;

    if (params.dateFrom || params.dateTo) {
      where.transferDate = {};
      if (params.dateFrom) where.transferDate.gte = new Date(params.dateFrom);
      if (params.dateTo) where.transferDate.lte = new Date(`${params.dateTo}T23:59:59.999Z`);
    }

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
    const approvals = await this.approvals.getRequestsMap(tenantId, 'STOCK_TRANSFER', data.map((t) => t.id));
    const withApproval = data.map((t) => ({ ...t, approval: approvals.get(t.id) || null }));
    return { data: withApproval, total, page, limit };
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

  /**
   * Records a transfer as PENDING. No stock moves until a manager approves it —
   * lots are allocated and TRANSFER_OUT/IN movements are written at approval time.
   */
  async create(tenantId: string, userId: string, data: any) {
    const { toWarehouseId } = data;
    // Source may be "Unassigned" (stock lots with no warehouse) — sent as 'UNASSIGNED' or empty.
    const fromUnassigned = !data.fromWarehouseId || data.fromWarehouseId === 'UNASSIGNED';
    const fromWarehouseId: string | null = fromUnassigned ? null : data.fromWarehouseId;
    if (!toWarehouseId) throw new BadRequestException('Destination warehouse is required');
    if (!fromUnassigned && fromWarehouseId === toWarehouseId) throw new BadRequestException('Source and destination must differ');

    const rows: any[] = Array.isArray(data?.items) ? data.items.filter((i: any) => i.productId && i.quantity > 0) : [];
    if (rows.length === 0) throw new BadRequestException('No items to transfer');

    const [fromWh, toWh] = await Promise.all([
      fromWarehouseId ? this.prisma.warehouse.findFirst({ where: { id: fromWarehouseId, tenantId } }) : Promise.resolve(null),
      this.prisma.warehouse.findFirst({ where: { id: toWarehouseId, tenantId } }),
    ]);
    if (!toWh) throw new NotFoundException('Destination warehouse not found');
    if (fromWarehouseId && !fromWh) throw new NotFoundException('Source warehouse not found');
    const fromName = fromWh?.name || 'Unassigned';

    // Soft availability check for a better UX; authoritative check runs at approval.
    await this.assertAvailability(tenantId, fromWarehouseId, fromName, rows);

    const today = new Date();
    const trPrefix = `TR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const trCount = await this.prisma.stockTransfer.count({ where: { tenantId, transferNumber: { startsWith: trPrefix } } });
    const transferNumber = `${trPrefix}-${String(trCount + 1).padStart(4, '0')}`;

    const created = await this.prisma.stockTransfer.create({
      data: {
        tenantId, transferNumber, fromWarehouseId, toWarehouseId, createdById: userId, notes: data.notes || null,
        status: 'PENDING',
        items: { create: rows.map((r) => ({ productId: r.productId, quantity: round(r.quantity), uom: r.uom || 'pcs' })) },
      },
    });

    const { required } = await this.approvals.ensureRequest(tenantId, 'STOCK_TRANSFER', created.id, userId);
    if (!required) {
      // No workflow configured → apply immediately.
      await this.applyApproved(tenantId, created.id, userId);
    }
    return this.findOne(tenantId, created.id);
  }

  /** Ensures each item has enough available stock at the source; throws otherwise. */
  private async assertAvailability(tenantId: string, fromWarehouseId: string | null, fromName: string, rows: any[]) {
    for (const r of rows) {
      const need = round(r.quantity);
      const lots = await this.prisma.stockLot.findMany({
        where: {
          tenantId, productId: r.productId, status: 'AVAILABLE', qcStatus: 'PASSED', quantity: { gt: 0 },
          ...(fromWarehouseId ? { OR: [{ warehouseId: fromWarehouseId }, { warehouseId: null }] } : { warehouseId: null }),
        },
      });
      const available = round(lots.reduce((s, l) => s + l.quantity, 0));
      if (available < need) {
        throw new BadRequestException(`Insufficient stock at ${fromName} for one of the items (available ${available}, need ${need})`);
      }
    }
  }

  /** Records an approval on the current stage; applies the transfer once fully approved. */
  async approve(tenantId: string, id: string, userId: string, userRole: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({ where: { id, tenantId } });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException(`Only pending transfers can be approved (current: ${transfer.status})`);
    }
    const outcome = await this.approvals.decide(tenantId, 'STOCK_TRANSFER', id, userId, userRole, 'APPROVED');
    if (outcome.approved) {
      await this.applyApproved(tenantId, id, userId);
    }
    return this.findOne(tenantId, id);
  }

  /** Allocates lots FEFO, creates destination lots + net-zero movements, marks APPROVED. */
  private async applyApproved(tenantId: string, id: string, approverId: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, tenantId },
      include: { items: true, toWarehouse: { select: { id: true, name: true } }, fromWarehouse: { select: { id: true, name: true } } },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');

    const { transferNumber, fromWarehouseId, toWarehouseId } = transfer;
    const fromName = transfer.fromWarehouse?.name || 'Unassigned';
    const toName = transfer.toWarehouse?.name || '';
    const rows = transfer.items;

    const today = new Date();
    const smPrefix = `SM-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    let smSeq = await this.prisma.stockMovement.count({ where: { tenantId, referenceNumber: { startsWith: smPrefix } } });
    const nextSm = () => `${smPrefix}-${String(++smSeq).padStart(4, '0')}`;

    const ops: any[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const need = round(r.quantity);
      const lots = await this.prisma.stockLot.findMany({
        where: {
          tenantId, productId: r.productId, status: 'AVAILABLE', qcStatus: 'PASSED', quantity: { gt: 0 },
          ...(fromWarehouseId ? { OR: [{ warehouseId: fromWarehouseId }, { warehouseId: null }] } : { warehouseId: null }),
        },
        orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
      });
      const available = round(lots.reduce((s, l) => s + l.quantity, 0));
      if (available < need) {
        throw new BadRequestException(`Insufficient stock at ${fromName} for one of the items (available ${available}, need ${need})`);
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

      ops.push(this.prisma.stockLot.create({
        data: {
          tenantId, productId: r.productId, warehouseId: toWarehouseId,
          lotNumber: `${transferNumber}-${idx + 1}`,
          quantity: need, initialQty: need,
          expiryDate: earliestExpiry,
          source: `Transfer ${transferNumber} from ${fromName}`,
          status: 'AVAILABLE', qcStatus: 'PASSED',
        },
      }));

      ops.push(
        this.prisma.stockMovement.create({ data: { tenantId, referenceNumber: nextSm(), productId: r.productId, type: 'TRANSFER_OUT', quantity: need, fromWarehouseId, reason: `Transfer ${transferNumber} to ${toName}`, performedBy: approverId } }),
        this.prisma.stockMovement.create({ data: { tenantId, referenceNumber: nextSm(), productId: r.productId, type: 'TRANSFER_IN', quantity: need, toWarehouseId, reason: `Transfer ${transferNumber} from ${fromName}`, performedBy: approverId } }),
      );
    }

    ops.push(this.prisma.stockTransfer.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: approverId, approvedAt: new Date(), rejectionReason: null },
    }));

    await this.prisma.$transaction(ops);
    return this.findOne(tenantId, id);
  }

  /** Rejects the transfer at the current stage without moving any stock. */
  async reject(tenantId: string, id: string, userId: string, userRole: string, reason?: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({ where: { id, tenantId } });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException(`Only pending transfers can be rejected (current: ${transfer.status})`);
    }
    await this.approvals.decide(tenantId, 'STOCK_TRANSFER', id, userId, userRole, 'REJECTED', reason);
    await this.prisma.stockTransfer.update({
      where: { id },
      data: { status: 'REJECTED', approvedById: userId, approvedAt: new Date(), rejectionReason: reason || null },
    });
    return this.findOne(tenantId, id);
  }
}
