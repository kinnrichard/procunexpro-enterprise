'use client';

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

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 w-full animate-pulse rounded bg-muted/50" />
      ))}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
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

// ── Movement type badge ────────────────────────────────────────────
function MovementTypeBadge({ type }: { type: string }) {
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
  const statCards = [
    {
      title: 'Total Vendors',
      value: stats?.totalVendors ?? 0,
      icon: <Building2 className="h-5 w-5" />,
      trend: stats?.vendorsTrend != null ? { value: stats.vendorsTrend, label: 'vs last month' } : undefined,
      className: 'border-l-4 border-l-blue-500',
    },
    {
      title: 'Total Products',
      value: stats?.totalProducts ?? 0,
      icon: <Package className="h-5 w-5" />,
      trend: stats?.productsTrend != null ? { value: stats.productsTrend, label: 'vs last month' } : undefined,
      className: 'border-l-4 border-l-indigo-500',
    },
    {
      title: 'Purchase Requests',
      value: stats?.purchaseRequests ?? 0,
      icon: <FileText className="h-5 w-5" />,
      trend: stats?.prTrend != null ? { value: stats.prTrend, label: 'vs last month' } : undefined,
      className: 'border-l-4 border-l-violet-500',
    },
    {
      title: 'Purchase Orders',
      value: stats?.purchaseOrders ?? 0,
      icon: <ShoppingCart className="h-5 w-5" />,
      trend: stats?.poTrend != null ? { value: stats.poTrend, label: 'vs last month' } : undefined,
      className: 'border-l-4 border-l-emerald-500',
    },
    {
      title: 'Low Stock Items',
      value: stats?.lowStockItems ?? 0,
      icon: <AlertTriangle className="h-5 w-5" />,
      className: 'border-l-4 border-l-amber-500',
    },
    {
      title: 'Pending Approvals',
      value: stats?.pendingApprovals ?? 0,
      icon: <Clock className="h-5 w-5" />,
      className: 'border-l-4 border-l-rose-500',
    },
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
          ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
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
                      {stockAlerts.map((item) => {
                        const isCritical = item.currentStock < item.minStock;
                        const isWarning = item.currentStock < item.reorderPoint && !isCritical;
                        return (
                          <tr
                            key={item.id}
                            className={`border-b last:border-0 transition-colors ${
                              isCritical
                                ? 'bg-red-50 dark:bg-red-950/20'
                                : isWarning
                                ? 'bg-amber-50 dark:bg-amber-950/20'
                                : ''
                            }`}
                          >
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                {isCritical && (
                                  <span className="flex h-2 w-2 rounded-full bg-red-500" />
                                )}
                                {isWarning && !isCritical && (
                                  <span className="flex h-2 w-2 rounded-full bg-amber-500" />
                                )}
                                <span className="font-medium">{item.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs">
                              {item.sku}
                            </td>
                            <td className={`py-2.5 pr-4 text-right font-semibold ${
                              isCritical ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : ''
                            }`}>
                              {item.currentStock}
                            </td>
                            <td className="py-2.5 text-right text-muted-foreground">
                              {item.reorderPoint}
                            </td>
                          </tr>
                        );
                      })}
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Reference</th>
                        <th className="pb-2 pr-4 font-medium">Product</th>
                        <th className="pb-2 pr-4 font-medium">Type</th>
                        <th className="pb-2 pr-4 font-medium text-right">Quantity</th>
                        <th className="pb-2 font-medium text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity?.stockMovements?.length ? (
                        activity.stockMovements.map((sm) => (
                          <tr key={sm.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="py-2.5 pr-4 font-mono text-xs">{sm.reference}</td>
                            <td className="py-2.5 pr-4 font-medium">{sm.productName}</td>
                            <td className="py-2.5 pr-4">
                              <MovementTypeBadge type={sm.type} />
                            </td>
                            <td className="py-2.5 pr-4 text-right font-semibold">
                              <span className="flex items-center justify-end gap-1">
                                {sm.type === 'IN' ? (
                                  <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                                ) : sm.type === 'OUT' ? (
                                  <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
                                ) : null}
                                {sm.quantity}
                              </span>
                            </td>
                            <td className="py-2.5 text-right text-muted-foreground">
                              {formatDate(sm.createdAt)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            No recent stock movements
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* Purchase Requests Tab */}
              <TabsContent value="purchase-requests">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">PR Number</th>
                        <th className="pb-2 pr-4 font-medium">Title</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                        <th className="pb-2 font-medium text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity?.purchaseRequests?.length ? (
                        activity.purchaseRequests.map((pr) => (
                          <tr key={pr.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="py-2.5 pr-4 font-mono text-xs font-semibold">{pr.prNumber}</td>
                            <td className="py-2.5 pr-4 font-medium">{pr.title}</td>
                            <td className="py-2.5 pr-4">
                              <StatusBadge status={pr.status} />
                            </td>
                            <td className="py-2.5 pr-4 text-right font-semibold">
                              {formatCurrency(pr.totalAmount)}
                            </td>
                            <td className="py-2.5 text-right text-muted-foreground">
                              {formatDate(pr.createdAt)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            No recent purchase requests
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* Purchase Orders Tab */}
              <TabsContent value="purchase-orders">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">PO Number</th>
                        <th className="pb-2 pr-4 font-medium">Vendor</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                        <th className="pb-2 font-medium text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity?.purchaseOrders?.length ? (
                        activity.purchaseOrders.map((po) => (
                          <tr key={po.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="py-2.5 pr-4 font-mono text-xs font-semibold">{po.poNumber}</td>
                            <td className="py-2.5 pr-4 font-medium">{po.vendorName}</td>
                            <td className="py-2.5 pr-4">
                              <StatusBadge status={po.status} />
                            </td>
                            <td className="py-2.5 pr-4 text-right font-semibold">
                              {formatCurrency(po.totalAmount)}
                            </td>
                            <td className="py-2.5 text-right text-muted-foreground">
                              {formatDate(po.createdAt)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            No recent purchase orders
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
