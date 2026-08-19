'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import {
  Building2, Package, FileText, ShoppingCart, AlertTriangle, Clock,
  Coins, Boxes, Factory, Truck, FileQuestion, Users, CalendarClock,
  ArrowUpRight, ArrowDownRight, Plus,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { useAuthStore } from '@/lib/auth';

// Palette for categorical charts.
const PALETTE = ['#1e3a5f', '#2563eb', '#0ea5e9', '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899'];

const IN_TYPES = new Set(['PURCHASE', 'TRANSFER_IN', 'RETURN', 'PRODUCTION_IN']);

// Icon + accent per KPI type.
const KPI_META: Record<string, { icon: ReactNode; accent: string; href?: string }> = {
  'kpi-total-items': { icon: <Package className="h-5 w-5" />, accent: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400', href: '/products' },
  'kpi-inventory-skus': { icon: <Boxes className="h-5 w-5" />, accent: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400', href: '/inventory-balance' },
  'kpi-total-vendors': { icon: <Building2 className="h-5 w-5" />, accent: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400', href: '/vendors' },
  'kpi-total-prs': { icon: <FileText className="h-5 w-5" />, accent: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400', href: '/purchase-requests' },
  'kpi-total-pos': { icon: <ShoppingCart className="h-5 w-5" />, accent: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400', href: '/purchase-orders' },
  'kpi-pending-approvals': { icon: <Clock className="h-5 w-5" />, accent: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400', href: '/purchase-requests' },
  'kpi-low-stock': { icon: <AlertTriangle className="h-5 w-5" />, accent: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400', href: '/replenishment' },
  'kpi-inventory-value': { icon: <Coins className="h-5 w-5" />, accent: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400', href: '/inventory-balance' },
  'kpi-open-rfqs': { icon: <FileQuestion className="h-5 w-5" />, accent: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400', href: '/rfq' },
  'kpi-pending-deliveries': { icon: <Truck className="h-5 w-5" />, accent: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400', href: '/deliveries' },
  'kpi-active-productions': { icon: <Factory className="h-5 w-5" />, accent: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/40 dark:text-fuchsia-400', href: '/productions' },
  'kpi-expiring-lots': { icon: <CalendarClock className="h-5 w-5" />, accent: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400', href: '/stock-lots' },
  'kpi-active-customers': { icon: <Users className="h-5 w-5" />, accent: 'bg-lime-50 text-lime-600 dark:bg-lime-950/40 dark:text-lime-400', href: '/customers' },
};

function EmptyState({ message }: Readonly<{ message: string }>) {
  return <div className="flex h-full min-h-[80px] items-center justify-center text-sm text-muted-foreground">{message}</div>;
}

// ── KPI ──────────────────────────────────────────────────────────────
function KpiView({ type, title, data }: Readonly<{ type: string; title: string; data: any }>) {
  const meta = KPI_META[type] ?? { icon: <Package className="h-5 w-5" />, accent: 'bg-muted text-foreground' };
  const value = data?.format === 'currency' ? formatCurrency(data?.value ?? 0) : (data?.value ?? 0).toLocaleString();
  const inner = (
    <div className="flex h-full flex-col justify-between p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', meta.accent)}>{meta.icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
  return meta.href
    ? <Link href={meta.href} className="block h-full transition-colors hover:bg-muted/30">{inner}</Link>
    : inner;
}

// ── Chart tooltips ───────────────────────────────────────────────────
function MoneyTooltip({ active, payload, label }: Readonly<any>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      {label && <p className="mb-1 text-xs font-medium text-foreground">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="text-sm text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }: Readonly<any>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      {label && <p className="mb-1 text-xs font-medium text-foreground">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="text-sm text-muted-foreground">{p.name}: <span className="font-semibold text-foreground">{p.value}</span></p>
      ))}
    </div>
  );
}

function AreaSpendView({ data }: Readonly<{ data: any }>) {
  const series = data?.series ?? [];
  if (!series.length) return <EmptyState message="No procurement data yet" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="wSpendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(213 54% 24%)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(213 54% 24%)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<MoneyTooltip />} />
        <Area type="monotone" dataKey="total" name="Spend" stroke="hsl(213 54% 24%)" strokeWidth={2.5} fill="url(#wSpendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function BarValueView({ data, money = true }: Readonly<{ data: any; money?: boolean }>) {
  const series = data?.series ?? [];
  if (!series.length) return <EmptyState message="No data yet" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => money ? `${(v / 1000).toFixed(0)}k` : v} />
        <Tooltip content={money ? <MoneyTooltip /> : <CountTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
        <Bar dataKey="value" name={money ? 'Value' : 'Count'} radius={[4, 4, 0, 0]}>
          {series.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieValueView({ data, money = true }: Readonly<{ data: any; money?: boolean }>) {
  const series = data?.series ?? [];
  if (!series.length) return <EmptyState message="No data yet" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={series} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
          {series.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip content={money ? <MoneyTooltip /> : <CountTooltip />} />
        <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function MovementsTrendView({ data }: Readonly<{ data: any }>) {
  const series = data?.series ?? [];
  if (!series.length) return <EmptyState message="No movements yet" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<CountTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="inbound" name="Inbound" stroke="#10b981" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="outbound" name="Outbound" stroke="#ef4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Generic table ────────────────────────────────────────────────────
interface Col { header: string; className?: string; render: (row: any) => ReactNode }
function DataTableView({ rows, columns, emptyMessage }: Readonly<{ rows: any[] | undefined; columns: Col[]; emptyMessage: string }>) {
  if (!rows?.length) return <EmptyState message={emptyMessage} />;
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            {columns.map((c) => <th key={c.header} className={cn('pb-2 pr-4 font-medium', c.className)}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b last:border-0 hover:bg-muted/40">
              {columns.map((c) => <td key={c.header} className={cn('py-2 pr-4', c.className)}>{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoveBadge({ type }: Readonly<{ type: string }>) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium">
      {IN_TYPES.has(type) ? <ArrowUpRight className="h-3 w-3 text-green-600" /> : <ArrowDownRight className="h-3 w-3 text-red-600" />}
      {type.replaceAll('_', ' ')}
    </span>
  );
}

// ── Utility widgets ──────────────────────────────────────────────────
function WelcomeView({ data }: Readonly<{ data: any }>) {
  const { user } = useAuthStore();
  return (
    <div className="relative flex h-full items-center justify-between overflow-hidden rounded-lg bg-gradient-to-br from-slate-800 via-slate-800 to-[#1e3a5f] px-6 text-white">
      <div>
        <h2 className="text-xl font-semibold">Welcome back, {user?.firstName || 'there'}</h2>
        <p className="mt-1 text-sm text-white/70">Live overview of procurement, inventory and production{user?.companyName ? ` for ${user.companyName}` : ''}.</p>
      </div>
      <div className="rounded-xl bg-white/10 px-5 py-3 backdrop-blur">
        <p className="flex items-center gap-1.5 text-xs text-white/60"><Coins className="h-3.5 w-3.5" /> Total inventory value</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(data?.totalValue ?? 0)}</p>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: 'New Item', href: '/products' },
  { label: 'New PR', href: '/purchase-requests' },
  { label: 'New PO', href: '/purchase-orders' },
  { label: 'New Vendor', href: '/vendors' },
  { label: 'New Delivery', href: '/deliveries' },
  { label: 'New Production', href: '/productions' },
];
function QuickActionsView() {
  return (
    <div className="flex h-full flex-wrap content-start gap-2 p-4">
      {QUICK_ACTIONS.map((a) => (
        <Link key={a.href} href={a.href} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
          <Plus className="h-4 w-4 text-primary" /> {a.label}
        </Link>
      ))}
    </div>
  );
}

function NotesView({ config }: Readonly<{ config: any }>) {
  const text = config?.text?.trim();
  return (
    <div className="h-full overflow-auto whitespace-pre-wrap p-4 text-sm text-muted-foreground">
      {text || 'Double-click the gear to add a note…'}
    </div>
  );
}

// ── Dispatcher ───────────────────────────────────────────────────────
export function WidgetView({ type, title, config, data }: Readonly<{ type: string; title: string; config: any; data: any }>) {
  if (type.startsWith('kpi-')) return <KpiView type={type} title={title} data={data} />;

  switch (type) {
    case 'chart-procurement-spend': return <AreaSpendView data={data} />;
    case 'chart-pr-status': return <PieValueView data={data} money={false} />;
    case 'chart-po-status': return <PieValueView data={data} money={false} />;
    case 'chart-inventory-by-category': return <PieValueView data={data} money />;
    case 'chart-stock-by-warehouse': return <BarValueView data={data} money />;
    case 'chart-top-vendors': return <BarValueView data={data} money />;
    case 'chart-movements-trend': return <MovementsTrendView data={data} />;

    case 'list-stock-alerts':
      return <DataTableView rows={data?.rows} emptyMessage="All items well stocked" columns={[
        { header: 'Item', render: (r) => <span className="font-medium">{r.name}</span> },
        { header: 'On-hand', className: 'text-right', render: (r) => <span className="font-mono font-semibold text-amber-600">{r.currentStock}</span> },
        { header: 'Reorder', className: 'text-right', render: (r) => <span className="font-mono text-muted-foreground">{r.reorderPoint}</span> },
      ]} />;
    case 'list-recent-movements':
      return <DataTableView rows={data?.rows} emptyMessage="No recent movements" columns={[
        { header: 'Ref', render: (r) => <span className="font-mono text-xs">{r.referenceNumber}</span> },
        { header: 'Item', render: (r) => <span className="font-medium">{r.product?.name || '—'}</span> },
        { header: 'Type', render: (r) => <MoveBadge type={r.type} /> },
        { header: 'Qty', className: 'text-right', render: (r) => <span className={cn('font-mono font-semibold', IN_TYPES.has(r.type) ? 'text-green-600' : 'text-red-600')}>{IN_TYPES.has(r.type) ? '+' : '-'}{r.quantity}</span> },
      ]} />;
    case 'list-recent-prs':
      return <DataTableView rows={data?.rows} emptyMessage="No recent purchase requests" columns={[
        { header: 'PR #', render: (r) => <span className="font-mono text-xs font-semibold">{r.requestNumber}</span> },
        { header: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { header: 'Amount', className: 'text-right', render: (r) => <span className="font-mono">{formatCurrency(r.totalAmount)}</span> },
      ]} />;
    case 'list-recent-pos':
      return <DataTableView rows={data?.rows} emptyMessage="No recent purchase orders" columns={[
        { header: 'PO #', render: (r) => <span className="font-mono text-xs font-semibold">{r.orderNumber}</span> },
        { header: 'Vendor', render: (r) => <span className="font-medium">{r.vendor?.name || '—'}</span> },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { header: 'Amount', className: 'text-right', render: (r) => <span className="font-mono">{formatCurrency(r.totalAmount)}</span> },
      ]} />;
    case 'list-pending-approvals':
      return <DataTableView rows={data?.rows} emptyMessage="Nothing awaiting approval" columns={[
        { header: 'Type', render: (r) => <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{r.kind}</span> },
        { header: 'Reference', render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
        { header: 'Detail', render: (r) => <span className="font-medium">{r.title}</span> },
        { header: 'Amount', className: 'text-right', render: (r) => <span className="font-mono">{formatCurrency(r.amount)}</span> },
      ]} />;
    case 'list-expiring-lots':
      return <DataTableView rows={data?.rows} emptyMessage="No lots expiring soon" columns={[
        { header: 'Lot', render: (r) => <span className="font-mono text-xs">{r.lotNumber}</span> },
        { header: 'Item', render: (r) => <span className="font-medium">{r.product?.name || '—'}</span> },
        { header: 'Qty', className: 'text-right', render: (r) => <span className="font-mono">{r.quantity}</span> },
        { header: 'Expires', className: 'text-right', render: (r) => <span className="text-red-600">{r.expiryDate ? formatDate(r.expiryDate) : '—'}</span> },
      ]} />;
    case 'list-recent-rfqs':
      return <DataTableView rows={data?.rows} emptyMessage="No recent RFQs" columns={[
        { header: 'RFQ #', render: (r) => <span className="font-mono text-xs font-semibold">{r.rfqNumber}</span> },
        { header: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
        { header: 'Vendor', render: (r) => <span>{r.vendor?.name || '—'}</span> },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]} />;
    case 'list-recent-deliveries':
      return <DataTableView rows={data?.rows} emptyMessage="No recent deliveries" columns={[
        { header: 'DR #', render: (r) => <span className="font-mono text-xs font-semibold">{r.drNumber}</span> },
        { header: 'Customer', render: (r) => <span className="font-medium">{r.customer?.name || '—'}</span> },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { header: 'Date', className: 'text-right', render: (r) => <span className="text-muted-foreground">{formatDate(r.deliveryDate)}</span> },
      ]} />;

    case 'util-welcome': return <WelcomeView data={data} />;
    case 'util-quick-actions': return <QuickActionsView />;
    case 'util-notes': return <NotesView config={config} />;

    default: return <EmptyState message="Unknown widget" />;
  }
}
