import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { WIDGET_CATALOG, WIDGET_TYPES, catalogEntry, DEFAULT_LAYOUT } from './widget-catalog';

const FULL_ACCESS_ROLES = ['SUPERADMIN', 'ADMIN'];

const INBOUND_TYPES = ['PURCHASE', 'TRANSFER_IN', 'RETURN', 'PRODUCTION_IN'];
const OUTBOUND_TYPES = ['SALE', 'TRANSFER_OUT', 'WRITE_OFF', 'PRODUCTION_ISSUE'];

@Injectable()
export class DashboardWidgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  catalog() {
    return WIDGET_CATALOG;
  }

  // On first ever open, seed the default layout so the dashboard isn't blank.
  private async ensureSeeded(tenantId: string) {
    const count = await this.prisma.dashboardWidget.count({ where: { tenantId } });
    if (count > 0) return;
    await this.prisma.dashboardWidget.createMany({
      data: DEFAULT_LAYOUT.map((w) => ({
        tenantId,
        type: w.type,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        config: w.config ?? undefined,
        allowedRoles: [],
      })),
    });
  }

  // Every widget (edit mode / admin).
  async list(tenantId: string) {
    await this.ensureSeeded(tenantId);
    return this.prisma.dashboardWidget.findMany({
      where: { tenantId },
      orderBy: [{ y: 'asc' }, { x: 'asc' }],
    });
  }

  // Only widgets the current viewer's role is allowed to see.
  async listForRole(tenantId: string, role: string) {
    const all = await this.list(tenantId);
    const isAdmin = FULL_ACCESS_ROLES.includes(role);
    return all.filter((w) => w.isActive && (isAdmin || this.roleAllowed(w.allowedRoles, role)));
  }

  private roleAllowed(allowedRoles: string[], role: string) {
    if (!allowedRoles || allowedRoles.length === 0) return true; // empty = everyone
    return allowedRoles.includes(role);
  }

  async create(tenantId: string, body: any) {
    const type = String(body?.type || '');
    if (!WIDGET_TYPES.has(type)) throw new BadRequestException('Unknown widget type');
    const entry = catalogEntry(type)!;
    return this.prisma.dashboardWidget.create({
      data: {
        tenantId,
        type,
        title: body.title?.trim() || null,
        config: body.config ?? undefined,
        allowedRoles: Array.isArray(body.allowedRoles) ? body.allowedRoles : [],
        x: Number.isFinite(body.x) ? body.x : 0,
        y: Number.isFinite(body.y) ? body.y : 0,
        w: Number.isFinite(body.w) ? body.w : entry.defaultSize.w,
        h: Number.isFinite(body.h) ? body.h : entry.defaultSize.h,
      },
    });
  }

  async update(tenantId: string, id: string, body: any) {
    await this.assertOwned(tenantId, id);
    const data: any = {};
    if (body.title !== undefined) data.title = body.title?.trim() || null;
    if (body.config !== undefined) data.config = body.config;
    if (body.allowedRoles !== undefined) data.allowedRoles = Array.isArray(body.allowedRoles) ? body.allowedRoles : [];
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      if (Number.isFinite(body[k])) data[k] = body[k];
    }
    return this.prisma.dashboardWidget.update({ where: { id }, data });
  }

  // Bulk-save grid positions after a drag/resize.
  async updateLayout(tenantId: string, items: any[]) {
    const rows = Array.isArray(items) ? items : [];
    const owned = await this.prisma.dashboardWidget.findMany({ where: { tenantId }, select: { id: true } });
    const ownedIds = new Set(owned.map((r) => r.id));
    await this.prisma.$transaction(
      rows
        .filter((r) => ownedIds.has(r.id))
        .map((r) =>
          this.prisma.dashboardWidget.update({
            where: { id: r.id },
            data: {
              x: Number.isFinite(r.x) ? r.x : 0,
              y: Number.isFinite(r.y) ? r.y : 0,
              w: Number.isFinite(r.w) ? r.w : 1,
              h: Number.isFinite(r.h) ? r.h : 1,
            },
          }),
        ),
    );
    return this.list(tenantId);
  }

  async remove(tenantId: string, id: string) {
    await this.assertOwned(tenantId, id);
    await this.prisma.dashboardWidget.delete({ where: { id } });
    return { success: true };
  }

  private async assertOwned(tenantId: string, id: string) {
    const w = await this.prisma.dashboardWidget.findFirst({ where: { id, tenantId } });
    if (!w) throw new NotFoundException('Widget not found');
    return w;
  }

  // Compute the data payload for one widget, re-checking role visibility.
  async data(tenantId: string, id: string, role: string) {
    const widget = await this.assertOwned(tenantId, id);
    if (!FULL_ACCESS_ROLES.includes(role) && !this.roleAllowed(widget.allowedRoles, role)) {
      throw new ForbiddenException('You cannot view this widget');
    }
    const config = (widget.config as any) || {};
    return this.resolve(tenantId, widget.type, config);
  }

  private async resolve(tenantId: string, type: string, config: any): Promise<any> {
    switch (type) {
      // ---- KPIs ----
      case 'kpi-total-items':
        return this.kpi(await this.prisma.product.count({ where: { tenantId, isActive: true } }));
      case 'kpi-inventory-skus':
        return this.kpi(await this.prisma.product.count({ where: { tenantId, isActive: true } }));
      case 'kpi-total-vendors':
        return this.kpi(await this.prisma.vendor.count({ where: { tenantId, isActive: true } }));
      case 'kpi-total-prs':
        return this.kpi(await this.prisma.purchaseRequest.count({ where: { tenantId } }));
      case 'kpi-total-pos':
        return this.kpi(await this.prisma.purchaseOrder.count({ where: { tenantId } }));
      case 'kpi-pending-approvals': {
        const [pr, po] = await Promise.all([
          this.prisma.purchaseRequest.count({ where: { tenantId, status: 'PENDING_APPROVAL' } }),
          this.prisma.purchaseOrder.count({ where: { tenantId, status: 'PENDING_APPROVAL' } }),
        ]);
        return this.kpi(pr + po);
      }
      case 'kpi-low-stock':
        return this.kpi(await this.lowStockCount(tenantId));
      case 'kpi-inventory-value':
        return this.kpi(await this.inventoryValue(tenantId), 'currency');
      case 'kpi-open-rfqs':
        return this.kpi(await this.prisma.rFQ.count({ where: { tenantId, status: 'PUBLISHED' } }));
      case 'kpi-pending-deliveries':
        return this.kpi(await this.prisma.deliveryReceipt.count({ where: { tenantId, status: { in: ['DRAFT', 'RELEASED'] } } }));
      case 'kpi-active-productions':
        return this.kpi(await this.prisma.production.count({ where: { tenantId, status: { in: ['DRAFT', 'IN_PROGRESS'] } } }));
      case 'kpi-expiring-lots':
        return this.kpi(await this.expiringLotsCount(tenantId, Number(config.days) || 30));
      case 'kpi-active-customers':
        return this.kpi(await this.prisma.customer.count({ where: { tenantId, isActive: true } }));

      // ---- Charts ----
      case 'chart-procurement-spend':
        return this.procurementSpend(tenantId, Number(config.months) || 6);
      case 'chart-pr-status':
        return this.groupCount('purchaseRequest', tenantId);
      case 'chart-po-status':
        return this.groupCount('purchaseOrder', tenantId);
      case 'chart-stock-by-warehouse':
        return this.stockByWarehouse(tenantId);
      case 'chart-top-vendors':
        return this.topVendors(tenantId, Number(config.limit) || 5);
      case 'chart-movements-trend':
        return this.movementsTrend(tenantId, Number(config.months) || 6);
      case 'chart-inventory-by-category':
        return this.inventoryByCategory(tenantId);

      // ---- Lists ----
      case 'list-stock-alerts':
        return { rows: (await this.dashboard.getStockAlerts(tenantId)).slice(0, Number(config.limit) || 10) };
      case 'list-recent-movements':
        return { rows: await this.recentMovements(tenantId, Number(config.limit) || 10) };
      case 'list-recent-prs':
        return { rows: await this.recentPRs(tenantId, Number(config.limit) || 5) };
      case 'list-recent-pos':
        return { rows: await this.recentPOs(tenantId, Number(config.limit) || 5) };
      case 'list-pending-approvals':
        return { rows: await this.pendingApprovals(tenantId, Number(config.limit) || 10) };
      case 'list-expiring-lots':
        return { rows: await this.expiringLots(tenantId, Number(config.days) || 30, Number(config.limit) || 10) };
      case 'list-recent-rfqs':
        return { rows: await this.recentRFQs(tenantId, Number(config.limit) || 5) };
      case 'list-recent-deliveries':
        return { rows: await this.recentDeliveries(tenantId, Number(config.limit) || 5) };

      // ---- Utility ----
      case 'util-welcome':
        return { totalValue: await this.inventoryValue(tenantId) };
      case 'util-quick-actions':
      case 'util-notes':
        return {}; // rendered purely client-side from config

      default:
        return {};
    }
  }

  private kpi(value: number, format: 'number' | 'currency' = 'number') {
    return { value, format };
  }

  private async lowStockCount(tenantId: string): Promise<number> {
    const r: any[] = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM "Product"
      WHERE "tenantId" = ${tenantId} AND "isActive" = true
        AND "currentStock" <= "reorderPoint" AND "reorderPoint" > 0`;
    return r[0]?.count || 0;
  }

  private async inventoryValue(tenantId: string): Promise<number> {
    const r: any[] = await this.prisma.$queryRaw`
      SELECT COALESCE(SUM("currentStock" * COALESCE("costPrice", 0)), 0)::float as value
      FROM "Product" WHERE "tenantId" = ${tenantId} AND "isActive" = true`;
    return Math.round((r[0]?.value || 0) * 100) / 100;
  }

  private async expiringLotsCount(tenantId: string, days: number): Promise<number> {
    const until = new Date();
    until.setDate(until.getDate() + days);
    return this.prisma.stockLot.count({
      where: { tenantId, status: 'AVAILABLE', quantity: { gt: 0 }, expiryDate: { not: null, lte: until } },
    });
  }

  private async procurementSpend(tenantId: string, months: number) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const rows: any[] = await this.prisma.$queryRaw`
      SELECT TO_CHAR("orderDate", 'YYYY-MM') as month, COUNT(*)::int as count,
             COALESCE(SUM("totalAmount"), 0)::float as total
      FROM "PurchaseOrder"
      WHERE "tenantId" = ${tenantId} AND "orderDate" >= ${since}
      GROUP BY TO_CHAR("orderDate", 'YYYY-MM') ORDER BY month ASC`;
    return { series: rows };
  }

  private async groupCount(model: 'purchaseRequest' | 'purchaseOrder', tenantId: string) {
    const grouped = await (this.prisma[model] as any).groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });
    return { series: grouped.map((g: any) => ({ name: g.status, value: g._count._all })) };
  }

  private async stockByWarehouse(tenantId: string) {
    const rows: any[] = await this.prisma.$queryRaw`
      SELECT COALESCE(w.name, 'Unassigned') as name,
             COALESCE(SUM(l.quantity * COALESCE(p."costPrice", 0)), 0)::float as value
      FROM "StockLot" l
      JOIN "Product" p ON l."productId" = p.id
      LEFT JOIN "Warehouse" w ON l."warehouseId" = w.id
      WHERE l."tenantId" = ${tenantId} AND l.status = 'AVAILABLE'
      GROUP BY w.name ORDER BY value DESC`;
    return { series: rows };
  }

  private async topVendors(tenantId: string, limit: number) {
    const rows: any[] = await this.prisma.$queryRaw`
      SELECT v.name as name, COALESCE(SUM(po."totalAmount"), 0)::float as value
      FROM "PurchaseOrder" po
      JOIN "Vendor" v ON po."vendorId" = v.id
      WHERE po."tenantId" = ${tenantId}
      GROUP BY v.name ORDER BY value DESC LIMIT ${limit}`;
    return { series: rows };
  }

  private async movementsTrend(tenantId: string, months: number) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const rows: any[] = await this.prisma.$queryRaw`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') as month,
             COALESCE(SUM(CASE WHEN "type" = ANY(${INBOUND_TYPES}) THEN "quantity" ELSE 0 END), 0)::float as inbound,
             COALESCE(SUM(CASE WHEN "type" = ANY(${OUTBOUND_TYPES}) THEN "quantity" ELSE 0 END), 0)::float as outbound
      FROM "StockMovement"
      WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${since} AND "status" = 'APPROVED'
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM') ORDER BY month ASC`;
    return { series: rows };
  }

  private async inventoryByCategory(tenantId: string) {
    const rows: any[] = await this.prisma.$queryRaw`
      SELECT COALESCE(c.name, 'Uncategorized') as name,
             COALESCE(SUM(p."currentStock" * COALESCE(p."costPrice", 0)), 0)::float as value
      FROM "Product" p
      LEFT JOIN "Category" c ON p."categoryId" = c.id
      WHERE p."tenantId" = ${tenantId} AND p."isActive" = true
      GROUP BY c.name HAVING SUM(p."currentStock" * COALESCE(p."costPrice", 0)) > 0
      ORDER BY value DESC`;
    return { series: rows };
  }

  private async recentMovements(tenantId: string, take: number) {
    return this.prisma.stockMovement.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' }, take,
      include: { product: { select: { id: true, name: true, sku: true } } },
    });
  }

  private async recentPRs(tenantId: string, take: number) {
    return this.prisma.purchaseRequest.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' }, take,
      include: { requestedBy: { select: { firstName: true, lastName: true } } },
    });
  }

  private async recentPOs(tenantId: string, take: number) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' }, take,
      include: { vendor: { select: { name: true } } },
    });
  }

  private async pendingApprovals(tenantId: string, take: number) {
    const [prs, pos] = await Promise.all([
      this.prisma.purchaseRequest.findMany({
        where: { tenantId, status: 'PENDING_APPROVAL' }, orderBy: { createdAt: 'desc' }, take,
      }),
      this.prisma.purchaseOrder.findMany({
        where: { tenantId, status: 'PENDING_APPROVAL' }, orderBy: { createdAt: 'desc' }, take,
        include: { vendor: { select: { name: true } } },
      }),
    ]);
    const rows = [
      ...prs.map((p) => ({ id: p.id, kind: 'PR', reference: p.requestNumber, title: p.title, amount: p.totalAmount, createdAt: p.createdAt })),
      ...pos.map((p) => ({ id: p.id, kind: 'PO', reference: p.orderNumber, title: (p as any).vendor?.name || '', amount: p.totalAmount, createdAt: p.createdAt })),
    ];
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows.slice(0, take);
  }

  private async expiringLots(tenantId: string, days: number, take: number) {
    const until = new Date();
    until.setDate(until.getDate() + days);
    return this.prisma.stockLot.findMany({
      where: { tenantId, status: 'AVAILABLE', quantity: { gt: 0 }, expiryDate: { not: null, lte: until } },
      orderBy: { expiryDate: 'asc' }, take,
      include: { product: { select: { name: true, sku: true } } },
    });
  }

  private async recentRFQs(tenantId: string, take: number) {
    return this.prisma.rFQ.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' }, take,
      include: { vendor: { select: { name: true } } },
    });
  }

  private async recentDeliveries(tenantId: string, take: number) {
    return this.prisma.deliveryReceipt.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' }, take,
      include: { customer: { select: { name: true } } },
    });
  }
}
