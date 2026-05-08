import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SpendAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async byVendor(tenantId: string) {
    const results = await this.prisma.purchaseOrder.groupBy({
      by: ['vendorId'],
      where: {
        tenantId,
        status: 'RECEIVED',
      },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    });

    const vendorIds = results.map((r) => r.vendorId);
    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true },
    });
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    return results.map((r) => ({
      vendorId: r.vendorId,
      vendorName: vendorMap.get(r.vendorId) || 'Unknown',
      totalSpend: r._sum.totalAmount || 0,
      orderCount: r._count.id,
    }));
  }

  async byCategory(tenantId: string) {
    // Join PO items -> product -> category
    const poItems = await this.prisma.purchaseOrderItem.findMany({
      where: {
        purchaseOrder: {
          tenantId,
          status: 'RECEIVED',
        },
      },
      include: {
        product: {
          select: {
            categoryId: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    const categoryMap = new Map<string, { categoryId: string; categoryName: string; totalSpend: number; itemCount: number }>();

    for (const item of poItems) {
      const catId = item.product.categoryId || 'uncategorized';
      const catName = item.product.category?.name || 'Uncategorized';
      const existing = categoryMap.get(catId);
      if (existing) {
        existing.totalSpend += item.totalPrice;
        existing.itemCount += 1;
      } else {
        categoryMap.set(catId, {
          categoryId: catId,
          categoryName: catName,
          totalSpend: item.totalPrice,
          itemCount: 1,
        });
      }
    }

    return Array.from(categoryMap.values()).sort((a, b) => b.totalSpend - a.totalSpend);
  }

  async byDepartment(tenantId: string) {
    // POs linked to PRs that have departments
    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: 'RECEIVED',
        purchaseRequestId: { not: null },
      },
      include: {
        purchaseRequest: {
          select: {
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    const deptMap = new Map<string, { departmentId: string; departmentName: string; totalSpend: number; requestCount: number }>();

    for (const po of pos) {
      const deptId = po.purchaseRequest?.departmentId || 'unassigned';
      const deptName = po.purchaseRequest?.department?.name || 'Unassigned';
      const existing = deptMap.get(deptId);
      if (existing) {
        existing.totalSpend += po.totalAmount;
        existing.requestCount += 1;
      } else {
        deptMap.set(deptId, {
          departmentId: deptId,
          departmentName: deptName,
          totalSpend: po.totalAmount,
          requestCount: 1,
        });
      }
    }

    return Array.from(deptMap.values()).sort((a, b) => b.totalSpend - a.totalSpend);
  }

  async trends(tenantId: string) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: 'RECEIVED',
        orderDate: { gte: twelveMonthsAgo },
      },
      select: {
        orderDate: true,
        totalAmount: true,
      },
    });

    const monthMap = new Map<string, { totalSpend: number; orderCount: number }>();

    // Initialize all 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, { totalSpend: 0, orderCount: 0 });
    }

    for (const po of pos) {
      const d = new Date(po.orderDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key);
      if (existing) {
        existing.totalSpend += po.totalAmount;
        existing.orderCount += 1;
      }
    }

    return Array.from(monthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async summary(tenantId: string) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const thisQuarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const thisQuarterStart = new Date(now.getFullYear(), thisQuarterMonth, 1);

    const baseWhere = { tenantId, status: 'RECEIVED' as const };

    const [totalSpendResult, thisMonthResult, lastMonthResult, thisQuarterResult] = await Promise.all([
      this.prisma.purchaseOrder.aggregate({
        where: baseWhere,
        _sum: { totalAmount: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { ...baseWhere, orderDate: { gte: thisMonthStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { ...baseWhere, orderDate: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { totalAmount: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { ...baseWhere, orderDate: { gte: thisQuarterStart } },
        _sum: { totalAmount: true },
      }),
    ]);

    // Top vendor
    const topVendorResult = await this.prisma.purchaseOrder.groupBy({
      by: ['vendorId'],
      where: baseWhere,
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 1,
    });

    let topVendor = null;
    if (topVendorResult.length > 0) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: topVendorResult[0].vendorId },
        select: { id: true, name: true },
      });
      topVendor = {
        vendorId: topVendorResult[0].vendorId,
        vendorName: vendor?.name || 'Unknown',
        totalSpend: topVendorResult[0]._sum.totalAmount || 0,
      };
    }

    // Top category
    const byCategory = await this.byCategory(tenantId);
    const topCategory = byCategory.length > 0 ? byCategory[0] : null;

    return {
      totalSpend: totalSpendResult._sum.totalAmount || 0,
      thisMonth: thisMonthResult._sum.totalAmount || 0,
      lastMonth: lastMonthResult._sum.totalAmount || 0,
      thisQuarter: thisQuarterResult._sum.totalAmount || 0,
      topVendor,
      topCategory,
    };
  }
}
