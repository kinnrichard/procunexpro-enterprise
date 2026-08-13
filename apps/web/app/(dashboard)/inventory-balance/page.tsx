'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Scale, AlertTriangle, Coins, Package } from 'lucide-react';

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

  const columns = [
    { key: 'name', label: 'Product', render: (_: any, row: any) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground font-mono">{row.sku}</p></div> },
    { key: 'category', label: 'Category', render: (v: string) => v || <span className="text-muted-foreground">—</span> },
    { key: 'onHand', label: 'On-hand', render: (v: number, row: any) => (
      <div className="flex items-center gap-1.5">
        <span className={cn('font-mono font-semibold', row.lowStock ? 'text-red-600' : 'text-foreground')}>{v}</span>
        <span className="text-xs text-muted-foreground">{row.unit}</span>
        {row.lowStock && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
      </div>
    ) },
    { key: 'warehouses', label: 'By location', render: (v: Array<{ warehouse: string; quantity: number }>) => v.length
      ? <div className="flex flex-wrap gap-1">{v.map((w) => <span key={w.warehouse} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs"><span className="text-muted-foreground">{w.warehouse}:</span> <span className="font-medium">{w.quantity}</span></span>)}</div>
      : <span className="text-xs text-muted-foreground">—</span> },
    { key: 'unitCost', label: 'Unit Cost', render: (v: number) => formatCurrency(v) },
    { key: 'stockValue', label: 'Stock Value', render: (v: number) => <span className="font-medium tabular-nums">{formatCurrency(v)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Balance" description="Current on-hand quantity and value per product, with per-location breakdown" />

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
        searchPlaceholder="Search products..."
        isLoading={isLoading}
        emptyMessage="No products found"
        toolbar={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-48"><SearchableSelect options={warehouses} value={warehouseId} onChange={(v) => { setWarehouseId(v); setPage(1); }} placeholder="All warehouses" /></div>
            <button onClick={() => { setLowStock(!lowStock); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5', lowStock ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
              <Scale className="h-3.5 w-3.5" /> Low stock only
            </button>
          </div>
        }
      />
    </div>
  );
}
