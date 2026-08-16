'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { FilterPopover, FilterField } from '@/components/filter-popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Coins, Package, ArrowDownRight, ArrowUpRight } from 'lucide-react';

const IN_TYPES = new Set(['PURCHASE', 'TRANSFER_IN', 'RETURN', 'PRODUCTION_IN']);

const typeColors: Record<string, string> = {
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

// ─── Receive / Release Tab (stock movements by direction) ───
function MovementsPanel({ direction }: Readonly<{ direction: 'in' | 'out' }>) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['inv-movements', direction, page, search],
    queryFn: () => api.get('/stock-movements', { params: { direction, page, limit: 15, search } }),
  });
  const rows = data?.data?.data || [];
  const total = data?.data?.total || 0;

  const columns = [
    { key: 'referenceNumber', label: 'Reference', render: (v: string) => <span className="font-mono text-sm font-medium">{v}</span> },
    { key: 'product', label: 'Item', render: (_: any, row: any) => <div><p className="font-medium">{row.product?.name || '—'}</p><p className="text-xs text-muted-foreground font-mono">{row.product?.sku}</p></div> },
    { key: 'type', label: 'Type', render: (v: string) => (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', typeColors[v])}>
        {IN_TYPES.has(v) ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
        {v.replaceAll('_', ' ')}
      </span>
    ) },
    { key: 'quantity', label: 'Quantity', className: 'text-right', render: (v: number, row: any) => (
      <span className={cn('font-mono font-semibold', IN_TYPES.has(row.type) ? 'text-green-600' : 'text-red-600')}>
        {IN_TYPES.has(row.type) ? '+' : '-'}{v} <span className="text-xs text-muted-foreground font-sans">{row.product?.unit}</span>
      </span>
    ) },
    { key: 'warehouse', label: direction === 'in' ? 'To' : 'From', render: (_: any, row: any) => (direction === 'in' ? row.toWarehouse?.name : row.fromWarehouse?.name) || <span className="text-muted-foreground">—</span> },
    { key: 'createdAt', label: 'Date', render: (v: string) => formatDateTime(v) },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      total={total}
      page={page}
      limit={15}
      onPageChange={setPage}
      onSearch={(s) => { setSearch(s); setPage(1); }}
      searchPlaceholder="Search reference..."
      isLoading={isLoading}
      emptyMessage={direction === 'in' ? 'No received stock yet' : 'No released stock yet'}
    />
  );
}

export default function InventoryBalancePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');

  const { data: response, isLoading } = useQuery({
    queryKey: ['inventory-balance', page, search, lowStock, warehouseId],
    queryFn: () => api.get('/inventory-balance', { params: { page, limit: 15, search, ...(lowStock && { lowStock: true }), ...(warehouseId && { warehouseId }) } }),
  });
  const { data: summaryRes } = useQuery({ queryKey: ['inventory-balance-summary'], queryFn: () => api.get('/inventory-balance/summary') });
  const { data: whData } = useQuery({ queryKey: ['warehouses-all'], queryFn: () => api.get('/warehouses', { params: { limit: 1000 } }) });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const summary = summaryRes?.data?.data || { totalSkus: 0, totalValue: 0, lowStock: 0 };
  const warehouses = [{ value: '', label: 'All warehouses' }, ...(whData?.data?.data || []).map((w: any) => ({ value: w.id, label: w.name }))];
  const activeFilterCount = [warehouseId, lowStock].filter(Boolean).length;

  const columns = [
    { key: 'name', label: 'Item', render: (_: any, row: any) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground font-mono">{row.sku}</p></div> },
    { key: 'category', label: 'Category', render: (v: string) => v || <span className="text-muted-foreground">—</span> },
    { key: 'onHand', label: 'On-hand', render: (v: number, row: any) => (
      <div className="flex items-center gap-1.5">
        <span className={cn('font-mono font-semibold', row.lowStock ? 'text-red-600' : 'text-foreground')}>{v}</span>
        <span className="text-xs text-muted-foreground">{row.unit}</span>
        {row.lowStock && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
      </div>
    ) },
    { key: 'warehouses', label: 'By location', render: (v: Array<{ warehouse: string; area: string | null; location: string | null; quantity: number }>) => v.length
      ? <div className="flex flex-wrap gap-1">{v.map((w) => { const path = [w.warehouse, w.area, w.location].filter(Boolean).join(' · '); return <span key={`${w.warehouse}-${w.area ?? ''}-${w.location ?? ''}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs"><span className="text-muted-foreground">{path}:</span> <span className="font-mono font-medium">{w.quantity}</span></span>; })}</div>
      : <span className="text-xs text-muted-foreground">—</span> },
    { key: 'unitCost', label: 'Unit Cost', className: 'text-right', render: (v: number) => <span className="font-mono text-sm">{formatCurrency(v)}</span> },
    { key: 'stockValue', label: 'Stock Value', className: 'text-right', render: (v: number) => <span className="font-mono font-medium">{formatCurrency(v)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Balance" description="Current on-hand quantity and value per product, with per-location breakdown" />

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            All
          </TabsTrigger>
          <TabsTrigger value="receive" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            Receive
          </TabsTrigger>
          <TabsTrigger value="release" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            Release
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-5 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title="Total SKUs" value={summary.totalSkus} icon={<Package className="h-5 w-5" />} />
            <StatCard title="Total Stock Value" value={formatCurrency(summary.totalValue)} icon={<Coins className="h-5 w-5" />} />
            <StatCard title="Low Stock" value={summary.lowStock} icon={<AlertTriangle className="h-5 w-5" />} />
          </div>

          <DataTable
            columns={columns}
            data={items}
            total={total}
            page={page}
            limit={15}
            onPageChange={setPage}
            onSearch={setSearch}
            searchPlaceholder="Search items..."
            isLoading={isLoading}
            emptyMessage="No products found"
            toolbar={
              <div className="flex items-center gap-3 flex-wrap">
                <FilterPopover
                  activeCount={activeFilterCount}
                  onClear={() => { setWarehouseId(''); setLowStock(false); setPage(1); }}
                >
                  <FilterField label="Warehouse">
                    <SearchableSelect options={warehouses} value={warehouseId} onChange={(v) => { setWarehouseId(v); setPage(1); }} placeholder="All warehouses" />
                  </FilterField>
                  <FilterField label="Availability">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} className="h-4 w-4 rounded border-input" /> Low stock only
                    </label>
                  </FilterField>
                </FilterPopover>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="receive" className="mt-5">
          <MovementsPanel direction="in" />
        </TabsContent>

        <TabsContent value="release" className="mt-5">
          <MovementsPanel direction="out" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
