'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { FilterPopover, FilterField } from '@/components/filter-popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { LocationSelect } from '@/components/location-select';
import { AreaSelect } from '@/components/area-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/lib/permissions';
import { ApprovalStatusBadge, ApprovalActions } from '@/components/approval-controls';
import { Send, Plus, Trash2, Link2, XCircle, CheckCircle2 } from 'lucide-react';

interface Row { productId: string; quantity: number; }

const statusColors: Record<string, string> = {
  RELEASED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SIGNED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DRAFT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function DeliveriesPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  // Advanced filters
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterCreatedFrom, setFilterCreatedFrom] = useState<Date | undefined>();
  const [filterCreatedTo, setFilterCreatedTo] = useState<Date | undefined>();
  const activeFilterCount = [filterCustomerId, filterCreatedFrom, filterCreatedTo].filter(Boolean).length;
  const toDateStr = (d?: Date) => (d ? d.toISOString().split('T')[0] : '');
  function clearFilters() {
    setFilterCustomerId('');
    setFilterCreatedFrom(undefined); setFilterCreatedTo(undefined);
    setPage(1);
  }

  const { data: response, isLoading } = useQuery({
    queryKey: ['delivery-receipts', page, search, statusFilter, filterCustomerId, filterCreatedFrom, filterCreatedTo],
    queryFn: () => api.get('/delivery-receipts', { params: {
      page, limit: 10, search,
      ...(statusFilter && { status: statusFilter }),
      ...(filterCustomerId && { customerId: filterCustomerId }),
      ...(filterCreatedFrom && { createdDateFrom: toDateStr(filterCreatedFrom) }),
      ...(filterCreatedTo && { createdDateTo: toDateStr(filterCreatedTo) }),
    } }),
  });
  const { data: custData } = useQuery({ queryKey: ['customers-active'], queryFn: () => api.get('/customers/active') });
  const { data: prodData } = useQuery({ queryKey: ['products-all'], queryFn: () => api.get('/products', { params: { limit: 1000 } }) });
  const { data: whData } = useQuery({ queryKey: ['warehouses-all'], queryFn: () => api.get('/warehouses', { params: { limit: 1000 } }) });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const customers = (custData?.data?.data || []).map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` }));
  // Only finished goods / components make sense to deliver
  const products = (prodData?.data?.data || []).filter((p: any) => ['product', 'component'].includes(p.inventoryType)).map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  const warehouses = (whData?.data?.data || []).map((w: any) => ({ value: w.id, label: w.name }));
  const usedIds = new Set(rows.map((r) => r.productId).filter(Boolean));

  const addRow = () => setRows((r) => [...r, { productId: '', quantity: 1 }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const saveMut = useMutation({
    mutationFn: () => api.post('/delivery-receipts', { customerId, warehouseId: warehouseId || undefined, areaId: areaId || undefined, locationId: locationId || undefined, notes: notes || undefined, items: rows.filter((r) => r.productId && r.quantity > 0) }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast({ title: res?.data?.status === 'RELEASED' ? `Released — ${res?.data?.drNumber || ''}` : `Delivery ${res?.data?.drNumber || ''} submitted for approval` });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to release', variant: 'destructive' }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.post(`/delivery-receipts/${id}/cancel`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] }); toast({ title: 'Delivery cancelled' }); },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to cancel', variant: 'destructive' }),
  });

  const openCreate = () => { setCustomerId(''); setWarehouseId(''); setAreaId(''); setLocationId(''); setNotes(''); setRows([{ productId: '', quantity: 1 }]); setModalOpen(true); };
  const copyLink = (url: string) => { globalThis.navigator?.clipboard?.writeText(url); toast({ title: 'Sign link copied' }); };

  const columns = [
    { key: 'drNumber', label: 'DR #', render: (v: string) => <span className="font-mono text-sm font-medium">{v}</span> },
    { key: 'customer', label: 'Customer', render: (_: any, row: any) => row.customer?.name || '—' },
    { key: '_count', label: 'Items', className: 'text-center', render: (v: any) => <span className="font-mono text-sm">{v?.items ?? 0}</span> },
    { key: 'status', label: 'Status', render: (v: string, row: any) => (
      row.approval?.status === 'PENDING' || row.approval?.status === 'REJECTED'
        ? <ApprovalStatusBadge approval={row.approval} fallback={v} />
        : (
          <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', statusColors[v] || statusColors.DRAFT)}>
            {v === 'SIGNED' && <CheckCircle2 className="h-3 w-3" />}{v}{row.signedByName ? ` · ${row.signedByName}` : ''}
          </span>
        )
    ) },
    { key: 'deliveryDate', label: 'Date', render: (v: string) => formatDate(v) },
    { key: 'actions', label: '', className: 'text-right', render: (_: any, row: any) => {
      if (row.status === 'DRAFT' && row.approval?.status === 'PENDING') {
        return <ApprovalActions endpoint="/delivery-receipts" id={row.id} approval={row.approval} invalidateKeys={['delivery-receipts', 'products', 'stock-lots', 'stock-movements']} appliedLabel="Goods released" />;
      }
      return (
        <div className="flex items-center gap-0.5 justify-end">
          {row.status !== 'DRAFT' && <button onClick={() => copyLink(row.signUrl)} title="Copy sign link" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Link2 className="h-3.5 w-3.5" /></button>}
          {row.status === 'RELEASED' && can('deliveries', 'edit') && (
            <button onClick={() => cancelMut.mutate(row.id)} title="Cancel" className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"><XCircle className="h-3.5 w-3.5" /></button>
          )}
        </div>
      );
    } },
  ];

  const canSave = !!customerId && !!warehouseId && rows.some((r) => r.productId && r.quantity > 0);

  const statusFilters = ['', 'DRAFT', 'RELEASED', 'SIGNED', 'CANCELLED'];
  const statusLabels: Record<string, string> = { '': 'All', DRAFT: 'Pending', RELEASED: 'Awaiting sign', SIGNED: 'Signed', CANCELLED: 'Cancelled' };

  return (
    <div className="space-y-6">
      <PageHeader title="Deliveries" description="Release finished goods to a customer — creates a Delivery Receipt with an external sign link">
        {can('deliveries', 'create') && <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90"><Plus className="h-4 w-4 mr-2" /> Release / New DR</Button>}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total DRs" value={total} icon={<Send className="h-5 w-5" />} />
        <StatCard title="Signed" value={items.filter((i: any) => i.status === 'SIGNED').length} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Awaiting sign" value={items.filter((i: any) => i.status === 'RELEASED').length} icon={<Send className="h-5 w-5" />} />
      </div>

      <DataTable columns={columns} data={items} total={total} page={page} limit={10} onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search deliveries..." isLoading={isLoading} emptyMessage="No deliveries yet"
        toolbar={
          <div className="flex items-center gap-3 flex-wrap">
            <FilterPopover activeCount={activeFilterCount} onClear={clearFilters}>
              <FilterField label="Customer">
                <SearchableSelect options={customers} value={filterCustomerId} onChange={(v) => { setFilterCustomerId(v); setPage(1); }} placeholder="All customers" />
              </FilterField>
              <FilterField label="Date Created">
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker value={filterCreatedFrom} onChange={(d) => { setFilterCreatedFrom(d); setPage(1); }} placeholder="From" className="text-xs" />
                  <DatePicker value={filterCreatedTo} onChange={(d) => { setFilterCreatedTo(d); setPage(1); }} placeholder="To" className="text-xs" />
                </div>
              </FilterField>
            </FilterPopover>
            <div className="flex items-center gap-1.5 flex-wrap">
              {statusFilters.map((s) => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>Release Goods — New Delivery Receipt</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Customer <span className="text-red-500">*</span></Label>
                <SearchableSelect options={customers} value={customerId} onChange={setCustomerId} placeholder="Select customer" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">From Warehouse <span className="text-red-500">*</span></Label>
                <SearchableSelect options={warehouses} value={warehouseId} onChange={(v) => { setWarehouseId(v); setAreaId(''); setLocationId(''); }} placeholder="Select warehouse" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">From Area</Label>
                <AreaSelect warehouseId={warehouseId} value={areaId} onChange={(v) => { setAreaId(v); setLocationId(''); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">From Location</Label>
                <LocationSelect warehouseId={warehouseId} areaId={areaId} value={locationId} onChange={setLocationId} placeholder="Any location" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">Items to release</Label>
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_40px] gap-2 items-center">
                  <SearchableSelect options={products.filter((o: any) => o.value === row.productId || !usedIds.has(o.value))} value={row.productId} onChange={(v) => updateRow(i, { productId: v })} placeholder="Select finished product" />
                  <Input type="number" step="any" value={row.quantity || ''} placeholder="0" onChange={(e) => updateRow(i, { quantity: Number.parseFloat(e.target.value) || 0 })} className="h-9 rounded-lg text-right" />
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:text-red-700" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
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
              <Send className="h-4 w-4 mr-2" />{saveMut.isPending ? 'Releasing…' : 'Release Goods'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
