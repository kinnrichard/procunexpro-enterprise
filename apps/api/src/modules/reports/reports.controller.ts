import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ============================================================
  // JSON Endpoints
  // ============================================================

  @Get('spend-summary')
  getSpendSummary(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSpendSummary(req.user.tenantId, {
      startDate,
      endDate,
    });
  }

  @Get('vendor-performance')
  getVendorPerformance(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getVendorPerformance(req.user.tenantId, {
      startDate,
      endDate,
    });
  }

  @Get('stock-valuation')
  getStockValuation(@Req() req: any) {
    return this.reportsService.getStockValuation(req.user.tenantId);
  }

  @Get('budget-utilization')
  getBudgetUtilization(
    @Req() req: any,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    return this.reportsService.getBudgetUtilization(req.user.tenantId, {
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
    });
  }

  @Get('procurement-pipeline')
  getProcurementPipeline(@Req() req: any) {
    return this.reportsService.getProcurementPipeline(req.user.tenantId);
  }

  // ============================================================
  // CSV Export Endpoints
  // ============================================================

  @Get('spend-summary/csv')
  async getSpendSummaryCsv(
    @Req() req: any,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.reportsService.getSpendSummary(req.user.tenantId, {
      startDate,
      endDate,
    });

    const headers = ['Month', 'Amount', 'Order Count'];
    const rows = data.monthlyBreakdown.map((m: any) => [
      m.month,
      m.amount,
      m.orderCount,
    ]);

    // Add summary row
    rows.push(
      [],
      ['Total Spend', data.totalSpend, ''],
      ['Previous Period Spend', data.previousPeriodSpend, ''],
      ['Change %', data.changePercent, ''],
    );

    const csv = this.reportsService.generateCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="spend-summary.csv"');
    res.send(csv);
  }

  @Get('vendor-performance/csv')
  async getVendorPerformanceCsv(
    @Req() req: any,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.reportsService.getVendorPerformance(
      req.user.tenantId,
      { startDate, endDate },
    );

    const headers = [
      'Vendor Name',
      'Total Orders',
      'Total Spend',
      'Avg Lead Time (Days)',
      'On-Time %',
      'Latest Score',
    ];
    const rows = data.map((v: any) => [
      v.vendorName,
      v.totalOrders,
      v.totalSpend,
      v.avgLeadTimeDays,
      v.onTimePercent,
      v.latestScore,
    ]);

    const csv = this.reportsService.generateCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vendor-performance.csv"');
    res.send(csv);
  }

  @Get('stock-valuation/csv')
  async getStockValuationCsv(
    @Req() req: any,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getStockValuation(req.user.tenantId);

    const headers = [
      'Product Name',
      'SKU',
      'Category',
      'Warehouse',
      'Current Stock',
      'Cost Price',
      'Total Value',
      'Stock Status',
    ];
    const rows = data.items.map((item: any) => [
      item.name,
      item.sku,
      item.category,
      item.warehouse,
      item.currentStock,
      item.costPrice,
      item.totalValue,
      item.stockStatus,
    ]);

    // Add summary rows
    rows.push(
      [],
      ['Total Value', '', '', '', '', '', data.totalValue, ''],
      ['Total Products', '', '', '', '', '', data.totalProducts, ''],
      ['Low Stock Count', '', '', '', '', '', data.lowStockCount, ''],
      ['Out of Stock Count', '', '', '', '', '', data.outOfStockCount, ''],
    );

    const csv = this.reportsService.generateCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="stock-valuation.csv"');
    res.send(csv);
  }

  @Get('budget-utilization/csv')
  async getBudgetUtilizationCsv(
    @Req() req: any,
    @Res() res: Response,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    const data = await this.reportsService.getBudgetUtilization(
      req.user.tenantId,
      { fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined },
    );

    const headers = [
      'Budget Name',
      'Fiscal Year',
      'Total Amount',
      'Spent Amount',
      'Utilization %',
      'Remaining',
      'Status',
    ];
    const rows = data.budgets.map((b: any) => [
      b.name,
      b.fiscalYear,
      b.totalAmount,
      b.spentAmount,
      b.utilization,
      b.remaining,
      b.status,
    ]);

    // Add summary rows
    rows.push(
      [],
      ['Summary', '', data.summary.totalBudgeted, data.summary.totalSpent, data.summary.avgUtilization, '', ''],
    );

    const csv = this.reportsService.generateCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="budget-utilization.csv"');
    res.send(csv);
  }
}
