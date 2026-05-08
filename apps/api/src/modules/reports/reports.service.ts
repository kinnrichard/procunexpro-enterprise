import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // Report 1: Spend Summary
  // ============================================================
  async getSpendSummary(
    tenantId: string,
    params: { startDate?: string; endDate?: string },
  ) {
    const now = new Date();
    const start = params.startDate ? new Date(params.startDate) : null;
    const end = params.endDate ? new Date(params.endDate) : null;

    // Build date filter for receivedAt
    const dateFilter: any = {};
    if (start || end) {
      dateFilter.receivedAt = {};
      if (start) dateFilter.receivedAt.gte = start;
      if (end) dateFilter.receivedAt.lte = end;
    }

    // Total spend from RECEIVED POs
    const receivedPOs = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: 'RECEIVED',
        ...dateFilter,
      },
      select: { totalAmount: true, receivedAt: true, orderDate: true },
    });

    const totalSpend = receivedPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0);

    // Previous period spend for comparison
    let previousPeriodSpend = 0;
    if (start && end) {
      const duration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - duration);
      const prevEnd = new Date(start.getTime());

      const prevPOs = await this.prisma.purchaseOrder.findMany({
        where: {
          tenantId,
          status: 'RECEIVED',
          receivedAt: { gte: prevStart, lte: prevEnd },
        },
        select: { totalAmount: true },
      });
      previousPeriodSpend = prevPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
    } else {
      // Default: compare current month vs previous month
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      const prevPOs = await this.prisma.purchaseOrder.findMany({
        where: {
          tenantId,
          status: 'RECEIVED',
          receivedAt: { gte: prevMonthStart, lte: prevMonthEnd },
        },
        select: { totalAmount: true },
      });
      previousPeriodSpend = prevPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
    }

    const changePercent =
      previousPeriodSpend > 0
        ? Math.round(((totalSpend - previousPeriodSpend) / previousPeriodSpend) * 10000) / 100
        : totalSpend > 0
          ? 100
          : 0;

    // Monthly breakdown (last 12 months or within date range)
    const monthlyStart =
      start || new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyEnd = end || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthlyData: any[] = await this.prisma.$queryRaw`
      SELECT
        TO_CHAR("receivedAt", 'YYYY-MM') as month,
        COALESCE(SUM("totalAmount"), 0)::float as amount,
        COUNT(*)::int as "orderCount"
      FROM "PurchaseOrder"
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'RECEIVED'
        AND "receivedAt" >= ${monthlyStart}
        AND "receivedAt" <= ${monthlyEnd}
      GROUP BY TO_CHAR("receivedAt", 'YYYY-MM')
      ORDER BY month ASC
    `;

    return {
      totalSpend,
      previousPeriodSpend,
      changePercent,
      monthlyBreakdown: monthlyData,
    };
  }

  // ============================================================
  // Report 2: Vendor Performance
  // ============================================================
  async getVendorPerformance(
    tenantId: string,
    params: { startDate?: string; endDate?: string },
  ) {
    const start = params.startDate ? new Date(params.startDate) : null;
    const end = params.endDate ? new Date(params.endDate) : null;

    const dateFilter: any = {};
    if (start || end) {
      dateFilter.orderDate = {};
      if (start) dateFilter.orderDate.gte = start;
      if (end) dateFilter.orderDate.lte = end;
    }

    const vendors = await this.prisma.vendor.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        purchaseOrders: {
          where: {
            ...dateFilter,
          },
          select: {
            id: true,
            totalAmount: true,
            orderDate: true,
            expectedDate: true,
            receivedAt: true,
            status: true,
          },
        },
        supplierScores: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { overall: true },
        },
      },
    });

    return vendors
      .map((vendor) => {
        const pos = vendor.purchaseOrders;
        const totalOrders = pos.length;
        const totalSpend = pos.reduce((sum, po) => sum + (po.totalAmount || 0), 0);

        // Average lead time (expectedDate - orderDate) in days
        const posWithDates = pos.filter((po) => po.expectedDate && po.orderDate);
        const avgLeadTimeDays =
          posWithDates.length > 0
            ? Math.round(
                posWithDates.reduce((sum, po) => {
                  const diff =
                    (new Date(po.expectedDate!).getTime() - new Date(po.orderDate).getTime()) /
                    (1000 * 60 * 60 * 24);
                  return sum + diff;
                }, 0) / posWithDates.length,
              )
            : null;

        // On-time delivery %: received POs where receivedAt <= expectedDate
        const receivedPOs = pos.filter(
          (po) => po.status === 'RECEIVED' && po.receivedAt && po.expectedDate,
        );
        const onTimePOs = receivedPOs.filter(
          (po) => new Date(po.receivedAt!).getTime() <= new Date(po.expectedDate!).getTime(),
        );
        const onTimePercent =
          receivedPOs.length > 0
            ? Math.round((onTimePOs.length / receivedPOs.length) * 10000) / 100
            : null;

        const latestScore = vendor.supplierScores[0]?.overall ?? null;

        return {
          vendorId: vendor.id,
          vendorName: vendor.name,
          totalOrders,
          totalSpend,
          avgLeadTimeDays,
          onTimePercent,
          latestScore,
        };
      })
      .filter((v) => v.totalOrders > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }

  // ============================================================
  // Report 3: Stock Valuation
  // ============================================================
  async getStockValuation(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        costPrice: true,
        reorderPoint: true,
        category: { select: { name: true } },
        warehouse: { select: { name: true } },
      },
    });

    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const items = products.map((p) => {
      const itemValue = p.currentStock * p.costPrice;
      totalValue += itemValue;

      let stockStatus: 'OK' | 'LOW' | 'OUT';
      if (p.currentStock <= 0) {
        stockStatus = 'OUT';
        outOfStockCount++;
      } else if (p.reorderPoint > 0 && p.currentStock <= p.reorderPoint) {
        stockStatus = 'LOW';
        lowStockCount++;
      } else {
        stockStatus = 'OK';
      }

      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name || null,
        warehouse: p.warehouse?.name || null,
        currentStock: p.currentStock,
        costPrice: p.costPrice,
        totalValue: itemValue,
        stockStatus,
      };
    });

    return {
      totalValue,
      totalProducts: products.length,
      lowStockCount,
      outOfStockCount,
      items,
    };
  }

  // ============================================================
  // Report 4: Budget Utilization
  // ============================================================
  async getBudgetUtilization(
    tenantId: string,
    params: { fiscalYear?: number },
  ) {
    const where: any = {
      tenantId,
      status: { in: ['ACTIVE', 'CLOSED', 'OVERSPENT'] },
    };
    if (params.fiscalYear) {
      where.fiscalYear = params.fiscalYear;
    }

    const budgets = await this.prisma.budget.findMany({
      where,
      orderBy: { fiscalYear: 'desc' },
      include: {
        allocations: {
          include: {
            department: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    let totalBudgeted = 0;
    let totalSpent = 0;

    const budgetItems = budgets.map((b) => {
      const utilization =
        b.totalAmount > 0
          ? Math.round((b.spentAmount / b.totalAmount) * 10000) / 100
          : 0;
      const remaining = b.totalAmount - b.spentAmount;

      totalBudgeted += b.totalAmount;
      totalSpent += b.spentAmount;

      return {
        id: b.id,
        name: b.name,
        fiscalYear: b.fiscalYear,
        totalAmount: b.totalAmount,
        spentAmount: b.spentAmount,
        utilization,
        remaining,
        status: b.status,
        allocations: b.allocations.map((a) => ({
          id: a.id,
          departmentName: a.department?.name || null,
          categoryName: a.category?.name || null,
          amount: a.amount,
          spentAmount: a.spentAmount,
          utilization: a.amount > 0 ? Math.round((a.spentAmount / a.amount) * 10000) / 100 : 0,
        })),
      };
    });

    const avgUtilization =
      totalBudgeted > 0
        ? Math.round((totalSpent / totalBudgeted) * 10000) / 100
        : 0;

    return {
      budgets: budgetItems,
      summary: {
        totalBudgeted,
        totalSpent,
        avgUtilization,
      },
    };
  }

  // ============================================================
  // Report 5: Procurement Pipeline
  // ============================================================
  async getProcurementPipeline(tenantId: string) {
    // PR counts by status
    const prCounts = await this.prisma.purchaseRequest.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    const prByStatus: Record<string, number> = {};
    let totalPRs = 0;
    for (const row of prCounts) {
      prByStatus[row.status] = row._count.id;
      totalPRs += row._count.id;
    }

    // PO counts by status
    const poCounts = await this.prisma.purchaseOrder.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    const poByStatus: Record<string, number> = {};
    let totalPOs = 0;
    for (const row of poCounts) {
      poByStatus[row.status] = row._count.id;
      totalPOs += row._count.id;
    }

    // Average PR approval time (createdAt to approvedAt)
    const approvedPRs = await this.prisma.purchaseRequest.findMany({
      where: { tenantId, approvedAt: { not: null } },
      select: { createdAt: true, approvedAt: true },
    });

    const avgPRApprovalDays =
      approvedPRs.length > 0
        ? Math.round(
            (approvedPRs.reduce((sum, pr) => {
              const diff =
                (new Date(pr.approvedAt!).getTime() - new Date(pr.createdAt).getTime()) /
                (1000 * 60 * 60 * 24);
              return sum + diff;
            }, 0) /
              approvedPRs.length) *
              100,
          ) / 100
        : null;

    // Average PO approval time (createdAt to approvedAt)
    const approvedPOs = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, approvedAt: { not: null } },
      select: { createdAt: true, approvedAt: true },
    });

    const avgPOApprovalDays =
      approvedPOs.length > 0
        ? Math.round(
            (approvedPOs.reduce((sum, po) => {
              const diff =
                (new Date(po.approvedAt!).getTime() - new Date(po.createdAt).getTime()) /
                (1000 * 60 * 60 * 24);
              return sum + diff;
            }, 0) /
              approvedPOs.length) *
              100,
          ) / 100
        : null;

    return {
      prByStatus,
      poByStatus,
      avgPRApprovalDays,
      avgPOApprovalDays,
      totalPRs,
      totalPOs,
    };
  }

  // ============================================================
  // CSV Export Helper
  // ============================================================
  generateCsv(headers: string[], rows: any[][]): string {
    const escapeCsvField = (field: any): string => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const headerLine = headers.map(escapeCsvField).join(',');
    const dataLines = rows.map((row) => row.map(escapeCsvField).join(','));

    return [headerLine, ...dataLines].join('\r\n');
  }
}
