'use client';

import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Package,
  FileText,
  ShoppingCart,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ── Types ──────────────────────────────────────────────────────────
interface DashboardStats {
  totalVendors: number;
  totalProducts: number;
  purchaseRequests: number;
  purchaseOrders: number;
  lowStockItems: number;
  pendingApprovals: number;
  vendorsTrend?: number;
  productsTrend?: number;
  prTrend?: number;
  poTrend?: number;
}

interface ProcurementMonth {
  month: string;
  amount: number;
  count: number;
}

interface StockAlert {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStock: number;
  reorderPoint: number;
}

interface StockMovement {
  id: string;
  reference: string;
  productName: string;
  type: string;
  quantity: number;
  createdAt: string;
}

interface PurchaseRequest {
  id: string;
  prNumber: string;
  title: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface RecentActivity {
  stockMovements: StockMovement[];
  purchaseRequests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
}

// ── Skeleton helpers ───────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      </div>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full animate-pulse rounded bg-muted/50" />
      </CardContent>
    </Card>
  );
}

const TABLE_SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

function TableSkeleton({ rows = 5 }: Readonly<{ rows?: number }>) {
  return (
    <div className="space-y-3">
      {TABLE_SKELETON_KEYS.slice(0, rows).map((key) => (
        <div key={key} className="h-10 w-full animate-pulse rounded bg-muted/50" />
      ))}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: Readonly<any>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">
        Amount: <span className="font-semibold text-foreground">{formatCurrency(payload[0].value)}</span>
      </p>
      {payload[0].payload.count !== undefined && (
        <p className="text-sm text-muted-foreground">
          Orders: <span className="font-semibold text-foreground">{payload[0].payload.count}</span>
        </p>
      )}
    </div>
  );
}

// ── Stock alert helpers ────────────────────────────────────────────
function stockAlertRowClass(isCritical: boolean, isWarning: boolean): string {
  if (isCritical) return 'border-b last:border-0 transition-colors bg-red-50 dark:bg-red-950/20';
  if (isWarning) return 'border-b last:border-0 transition-colors bg-amber-50 dark:bg-amber-950/20';
  return 'border-b last:border-0 transition-colors';
}

function stockAlertStockClass(isCritical: boolean, isWarning: boolean): string {
  if (isCritical) return 'py-2.5 pr-4 text-right font-semibold text-red-600 dark:text-red-400';
  if (isWarning) return 'py-2.5 pr-4 text-right font-semibold text-amber-600 dark:text-amber-400';
  return 'py-2.5 pr-4 text-right font-semibold';
}

function StockAlertRow({ item }: Readonly<{ item: StockAlert }>) {
  const isCritical = item.currentStock < item.minStock;
  const isWarning = !isCritical && item.currentStock < item.reorderPoint;
  return (
    <tr className={stockAlertRowClass(isCritical, isWarning)}>
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-2">
          {isCritical && <span className="flex h-2 w-2 rounded-full bg-red-500" />}
          {isWarning && <span className="flex h-2 w-2 rounded-full bg-amber-500" />}
          <span className="font-medium">{item.name}</span>
        </div>
      </td>
      <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs">{item.sku}</td>
      <td className={stockAlertStockClass(isCritical, isWarning)}>{item.currentStock}</td>
      <td className="py-2.5 text-right text-muted-foreground">{item.reorderPoint}</td>
    </tr>
  );
}

// ── Quantity cell with directional arrow ───────────────────────────
function QuantityCell({ type, quantity }: Readonly<{ type: string; quantity: number }>) {
  let arrow: React.ReactNode = null;
  if (type === 'IN') arrow = <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />;
  else if (type === 'OUT') arrow = <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />;
  return (
    <span className="flex items-center justify-end gap-1">
      {arrow}
      {quantity}
    </span>
  );
}

// ── Generic activity table ─────────────────────────────────────────
interface ActivityColumn {
  header: string;
  className?: string;
  render: (row: any) => ReactNode;
}

function ActivityTable({ rows, columns, emptyMessage }: Readonly<{
  rows: any[] | undefined;
  columns: ActivityColumn[];
  emptyMessage: string;
}>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {columns.map((col) => (
              <th key={col.header} className={`pb-2 pr-4 font-medium ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows?.length ? (
            rows.map((row, idx) => (
              <tr key={row.id ?? idx} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                {columns.map((col) => (
                  <td key={col.header} className={`py-2.5 pr-4 ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Movement type badge ────────────────────────────────────────────
function MovementTypeBadge({ type }: Readonly<{ type: string }>) {
  const styles: Record<string, string> = {
    IN: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    OUT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    ADJUSTMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    TRANSFER: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    RETURN: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] || styles.ADJUSTMENT}`}>
      {type}
    </span>
  );
}

// ── Main Dashboard Page ────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data),
  });

  const { data: activity, isLoading: activityLoading } = useQuery<RecentActivity>({
    queryKey: ['dashboard-activity'],
    queryFn: () => api.get('/dashboard/recent-activity').then((r) => r.data),
  });

  const { data: procurement, isLoading: procurementLoading } = useQuery<ProcurementMonth[]>({
    queryKey: ['dashboard-procurement'],
    queryFn: () => api.get('/dashboard/charts/procurement').then((r) => r.data),
  });

  const { data: stockAlerts, isLoading: stockAlertsLoading } = useQuery<StockAlert[]>({
    queryKey: ['dashboard-stock-alerts'],
    queryFn: () => api.get('/dashboard/charts/stock-alerts').then((r) => r.data),
  });

  // ── Stat card config ───────────────────────────────────────────
  const makeTrend = (val: number | null | undefined) =>
    val !== null && val !== undefined ? { value: val, label: 'vs last month' } : undefined;

  const statCards = [
    { title: 'Total Vendors', value: stats?.totalVendors ?? 0, icon: <Building2 className="h-5 w-5" />, trend: makeTrend(stats?.vendorsTrend), className: 'border-l-4 border-l-blue-500' },
    { title: 'Total Products', value: stats?.totalProducts ?? 0, icon: <Package className="h-5 w-5" />, trend: makeTrend(stats?.productsTrend), className: 'border-l-4 border-l-indigo-500' },
    { title: 'Purchase Requests', value: stats?.purchaseRequests ?? 0, icon: <FileText className="h-5 w-5" />, trend: makeTrend(stats?.prTrend), className: 'border-l-4 border-l-violet-500' },
    { title: 'Purchase Orders', value: stats?.purchaseOrders ?? 0, icon: <ShoppingCart className="h-5 w-5" />, trend: makeTrend(stats?.poTrend), className: 'border-l-4 border-l-emerald-500' },
    { title: 'Low Stock Items', value: stats?.lowStockItems ?? 0, icon: <AlertTriangle className="h-5 w-5" />, className: 'border-l-4 border-l-amber-500' },
    { title: 'Pending Approvals', value: stats?.pendingApprovals ?? 0, icon: <Clock className="h-5 w-5" />, className: 'border-l-4 border-l-rose-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.firstName || 'User'}`}
      />

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statsLoading
          ? ['s1', 's2', 's3', 's4', 's5', 's6'].map((key) => <StatCardSkeleton key={key} />)
          : statCards.map((card) => (
              <StatCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                trend={card.trend}
                className={card.className}
              />
            ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Procurement Trend Bar Chart */}
        {procurementLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Procurement Trend
              </CardTitle>
              <p className="text-sm text-muted-foreground">Monthly purchase order amounts (last 6 months)</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {procurement && procurement.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={procurement} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        className="text-muted-foreground"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="amount"
                        fill="hsl(213 54% 24%)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No procurement data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock Alerts */}
        {stockAlertsLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Stock Alerts
              </CardTitle>
              <p className="text-sm text-muted-foreground">Products below or near reorder point</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] overflow-auto">
                {stockAlerts && stockAlerts.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Product</th>
                        <th className="pb-2 pr-4 font-medium">SKU</th>
                        <th className="pb-2 pr-4 font-medium text-right">Current</th>
                        <th className="pb-2 font-medium text-right">Reorder Pt.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockAlerts.map((item) => <StockAlertRow key={item.id} item={item} />)}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No stock alerts - all products are well stocked
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <TableSkeleton rows={5} />
          ) : (
            <Tabs defaultValue="stock-movements" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="stock-movements">Stock Movements</TabsTrigger>
                <TabsTrigger value="purchase-requests">Purchase Requests</TabsTrigger>
                <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
              </TabsList>

              {/* Stock Movements Tab */}
              <TabsContent value="stock-movements">
                <ActivityTable
                  rows={activity?.stockMovements}
                  emptyMessage="No recent stock movements"
                  columns={[
                    { header: 'Reference', render: (sm) => <span className="font-mono text-xs">{sm.reference}</span> },
                    { header: 'Product', render: (sm) => <span className="font-medium">{sm.productName}</span> },
                    { header: 'Type', render: (sm) => <MovementTypeBadge type={sm.type} /> },
                    { header: 'Quantity', className: 'text-right', render: (sm) => <span className="font-semibold"><QuantityCell type={sm.type} quantity={sm.quantity} /></span> },
                    { header: 'Date', className: 'text-right', render: (sm) => <span className="text-muted-foreground">{formatDate(sm.createdAt)}</span> },
                  ]}
                />
              </TabsContent>

              {/* Purchase Requests Tab */}
              <TabsContent value="purchase-requests">
                <ActivityTable
                  rows={activity?.purchaseRequests}
                  emptyMessage="No recent purchase requests"
                  columns={[
                    { header: 'PR Number', render: (pr) => <span className="font-mono text-xs font-semibold">{pr.prNumber}</span> },
                    { header: 'Title', render: (pr) => <span className="font-medium">{pr.title}</span> },
                    { header: 'Status', render: (pr) => <StatusBadge status={pr.status} /> },
                    { header: 'Amount', className: 'text-right', render: (pr) => <span className="font-semibold">{formatCurrency(pr.totalAmount)}</span> },
                    { header: 'Date', className: 'text-right', render: (pr) => <span className="text-muted-foreground">{formatDate(pr.createdAt)}</span> },
                  ]}
                />
              </TabsContent>

              {/* Purchase Orders Tab */}
              <TabsContent value="purchase-orders">
                <ActivityTable
                  rows={activity?.purchaseOrders}
                  emptyMessage="No recent purchase orders"
                  columns={[
                    { header: 'PO Number', render: (po) => <span className="font-mono text-xs font-semibold">{po.poNumber}</span> },
                    { header: 'Vendor', render: (po) => <span className="font-medium">{po.vendorName}</span> },
                    { header: 'Status', render: (po) => <StatusBadge status={po.status} /> },
                    { header: 'Amount', className: 'text-right', render: (po) => <span className="font-semibold">{formatCurrency(po.totalAmount)}</span> },
                    { header: 'Date', className: 'text-right', render: (po) => <span className="text-muted-foreground">{formatDate(po.createdAt)}</span> },
                  ]}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
