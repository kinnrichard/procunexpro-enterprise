import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(tenantId: string) {
    const [
      totalVendors,
      totalProducts,
      totalPRs,
      totalPOs,
      pendingPRs,
      pendingPOs,
    ] = await Promise.all([
      this.prisma.vendor.count({ where: { tenantId, isActive: true } }),
      this.prisma.product.count({ where: { tenantId, isActive: true } }),
      this.prisma.purchaseRequest.count({ where: { tenantId } }),
      this.prisma.purchaseOrder.count({ where: { tenantId } }),
      this.prisma.purchaseRequest.count({
        where: { tenantId, status: 'PENDING_APPROVAL' },
      }),
      this.prisma.purchaseOrder.count({
        where: { tenantId, status: 'PENDING_APPROVAL' },
      }),
    ]);

    // Low stock count via raw query (field-to-field comparison)
    const lowStockResult: any[] = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as count
      FROM "Product"
      WHERE "tenantId" = ${tenantId}
        AND "isActive" = true
        AND "currentStock" <= "reorderPoint"
        AND "reorderPoint" > 0
    `;
    const lowStockCount = lowStockResult[0]?.count || 0;

    return {
      totalVendors,
      totalProducts,
      totalPRs,
      totalPOs,
      lowStockCount,
      pendingPRs,
      pendingPOs,
    };
  }

  async getRecentActivity(tenantId: string) {
    const [recentMovements, recentPRs, recentPOs] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
        },
      }),
      this.prisma.purchaseRequest.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          requestedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          vendor: { select: { id: true, name: true } },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    return {
      recentMovements,
      recentPRs,
      recentPOs,
    };
  }

  async getProcurementChart(tenantId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyData: any[] = await this.prisma.$queryRaw`
      SELECT
        TO_CHAR("orderDate", 'YYYY-MM') as month,
        COUNT(*)::int as count,
        COALESCE(SUM("totalAmount"), 0)::float as total
      FROM "PurchaseOrder"
      WHERE "tenantId" = ${tenantId}
        AND "orderDate" >= ${sixMonthsAgo}
      GROUP BY TO_CHAR("orderDate", 'YYYY-MM')
      ORDER BY month ASC
    `;

    return monthlyData;
  }

  async getStockAlerts(tenantId: string) {
    const alerts: any[] = await this.prisma.$queryRaw`
      SELECT
        p.id, p.name, p.sku, p."currentStock", p."reorderPoint",
        p."minStock", p.unit,
        c.name as "categoryName",
        w.name as "warehouseName"
      FROM "Product" p
      LEFT JOIN "Category" c ON p."categoryId" = c.id
      LEFT JOIN "Warehouse" w ON p."warehouseId" = w.id
      WHERE p."tenantId" = ${tenantId}
        AND p."isActive" = true
        AND p."currentStock" <= p."reorderPoint"
        AND p."reorderPoint" > 0
      ORDER BY (p."currentStock"::float / NULLIF(p."reorderPoint", 0)) ASC
      LIMIT 50
    `;

    return alerts;
  }
}
