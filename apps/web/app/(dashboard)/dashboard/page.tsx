'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Package, FileText, ShoppingCart, AlertTriangle, Clock,
  ArrowUpRight, ArrowDownRight, Activity, Coins, Boxes, ArrowRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ── Types (matched to the API shape) ───────────────────────────────
interface DashboardStats {
  totalVendors: number; totalProducts: number; totalPRs: number; totalPOs: number;
  lowStockCount: number; pendingPRs: number; pendingPOs: number;
}
interface ProcurementMonth { month: string; count: number; total: number }
interface StockAlert { id: string; name: string; sku: string; currentStock: number; minStock: number; reorderPoint: number }
interface Movement { id: string; referenceNumber: string; type: string; quantity: number; createdAt: string; product?: { name: string; sku: string } }
interface PR { id: string; requestNumber: string; title: string; status: string; totalAmount: number; createdAt: string }
interface PO { id: string; orderNumber: string; status: string; totalAmount: number; createdAt: string; vendor?: { name: string } }
interface RecentActivity { recentMovements: Movement[]; recentPRs: PR[]; recentPOs: PO[] }

const IN_TYPES = new Set(['PURCHASE', 'TRANSFER_IN', 'RETURN', 'PRODUCTION_IN']);
const MOVE_COLORS: Record<string, string> = {
  PURCHASE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  SALE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TRANSFER_IN: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  TRANSFER_OUT: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  ADJUSTMENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  RETURN: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  WRITE_OFF: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PRODUCTION_IN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PRODUCTION_ISSUE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

// ── KPI card ────────────────────────────────────────────────────────
function Kpi({ label, value, icon, accent, href, hint }: Readonly<{
  label: string; value: ReactNode; icon: ReactNode; accent: string; href: string; hint?: ReactNode;
}>) {
  return (
    <Link href={href} className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', accent)}>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Link>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="mt-4 h-7 w-20 animate-pulse rounded bg-muted" />
    </div>
  );
}

function CardSkeleton() {
  return <div className="h-[340px] animate-pulse rounded-xl border bg-muted/40" />;
}

const SK_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
function TableSkeleton({ rows = 5 }: Readonly<{ rows?: number }>) {
  return (
    <div className="space-y-3 pt-1">
      {SK_KEYS.slice(0, rows).map((k) => <div key={k} className="h-9 w-full animate-pulse rounded bg-muted/50" />)}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: Readonly<any>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">Spend: <span className="font-semibold text-foreground">{formatCurrency(p.total)}</span></p>
      <p className="text-xs text-muted-foreground">{p.count} order{p.count === 1 ? '' : 's'}</p>
    </div>
  );
}

// ── Stock alert row ─────────────────────────────────────────────────
function StockAlertRow({ item }: Readonly<{ item: StockAlert }>) {
  const critical = item.currentStock < item.minStock;
  return (
    <tr className={cn('border-b last:border-0 transition-colors', critical ? 'bg-red-50/60 dark:bg-red-950/20' : 'hover:bg-muted/40')}>
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', critical ? 'bg-red-500' : 'bg-amber-500')} />
          <span className="font-medium">{item.name}</span>
        </div>
      </td>
      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{item.sku}</td>
      <td className={cn('py-2.5 pr-4 text-right font-semibold', critical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>{item.currentStock}</td>
      <td className="py-2.5 text-right text-muted-foreground">{item.reorderPoint}</td>
    </tr>
  );
}

// ── Generic activity table ─────────────────────────────────────────
interface Col { header: string; className?: string; render: (row: any) => ReactNode }
function ActivityTable({ rows, columns, emptyMessage }: Readonly<{ rows: any[] | undefined; columns: Col[]; emptyMessage: string }>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            {columns.map((c) => <th key={c.header} className={cn('pb-2 pr-4 font-medium', c.className)}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows?.length ? rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b last:border-0 transition-colors hover:bg-muted/40">
              {columns.map((c) => <td key={c.header} className={cn('py-2.5 pr-4', c.className)}>{c.render(row)}</td>)}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="py-10 text-center text-muted-foreground">{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MoveBadge({ type }: Readonly<{ type: string }>) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', MOVE_COLORS[type] || MOVE_COLORS.ADJUSTMENT)}>
    {IN_TYPES.has(type) ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
    {type.replaceAll('_', ' ')}
  </span>;
}

// ── Page ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();
  const [today, setToday] = useState('');
  useEffect(() => { setToday(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })); }, []);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({ queryKey: ['dashboard-stats'], queryFn: () => api.get('/dashboard/stats').then((r) => r.data) });
  const { data: inv } = useQuery<{ totalSkus: number; totalValue: number; lowStock: number }>({ queryKey: ['inventory-balance-summary'], queryFn: () => api.get('/inventory-balance/summary').then((r) => r.data.data) });
  const { data: activity, isLoading: activityLoading } = useQuery<RecentActivity>({ queryKey: ['dashboard-activity'], queryFn: () => api.get('/dashboard/recent-activity').then((r) => r.data) });
  const { data: procurement, isLoading: procLoading } = useQuery<ProcurementMonth[]>({ queryKey: ['dashboard-procurement'], queryFn: () => api.get('/dashboard/charts/procurement').then((r) => r.data) });
  const { data: stockAlerts, isLoading: alertsLoading } = useQuery<StockAlert[]>({ queryKey: ['dashboard-stock-alerts'], queryFn: () => api.get('/dashboard/charts/stock-alerts').then((r) => r.data) });

  const pending = (stats?.pendingPRs ?? 0) + (stats?.pendingPOs ?? 0);

  const kpis = [
    { label: 'Total Products', value: stats?.totalProducts ?? 0, icon: <Package className="h-5 w-5" />, accent: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400', href: '/products' },
    { label: 'Inventory SKUs', value: inv?.totalSkus ?? '—', icon: <Boxes className="h-5 w-5" />, accent: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400', href: '/inventory-balance' },
    { label: 'Vendors', value: stats?.totalVendors ?? 0, icon: <Building2 className="h-5 w-5" />, accent: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400', href: '/vendors' },
    { label: 'Purchase Requests', value: stats?.totalPRs ?? 0, icon: <FileText className="h-5 w-5" />, accent: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400', href: '/purchase-requests' },
    { label: 'Purchase Orders', value: stats?.totalPOs ?? 0, icon: <ShoppingCart className="h-5 w-5" />, accent: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400', href: '/purchase-orders' },
    { label: 'Pending Approvals', value: pending, icon: <Clock className="h-5 w-5" />, accent: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400', href: '/purchase-requests' },
    { label: 'Low Stock Items', value: stats?.lowStockCount ?? 0, icon: <AlertTriangle className="h-5 w-5" />, accent: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400', href: '/replenishment' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-800 to-[#1e3a5f] p-6 text-white shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute right-24 -bottom-12 h-40 w-40 rounded-full bg-white/[0.04]" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-white/60">{today || ' '}</p>
            <h1 className="mt-0.5 text-2xl font-semibold">Welcome back, {user?.firstName || 'there'}</h1>
            <p className="mt-1 max-w-md text-sm text-white/70">Live overview of procurement, inventory and production{user?.companyName ? ` for ${user.companyName}` : ''}.</p>
          </div>
          <div className="rounded-xl bg-white/10 px-5 py-3.5 backdrop-blur">
            <p className="flex items-center gap-1.5 text-xs text-white/60"><Coins className="h-3.5 w-3.5" /> Total inventory value</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{inv ? formatCurrency(inv.totalValue) : '—'}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {statsLoading
          ? ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k) => <KpiSkeleton key={k} />)
          : kpis.map((k) => <Kpi key={k.label} {...k} />)}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Procurement spend */}
        <div className="lg:col-span-3">
          {procLoading ? <CardSkeleton /> : (
            <Card className="h-full">
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold"><Activity className="h-4 w-4 text-primary" /> Procurement Spend</CardTitle>
                <p className="text-sm text-muted-foreground">Purchase order totals — last 6 months</p>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {procurement && procurement.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={procurement} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                        <defs>
                          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(213 54% 24%)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(213 54% 24%)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-muted-foreground" />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="total" stroke="hsl(213 54% 24%)" strokeWidth={2.5} fill="url(#spendFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No procurement data yet</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stock alerts */}
        <div className="lg:col-span-2">
          {alertsLoading ? <CardSkeleton /> : (
            <Card className="h-full">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold"><AlertTriangle className="h-4 w-4 text-amber-500" /> Stock Alerts</CardTitle>
                  <Link href="/replenishment" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Replenish <ArrowRight className="h-3 w-3" /></Link>
                </div>
                <p className="text-sm text-muted-foreground">At or below reorder point</p>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] overflow-auto">
                  {stockAlerts && stockAlerts.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Product</th>
                          <th className="pb-2 pr-4 font-medium">SKU</th>
                          <th className="pb-2 pr-4 text-right font-medium">On-hand</th>
                          <th className="pb-2 text-right font-medium">Reorder</th>
                        </tr>
                      </thead>
                      <tbody>{stockAlerts.map((i) => <StockAlertRow key={i.id} item={i} />)}</tbody>
                    </table>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Boxes className="h-8 w-8 opacity-40" />
                      All products are well stocked
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {activityLoading ? <TableSkeleton rows={5} /> : (
            <Tabs defaultValue="movements" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="movements">Stock Movements</TabsTrigger>
                <TabsTrigger value="prs">Purchase Requests</TabsTrigger>
                <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
              </TabsList>

              <TabsContent value="movements">
                <ActivityTable rows={activity?.recentMovements} emptyMessage="No recent stock movements" columns={[
                  { header: 'Reference', render: (m) => <span className="font-mono text-xs">{m.referenceNumber}</span> },
                  { header: 'Product', render: (m) => <span className="font-medium">{m.product?.name || '—'}</span> },
                  { header: 'Type', render: (m) => <MoveBadge type={m.type} /> },
                  { header: 'Qty', className: 'text-right', render: (m) => <span className={cn('font-mono font-semibold', IN_TYPES.has(m.type) ? 'text-green-600' : 'text-red-600')}>{IN_TYPES.has(m.type) ? '+' : '-'}{m.quantity}</span> },
                  { header: 'Date', className: 'text-right', render: (m) => <span className="text-muted-foreground">{formatDate(m.createdAt)}</span> },
                ]} />
              </TabsContent>

              <TabsContent value="prs">
                <ActivityTable rows={activity?.recentPRs} emptyMessage="No recent purchase requests" columns={[
                  { header: 'PR #', render: (p) => <span className="font-mono text-xs font-semibold">{p.requestNumber}</span> },
                  { header: 'Title', render: (p) => <span className="font-medium">{p.title}</span> },
                  { header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
                  { header: 'Amount', className: 'text-right', render: (p) => <span className="font-mono font-medium">{formatCurrency(p.totalAmount)}</span> },
                  { header: 'Date', className: 'text-right', render: (p) => <span className="text-muted-foreground">{formatDate(p.createdAt)}</span> },
                ]} />
              </TabsContent>

              <TabsContent value="pos">
                <ActivityTable rows={activity?.recentPOs} emptyMessage="No recent purchase orders" columns={[
                  { header: 'PO #', render: (o) => <span className="font-mono text-xs font-semibold">{o.orderNumber}</span> },
                  { header: 'Vendor', render: (o) => <span className="font-medium">{o.vendor?.name || '—'}</span> },
                  { header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
                  { header: 'Amount', className: 'text-right', render: (o) => <span className="font-mono font-medium">{formatCurrency(o.totalAmount)}</span> },
                  { header: 'Date', className: 'text-right', render: (o) => <span className="text-muted-foreground">{formatDate(o.createdAt)}</span> },
                ]} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
