'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { downloadCsv } from '@/lib/export';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  BarChart3, Download, DollarSign, TrendingUp, TrendingDown,
  Package, Building2, Wallet, GitPullRequest, ShoppingCart,
  AlertTriangle, CheckCircle, Clock,
} from 'lucide-react';

const COLORS = ['#1e3a5f', '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#6366f1', '#0891b2'];

type PeriodPreset = 'this-month' | 'last-month' | 'this-quarter' | 'last-quarter' | 'this-year' | 'last-year' | 'all';

function getPeriodDates(preset: PeriodPreset): { startDate?: string; endDate?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'this-month':
      return { startDate: new Date(y, m, 1).toISOString(), endDate: new Date(y, m + 1, 0).toISOString() };
    case 'last-month':
      return { startDate: new Date(y, m - 1, 1).toISOString(), endDate: new Date(y, m, 0).toISOString() };
    case 'this-quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { startDate: new Date(y, qStart, 1).toISOString(), endDate: new Date(y, qStart + 3, 0).toISOString() };
    }
    case 'last-quarter': {
      const qStart = Math.floor(m / 3) * 3 - 3;
      return { startDate: new Date(y, qStart, 1).toISOString(), endDate: new Date(y, qStart + 3, 0).toISOString() };
    }
    case 'this-year':
      return { startDate: new Date(y, 0, 1).toISOString(), endDate: new Date(y, 11, 31).toISOString() };
    case 'last-year':
      return { startDate: new Date(y - 1, 0, 1).toISOString(), endDate: new Date(y - 1, 11, 31).toISOString() };
    case 'all':
    default:
      return {};
  }
}

const periodLabels: Record<PeriodPreset, string> = {
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'this-quarter': 'This Quarter',
  'last-quarter': 'Last Quarter',
  'this-year': 'This Year',
  'last-year': 'Last Year',
  'all': 'All Time',
};

export default function ReportsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState('spend');
  const [period, setPeriod] = useState<PeriodPreset>('all');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());

  const dates = getPeriodDates(period);
  const params = { ...(dates.startDate && { startDate: dates.startDate }), ...(dates.endDate && { endDate: dates.endDate }) };

  const { data: spendData, isLoading: spendLoading } = useQuery({
    queryKey: ['report-spend', period],
    queryFn: () => api.get('/reports/spend-summary', { params }),
  });

  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    queryKey: ['report-vendors', period],
    queryFn: () => api.get('/reports/vendor-performance', { params }),
  });

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['report-stock'],
    queryFn: () => api.get('/reports/stock-valuation'),
  });

  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ['report-budgets', fiscalYear],
    queryFn: () => api.get('/reports/budget-utilization', { params: { fiscalYear } }),
  });

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery({
    queryKey: ['report-pipeline'],
    queryFn: () => api.get('/reports/procurement-pipeline'),
  });

  const spend = spendData?.data || {};
  const vendors = vendorData?.data || [];
  const stock = stockData?.data || {};
  const budget = budgetData?.data || {};
  const pipeline = pipelineData?.data || {};

  const handleExport = async (reportType: string) => {
    try {
      const csvParams: Record<string, string> = {};
      if (reportType !== 'stock-valuation' && dates.startDate) csvParams.startDate = dates.startDate;
      if (reportType !== 'stock-valuation' && dates.endDate) csvParams.endDate = dates.endDate;
      if (reportType === 'budget-utilization') csvParams.fiscalYear = fiscalYear;

      await downloadCsv(`/reports/${reportType}/csv`, `${reportType}-${new Date().toISOString().split('T')[0]}.csv`, csvParams);
      toast({ title: 'Report exported' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const PeriodSelector = () => (
    <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
      <SelectTrigger className="h-8 w-40 rounded-lg text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(periodLabels).map(([k, v]) => (
          <SelectItem key={k} value={k}>{v}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const Skeleton = () => <div className="animate-pulse h-[300px] bg-muted rounded-lg" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Pre-built reports with CSV export" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="spend">Spend Summary</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Performance</TabsTrigger>
          <TabsTrigger value="stock">Stock Valuation</TabsTrigger>
          <TabsTrigger value="budgets">Budget Utilization</TabsTrigger>
          <TabsTrigger value="pipeline">Procurement Pipeline</TabsTrigger>
        </TabsList>

        {/* SPEND SUMMARY */}
        <TabsContent value="spend" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <PeriodSelector />
            <Button variant="outline" size="sm" onClick={() => handleExport('spend-summary')}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title="Total Spend" value={formatCurrency(spend.totalSpend || 0)} icon={<DollarSign className="h-5 w-5" />} />
            <StatCard title="Previous Period" value={formatCurrency(spend.previousPeriodSpend || 0)} icon={<DollarSign className="h-5 w-5" />} />
            <StatCard
              title="Change"
              value={`${(spend.changePercent || 0) >= 0 ? '+' : ''}${(spend.changePercent || 0).toFixed(1)}%`}
              icon={(spend.changePercent || 0) >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Spend Trend</CardTitle></CardHeader>
            <CardContent>
              {spendLoading ? <Skeleton /> : spend.monthlyBreakdown?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={spend.monthlyBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(v: number) => [formatCurrency(v), 'Amount']} />
                    <Bar dataKey="amount" fill="hsl(213 54% 24%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-[300px] text-muted-foreground">No spend data for this period</div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VENDOR PERFORMANCE */}
        <TabsContent value="vendors" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <PeriodSelector />
            <Button variant="outline" size="sm" onClick={() => handleExport('vendor-performance')}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>

          {vendorLoading ? <Skeleton /> : vendors.length > 0 ? (
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Vendor</th>
                    <th className="text-right px-4 py-3">Orders</th>
                    <th className="text-right px-4 py-3">Total Spend</th>
                    <th className="text-right px-4 py-3">Avg Lead Time</th>
                    <th className="text-right px-4 py-3">On-Time %</th>
                    <th className="text-right px-4 py-3">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v: any, i: number) => (
                    <tr key={v.vendorId} className="border-t border-border/50 hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS[i % COLORS.length]}20`, color: COLORS[i % COLORS.length] }}>
                            {i + 1}
                          </div>
                          <span className="font-medium">{v.vendorName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{v.totalOrders}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(v.totalSpend)}</td>
                      <td className="px-4 py-3 text-right">{v.avgLeadTimeDays ? `${v.avgLeadTimeDays} days` : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('font-medium', (v.onTimePercent || 0) >= 90 ? 'text-green-600' : (v.onTimePercent || 0) >= 70 ? 'text-amber-600' : 'text-red-600')}>
                          {v.onTimePercent != null ? `${v.onTimePercent.toFixed(0)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v.latestScore != null ? (
                          <span className={cn('font-bold', v.latestScore >= 8 ? 'text-green-600' : v.latestScore >= 6 ? 'text-blue-600' : 'text-amber-600')}>
                            {v.latestScore.toFixed(1)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-center py-16 text-muted-foreground">No vendor performance data</div>}
        </TabsContent>

        {/* STOCK VALUATION */}
        <TabsContent value="stock" className="mt-6 space-y-6">
          <div className="flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={() => handleExport('stock-valuation')}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Value" value={formatCurrency(stock.totalValue || 0)} icon={<Package className="h-5 w-5" />} />
            <StatCard title="Total Products" value={stock.totalProducts || 0} icon={<Package className="h-5 w-5" />} />
            <StatCard title="Low Stock" value={stock.lowStockCount || 0} icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard title="Out of Stock" value={stock.outOfStockCount || 0} icon={<AlertTriangle className="h-5 w-5" />} />
          </div>

          {stockLoading ? <Skeleton /> : (stock.items?.length || 0) > 0 ? (
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-left px-4 py-3">SKU</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-right px-4 py-3">Stock</th>
                    <th className="text-right px-4 py-3">Cost Price</th>
                    <th className="text-right px-4 py-3">Total Value</th>
                    <th className="text-center px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.items.map((item: any) => (
                    <tr key={item.productId} className={cn('border-t border-border/50', item.stockStatus === 'OUT' && 'bg-red-50/50 dark:bg-red-900/5', item.stockStatus === 'LOW' && 'bg-amber-50/50 dark:bg-amber-900/5')}>
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.category || '—'}</td>
                      <td className="px-4 py-3 text-right">{item.currentStock}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.costPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.totalValue)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={item.stockStatus === 'OK' ? 'default' : item.stockStatus === 'LOW' ? 'secondary' : 'destructive'} className="text-[10px]">
                          {item.stockStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-center py-16 text-muted-foreground">No products found</div>}
        </TabsContent>

        {/* BUDGET UTILIZATION */}
        <TabsContent value="budgets" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <Select value={fiscalYear} onValueChange={setFiscalYear}>
              <SelectTrigger className="h-8 w-32 rounded-lg text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => handleExport('budget-utilization')}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>

          {budget.summary && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard title="Total Budgeted" value={formatCurrency(budget.summary.totalBudgeted || 0)} icon={<Wallet className="h-5 w-5" />} />
              <StatCard title="Total Spent" value={formatCurrency(budget.summary.totalSpent || 0)} icon={<DollarSign className="h-5 w-5" />} />
              <StatCard title="Avg Utilization" value={`${(budget.summary.avgUtilization || 0).toFixed(1)}%`} icon={<TrendingUp className="h-5 w-5" />} />
            </div>
          )}

          {budgetLoading ? <Skeleton /> : (budget.budgets?.length || 0) > 0 ? (
            <div className="grid gap-4">
              {budget.budgets.map((b: any) => {
                const util = b.totalAmount > 0 ? (b.spentAmount / b.totalAmount) * 100 : 0;
                return (
                  <Card key={b.id}>
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">{b.name}</h4>
                          <p className="text-xs text-muted-foreground">FY{b.fiscalYear} | <StatusBadge status={b.status} /></p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{formatCurrency(b.spentAmount)} <span className="text-sm text-muted-foreground font-normal">/ {formatCurrency(b.totalAmount)}</span></div>
                          <div className={cn('text-sm font-medium', util > 90 ? 'text-red-600' : util > 75 ? 'text-amber-600' : 'text-green-600')}>{util.toFixed(1)}% utilized</div>
                        </div>
                      </div>
                      <Progress value={Math.min(util, 100)} className="h-2" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : <div className="text-center py-16 text-muted-foreground">No budgets for FY{fiscalYear}</div>}
        </TabsContent>

        {/* PROCUREMENT PIPELINE */}
        <TabsContent value="pipeline" className="mt-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total PRs" value={pipeline.totalPRs || 0} icon={<GitPullRequest className="h-5 w-5" />} />
            <StatCard title="Total POs" value={pipeline.totalPOs || 0} icon={<ShoppingCart className="h-5 w-5" />} />
            <StatCard title="Avg PR Approval" value={pipeline.avgPRApprovalDays != null ? `${pipeline.avgPRApprovalDays} days` : '—'} icon={<Clock className="h-5 w-5" />} />
            <StatCard title="Avg PO Approval" value={pipeline.avgPOApprovalDays != null ? `${pipeline.avgPOApprovalDays} days` : '—'} icon={<Clock className="h-5 w-5" />} />
          </div>

          {pipelineLoading ? <Skeleton /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Purchase Requests by Status</CardTitle></CardHeader>
                <CardContent>
                  {pipeline.prByStatus ? (
                    <div className="space-y-3">
                      {Object.entries(pipeline.prByStatus).map(([status, count]: [string, any]) => {
                        const total = pipeline.totalPRs || 1;
                        const pct = (count / total) * 100;
                        return (
                          <div key={status} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <StatusBadge status={status} />
                              <span className="font-medium">{count}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div className="text-center py-8 text-muted-foreground">No data</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Purchase Orders by Status</CardTitle></CardHeader>
                <CardContent>
                  {pipeline.poByStatus ? (
                    <div className="space-y-3">
                      {Object.entries(pipeline.poByStatus).map(([status, count]: [string, any]) => {
                        const total = pipeline.totalPOs || 1;
                        const pct = (count / total) * 100;
                        return (
                          <div key={status} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <StatusBadge status={status} />
                              <span className="font-medium">{count}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div className="text-center py-8 text-muted-foreground">No data</div>}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
