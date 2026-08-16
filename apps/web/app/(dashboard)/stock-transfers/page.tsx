'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { LocationSelect } from '@/components/location-select';
import { AreaSelect } from '@/components/area-select';
import { DatePicker } from '@/components/ui/date-picker';
import { FilterPopover, FilterField } from '@/components/filter-popover';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/lib/permissions';
import { ArrowLeftRight, Plus, Trash2, MoveRight } from 'lucide-react';

interface Row { productId: string; quantity: number; }

export default function StockTransfersPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [fromArea, setFromArea] = useState('');
  const [toArea, setToArea] = useState('');
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  // Advanced filters
  const [filterFromWh, setFilterFromWh] = useState('');
  const [filterToWh, setFilterToWh] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();
  const activeFilterCount = [filterFromWh, filterToWh, filterDateFrom, filterDateTo].filter(Boolean).length;
  const toDateStr = (d?: Date) => (d ? d.toISOString().split('T')[0] : '');
  function clearFilters() {
    setFilterFromWh(''); setFilterToWh('');
    setFilterDateFrom(undefined); setFilterDateTo(undefined);
    setPage(1);
  }

  const { data: response, isLoading } = useQuery({
    queryKey: ['stock-transfers', page, search, filterFromWh, filterToWh, filterDateFrom, filterDateTo],
    queryFn: () => api.get('/stock-transfers', { params: {
      page, limit: 10, search,
      ...(filterFromWh && { fromWarehouseId: filterFromWh }),
      ...(filterToWh && { toWarehouseId: filterToWh }),
      ...(filterDateFrom && { dateFrom: toDateStr(filterDateFrom) }),
      ...(filterDateTo && { dateTo: toDateStr(filterDateTo) }),
    } }),
  });
  const { data: prodData } = useQuery({ queryKey: ['products-all'], queryFn: () => api.get('/products', { params: { limit: 1000 } }) });
  const { data: whData } = useQuery({ queryKey: ['warehouses-all'], queryFn: () => api.get('/warehouses', { params: { limit: 1000 } }) });

  // Available stock at the SOURCE (warehouse + optional area/location), summed per item from lots
  const { data: srcStockData, isFetching: srcLoading } = useQuery({
    queryKey: ['transfer-src-stock', fromWh, fromArea, fromLoc],
    queryFn: () => api.get('/stock-lots', { params: { warehouseId: fromWh, status: 'AVAILABLE', limit: 1000, ...(fromArea && { areaId: fromArea }), ...(fromLoc && { locationId: fromLoc }) } }),
    enabled: !!fromWh,
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const productList: any[] = prodData?.data?.data || [];
  const products = productList.map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  const warehouses = (whData?.data?.data || []).map((w: any) => ({ value: w.id, label: w.name }));
  const usedIds = new Set(rows.map((r) => r.productId).filter(Boolean));

  const stockByProduct = new Map<string, number>();
  for (const l of (srcStockData?.data?.data || [])) stockByProduct.set(l.productId, (stockByProduct.get(l.productId) || 0) + (l.quantity || 0));
  const availableFor = (pid: string) => Math.round((stockByProduct.get(pid) || 0) * 1e6) / 1e6;
  const unitFor = (pid: string) => productList.find((p) => p.id === pid)?.unit || '';
  const overStockRow = !srcLoading && rows.some((r) => r.productId && r.quantity > availableFor(r.productId));

  const addRow = () => setRows((r) => [...r, { productId: '', quantity: 1 }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const saveMut = useMutation({
    mutationFn: () => api.post('/stock-transfers', { fromWarehouseId: fromWh, toWarehouseId: toWh, fromAreaId: fromArea || undefined, toAreaId: toArea || undefined, fromLocationId: fromLoc || undefined, toLocationId: toLoc || undefined, notes: notes || undefined, items: rows.filter((r) => r.productId && r.quantity > 0) }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-lots'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      setModalOpen(false);
      toast({ title: `Transfer ${res?.data?.transferNumber || ''} posted` });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to transfer', variant: 'destructive' }),
  });

  const openCreate = () => { setFromWh(''); setToWh(''); setFromArea(''); setToArea(''); setFromLoc(''); setToLoc(''); setNotes(''); setRows([{ productId: '', quantity: 1 }]); setModalOpen(true); };

  const columns = [
    { key: 'transferNumber', label: 'Transfer #', render: (v: string) => <span className="font-mono text-sm font-medium">{v}</span> },
    { key: 'fromWarehouse', label: 'From → To', render: (_: any, row: any) => <span className="flex items-center gap-1.5">{row.fromWarehouse?.name} <MoveRight className="h-3.5 w-3.5 text-muted-foreground" /> {row.toWarehouse?.name}</span> },
    { key: '_count', label: 'Items', className: 'text-center', render: (v: any) => <span className="font-mono text-sm">{v?.items ?? 0}</span> },
    { key: 'transferDate', label: 'Date', render: (v: string) => formatDate(v) },
  ];

  const canSave = !!fromWh && !!toWh && fromWh !== toWh && rows.some((r) => r.productId && r.quantity > 0) && !overStockRow;

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Transfers" description="Move stock between warehouse locations">
        {can('stock-transfers', 'create') && (
          <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90"><Plus className="h-4 w-4 mr-2" /> New Transfer</Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Transfers" value={total} icon={<ArrowLeftRight className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={page}
        limit={10}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search transfers..."
        isLoading={isLoading}
        emptyMessage="No transfers yet"
        toolbar={
          <div className="flex items-center gap-3 flex-wrap">
            <FilterPopover activeCount={activeFilterCount} onClear={clearFilters}>
              <FilterField label="Transfer Date">
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker value={filterDateFrom} onChange={(d) => { setFilterDateFrom(d); setPage(1); }} placeholder="From" className="text-xs" />
                  <DatePicker value={filterDateTo} onChange={(d) => { setFilterDateTo(d); setPage(1); }} placeholder="To" className="text-xs" />
                </div>
              </FilterField>
              <FilterField label="From Warehouse">
                <SearchableSelect options={warehouses} value={filterFromWh} onChange={(v) => { setFilterFromWh(v); setPage(1); }} placeholder="All warehouses" />
              </FilterField>
              <FilterField label="To Warehouse">
                <SearchableSelect options={warehouses} value={filterToWh} onChange={(v) => { setFilterToWh(v); setPage(1); }} placeholder="All warehouses" />
              </FilterField>
            </FilterPopover>
          </div>
        }
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>New Stock Transfer</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">From Warehouse <span className="text-red-500">*</span></Label>
                <SearchableSelect options={warehouses} value={fromWh} onChange={(v) => { setFromWh(v); setFromArea(''); setFromLoc(''); }} placeholder="Source" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">To Warehouse <span className="text-red-500">*</span></Label>
                <SearchableSelect options={warehouses.filter((w: any) => w.value !== fromWh)} value={toWh} onChange={(v) => { setToWh(v); setToArea(''); setToLoc(''); }} placeholder="Destination" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">From Area</Label>
                <AreaSelect warehouseId={fromWh} value={fromArea} onChange={(v) => { setFromArea(v); setFromLoc(''); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">To Area</Label>
                <AreaSelect warehouseId={toWh} value={toArea} onChange={(v) => { setToArea(v); setToLoc(''); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">From Location</Label>
                <LocationSelect warehouseId={fromWh} areaId={fromArea} value={fromLoc} onChange={setFromLoc} placeholder="Any location" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">To Location</Label>
                <LocationSelect warehouseId={toWh} areaId={toArea} value={toLoc} onChange={setToLoc} placeholder="Any location" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">Items</Label>
              {rows.map((row, i) => {
                const avail = availableFor(row.productId);
                const over = !!row.productId && !!fromWh && !srcLoading && row.quantity > avail;
                return (
                  <div key={i} className="space-y-1">
                    <div className="grid grid-cols-[1fr_110px_40px] gap-2 items-center">
                      <SearchableSelect options={products.filter((o: any) => o.value === row.productId || !usedIds.has(o.value))} value={row.productId} onChange={(v) => updateRow(i, { productId: v })} placeholder="Select item" />
                      <Input type="number" step="any" value={row.quantity || ''} placeholder="0" onChange={(e) => updateRow(i, { quantity: Number.parseFloat(e.target.value) || 0 })} className={cn('h-9 rounded-lg text-right', over && 'border-red-300 focus-visible:ring-red-200')} />
                      {rows.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:text-red-700" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                    {row.productId && fromWh && (
                      <p className={cn('text-xs pl-1', over ? 'text-red-500' : 'text-muted-foreground')}>
                        {over ? `Exceeds available (${avail} ${unitFor(row.productId)})` : `Available at source: ${avail} ${unitFor(row.productId)}`}
                      </p>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1.5" /> Add item</Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-lg" rows={2} />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => saveMut.mutate()} className="bg-gradient-primary text-white" disabled={!canSave || saveMut.isPending}>
              {saveMut.isPending ? 'Posting…' : 'Post Transfer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
