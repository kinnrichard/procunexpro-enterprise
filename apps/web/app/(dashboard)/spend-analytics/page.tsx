'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, DollarSign, Building2, Calendar } from 'lucide-react';

const COLORS = ['#1e3a5f', '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#6366f1', '#0891b2'];

function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-muted rounded w-24" />
      <div className="h-8 bg-muted rounded w-32" />
    </div>
  );
}

function SpendBar({ label, amount, max, count }: Readonly<{ label: string; amount: number; max: number; count: number }>) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate mr-2">{label}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">{count} orders</span>
          <span className="font-mono font-semibold">{formatCurrency(amount)}</span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(amount / max) * 100}%` }} />
      </div>
    </div>
  );
}

export default function SpendAnalyticsPage() {
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['spend-summary'],
    queryFn: () => api.get('/spend-analytics/summary'),
  });

  const { data: byVendorData } = useQuery({
    queryKey: ['spend-by-vendor'],
    queryFn: () => api.get('/spend-analytics/by-vendor'),
  });

  const { data: byCategoryData } = useQuery({
    queryKey: ['spend-by-category'],
    queryFn: () => api.get('/spend-analytics/by-category'),
  });

  const { data: byDeptData } = useQuery({
    queryKey: ['spend-by-department'],
    queryFn: () => api.get('/spend-analytics/by-department'),
  });

  const { data: trendsData } = useQuery({
    queryKey: ['spend-trends'],
    queryFn: () => api.get('/spend-analytics/trends'),
  });

  const summary = summaryData?.data || {};
  const byVendor = byVendorData?.data || [];
  const byCategory = byCategoryData?.data || [];
  const byDept = byDeptData?.data || [];
  const trends = trendsData?.data || [];

  const maxVendorSpend = byVendor.length > 0 ? Math.max(...byVendor.map((v: any) => v.totalSpend || 0)) : 1;
  const maxCatSpend = byCategory.length > 0 ? Math.max(...byCategory.map((c: any) => c.totalSpend || 0)) : 1;
  const maxDeptSpend = byDept.length > 0 ? Math.max(...byDept.map((d: any) => d.totalSpend || 0)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Spend Analytics" description="Analyze procurement spending patterns" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryLoading ? (
          <>
            {[1, 2, 3, 4, 5].map(i => <Card key={i} className="p-4"><SkeletonCard /></Card>)}
          </>
        ) : (
          <>
            <StatCard title="Total Spend" value={formatCurrency(summary.totalSpend || 0)} icon={<DollarSign className="h-5 w-5" />} />
            <StatCard title="This Month" value={formatCurrency(summary.thisMonth || 0)} icon={<Calendar className="h-5 w-5" />} />
            <StatCard title="Last Month" value={formatCurrency(summary.lastMonth || 0)} icon={<Calendar className="h-5 w-5" />} />
            <StatCard title="This Quarter" value={formatCurrency(summary.thisQuarter || 0)} icon={<TrendingUp className="h-5 w-5" />} />
            <StatCard title="Top Vendor" value={summary.topVendor || '—'} icon={<Building2 className="h-5 w-5" />} />
          </>
        )}
      </div>

      {/* Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Spending Trend (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis className="text-xs" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number) => [formatCurrency(value), 'Spend']}
                />
                <Bar dataKey="totalSpend" fill="hsl(213 54% 24%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">No spending data yet</div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="vendor">
        <TabsList>
          <TabsTrigger value="vendor">By Vendor</TabsTrigger>
          <TabsTrigger value="category">By Category</TabsTrigger>
          <TabsTrigger value="department">By Department</TabsTrigger>
        </TabsList>

        <TabsContent value="vendor" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Vendor Spend Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {byVendor.length > 0 ? byVendor.slice(0, 10).map((v: any) => (
                  <SpendBar key={v.vendorId} label={v.vendorName || 'Unknown'} amount={v.totalSpend || 0} max={maxVendorSpend} count={v.orderCount || 0} />
                )) : <div className="text-center py-8 text-muted-foreground">No vendor data</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Vendor Distribution</CardTitle></CardHeader>
              <CardContent>
                {byVendor.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={byVendor.slice(0, 8)} dataKey="totalSpend" nameKey="vendorName" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                        {byVendor.slice(0, 8).map((v: any, i: number) => <Cell key={v.vendorId ?? `cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="category" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Category Spend Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {byCategory.length > 0 ? byCategory.slice(0, 10).map((c: any) => (
                <SpendBar key={c.categoryId} label={c.categoryName || 'Uncategorized'} amount={c.totalSpend || 0} max={maxCatSpend} count={c.itemCount || 0} />
              )) : <div className="text-center py-8 text-muted-foreground">No category data</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="department" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Department Spend Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {byDept.length > 0 ? byDept.slice(0, 10).map((d: any) => (
                <SpendBar key={d.departmentId} label={d.departmentName || 'Unknown'} amount={d.totalSpend || 0} max={maxDeptSpend} count={d.requestCount || 0} />
              )) : <div className="text-center py-8 text-muted-foreground">No department data</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
