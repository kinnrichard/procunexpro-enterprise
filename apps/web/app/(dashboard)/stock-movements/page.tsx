'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { FilterPopover, FilterField } from '@/components/filter-popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeftRight, Plus, ArrowDownRight, ArrowUpRight, RefreshCw, Package } from 'lucide-react';

const movementSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  type: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'WRITE_OFF']),
  quantity: z.coerce.number().gt(0, 'Must be greater than 0'),
  fromWarehouseId: z.string().optional(),
  toWarehouseId: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

type MovementFormData = z.infer<typeof movementSchema>;

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

const inTypes = new Set(['PURCHASE', 'TRANSFER_IN', 'RETURN', 'PRODUCTION_IN']);

export default function StockMovementsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Advanced filters
  const [filterProductId, setFilterProductId] = useState('');
  const [filterWarehouseId, setFilterWarehouseId] = useState('');
  const [filterCreatedFrom, setFilterCreatedFrom] = useState<Date | undefined>();
  const [filterCreatedTo, setFilterCreatedTo] = useState<Date | undefined>();
  const activeFilterCount = [filterProductId, filterWarehouseId, filterCreatedFrom, filterCreatedTo].filter(Boolean).length;
  const toDateStr = (d?: Date) => (d ? d.toISOString().split('T')[0] : '');
  function clearFilters() {
    setFilterProductId(''); setFilterWarehouseId('');
    setFilterCreatedFrom(undefined); setFilterCreatedTo(undefined);
    setPage(1);
  }

  const { data: response, isLoading } = useQuery({
    queryKey: ['stock-movements', page, search, typeFilter, filterProductId, filterWarehouseId, filterCreatedFrom, filterCreatedTo],
    queryFn: () => api.get('/stock-movements', { params: {
      page, limit: 10, search,
      ...(typeFilter && { type: typeFilter }),
      ...(filterProductId && { productId: filterProductId }),
      ...(filterWarehouseId && { warehouseId: filterWarehouseId }),
      ...(filterCreatedFrom && { createdDateFrom: toDateStr(filterCreatedFrom) }),
      ...(filterCreatedTo && { createdDateTo: toDateStr(filterCreatedTo) }),
    } }),
  });

  const { data: prodData } = useQuery({ queryKey: ['products-all'], queryFn: () => api.get('/products', { params: { limit: 1000 } }) });
  const { data: whData } = useQuery({ queryKey: ['warehouses-all'], queryFn: () => api.get('/warehouses', { params: { limit: 1000 } }) });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const products = (prodData?.data?.data || []).map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  const warehouses = (whData?.data?.data || []).map((w: any) => ({ value: w.id, label: w.name }));

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    mode: 'onChange',
    defaultValues: { productId: '', type: 'PURCHASE', quantity: 1, fromWarehouseId: '', toWarehouseId: '', reason: '', notes: '' },
  });

  const watchType = form.watch('type');
  const showFrom = ['TRANSFER_OUT', 'SALE', 'WRITE_OFF'].includes(watchType);
  const showTo = ['PURCHASE', 'TRANSFER_IN', 'RETURN'].includes(watchType);

  const createMut = useMutation({
    mutationFn: (data: MovementFormData) => api.post('/stock-movements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast({ title: 'Stock movement recorded' });
    },
    onError: () => toast({ title: 'Failed to record movement', variant: 'destructive' }),
  });

  const openCreate = () => {
    form.reset({ productId: '', type: 'PURCHASE', quantity: 1, fromWarehouseId: '', toWarehouseId: '', reason: '', notes: '' });
    setModalOpen(true);
  };

  const columns = [
    { key: 'referenceNumber', label: 'Reference', sortable: true, render: (v: string) => <span className="font-medium font-mono text-sm">{v}</span> },
    { key: 'product', label: 'Product', render: (_: any, row: any) => row.product?.name || '—' },
    {
      key: 'type', label: 'Type', render: (v: string) => (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', typeColors[v])}>
          {inTypes.has(v) ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
          {v.replaceAll('_', ' ')}
        </span>
      ),
    },
    {
      key: 'quantity', label: 'Quantity', render: (v: number, row: any) => (
        <span className={cn('font-mono font-semibold', inTypes.has(row.type) ? 'text-green-600' : 'text-red-600')}>
          {inTypes.has(row.type) ? '+' : '-'}{v}
        </span>
      ),
    },
    { key: 'fromWarehouse', label: 'From', render: (_: any, row: any) => row.fromWarehouse?.name || '—' },
    { key: 'toWarehouse', label: 'To', render: (_: any, row: any) => row.toWarehouse?.name || '—' },
    { key: 'createdAt', label: 'Date', sortable: true, render: (v: string) => formatDateTime(v) },
  ];

  const typeFilters = ['', 'PURCHASE', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'RETURN', 'WRITE_OFF'];
  const typeLabels: Record<string, string> = { '': 'All', PURCHASE: 'Purchase', SALE: 'Sale', TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out', ADJUSTMENT: 'Adjustment', RETURN: 'Return', WRITE_OFF: 'Write Off' };

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Movements" description="Track all inventory changes">
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> New Movement
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Movements" value={total} icon={<ArrowLeftRight className="h-5 w-5" />} />
        <StatCard title="Purchases" value={items.filter((i: any) => i.type === 'PURCHASE').length} icon={<ArrowDownRight className="h-5 w-5" />} />
        <StatCard title="Transfers" value={items.filter((i: any) => i.type.startsWith('TRANSFER')).length} icon={<RefreshCw className="h-5 w-5" />} />
        <StatCard title="Adjustments" value={items.filter((i: any) => i.type === 'ADJUSTMENT').length} icon={<Package className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={page}
        limit={10}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search movements..."
        isLoading={isLoading}
        emptyMessage="No stock movements found"
        toolbar={
          <div className="flex items-center gap-3 flex-wrap">
            <FilterPopover activeCount={activeFilterCount} onClear={clearFilters}>
              <FilterField label="Date">
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker value={filterCreatedFrom} onChange={(d) => { setFilterCreatedFrom(d); setPage(1); }} placeholder="From" className="text-xs" />
                  <DatePicker value={filterCreatedTo} onChange={(d) => { setFilterCreatedTo(d); setPage(1); }} placeholder="To" className="text-xs" />
                </div>
              </FilterField>
              <FilterField label="Product">
                <SearchableSelect options={products} value={filterProductId} onChange={(v) => { setFilterProductId(v); setPage(1); }} placeholder="All products" />
              </FilterField>
              <FilterField label="Warehouse">
                <SearchableSelect options={warehouses} value={filterWarehouseId} onChange={(v) => { setFilterWarehouseId(v); setPage(1); }} placeholder="All warehouses" />
              </FilterField>
            </FilterPopover>
            <div className="flex items-center gap-1.5 flex-wrap">
              {typeFilters.map(t => (
                <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                  {typeLabels[t]}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>New Stock Movement</DialogTitle>
          </DialogHeader>
          <form id="movement-form" onSubmit={form.handleSubmit((d) => createMut.mutate(d))} className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Product <span className="text-red-500">*</span></Label>
              <Controller control={form.control} name="productId" render={({ field }) => (
                <SearchableSelect options={products} value={field.value} onChange={field.onChange} placeholder="Select product" />
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Type <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="type" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'WRITE_OFF'].map(t => (
                        <SelectItem key={t} value={t}>{t.replaceAll('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Quantity <span className="text-red-500">*</span></Label>
                <Input type="number" min={0} step="any" {...form.register('quantity', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
            </div>
            {showFrom && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">From Warehouse</Label>
                <Controller control={form.control} name="fromWarehouseId" render={({ field }) => (
                  <SearchableSelect options={warehouses} value={field.value || ''} onChange={field.onChange} placeholder="Select warehouse" />
                )} />
              </div>
            )}
            {showTo && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">To Warehouse</Label>
                <Controller control={form.control} name="toWarehouseId" render={({ field }) => (
                  <SearchableSelect options={warehouses} value={field.value || ''} onChange={field.onChange} placeholder="Select warehouse" />
                )} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Reason</Label>
              <Input {...form.register('reason')} className="h-9 rounded-lg" placeholder="e.g., Stock count adjustment" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea {...form.register('notes')} className="rounded-lg" rows={2} placeholder="Optional notes..." />
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="movement-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMut.isPending}>
              {createMut.isPending ? 'Recording...' : 'Record Movement'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
