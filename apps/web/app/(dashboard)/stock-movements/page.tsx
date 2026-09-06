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
import { usePermissions } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth';
import { ArrowLeftRight, Plus, ArrowDownRight, ArrowUpRight, RefreshCw, Package, Check, X, Loader2 } from 'lucide-react';

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const movementSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  type: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'WRITE_OFF']),
  quantity: z.coerce.number().gt(0, 'Must be greater than 0'),
  fromWarehouseId: z.string().optional(),
  toWarehouseId: z.string().optional(),
  manufactureDate: z.date().optional(),
  expiryDate: z.date().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).refine((d) => !d.manufactureDate || !d.expiryDate || d.expiryDate >= d.manufactureDate, {
  message: 'Expiration date must be on or after the manufacturing date',
  path: ['expiryDate'],
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
  const { can, isAdmin } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const eligibleFor = (a: any) => isAdmin || (!!a?.currentRole && user?.role === a.currentRole);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [invType, setInvType] = useState('');

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
  const { data: invTypeData } = useQuery({ queryKey: ['inventory-types-active'], queryFn: () => api.get('/inventory-types/active') });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const productList: any[] = prodData?.data?.data || [];
  const products = productList.map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  const warehouses = (whData?.data?.data || []).map((w: any) => ({ value: w.id, label: w.name }));
  // Composition types (finished goods / components) are produced, not moved manually — exclude them
  const invTypeList: any[] = invTypeData?.data?.data || [];
  const compositionKeys = new Set(invTypeList.filter((t) => t.hasComposition).map((t) => t.key));
  const invTypeOptions = invTypeList.filter((t) => !t.hasComposition).map((t) => ({ value: t.key, label: t.label }));

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    mode: 'onChange',
    defaultValues: { productId: '', type: 'PURCHASE', quantity: undefined as unknown as number, fromWarehouseId: '', toWarehouseId: '', manufactureDate: undefined, expiryDate: undefined, reason: '', notes: '' },
  });

  const watchType = form.watch('type');
  const watchProductId = form.watch('productId');
  const watchFromWh = form.watch('fromWarehouseId');
  const watchToWh = form.watch('toWarehouseId');
  const watchQty = form.watch('quantity');
  const showFrom = ['TRANSFER_OUT', 'SALE', 'WRITE_OFF', 'ADJUSTMENT'].includes(watchType);
  const showTo = ['PURCHASE', 'TRANSFER_IN', 'RETURN'].includes(watchType);
  const isOut = !inTypes.has(watchType); // outbound types reduce stock

  // Filter by inventory type; require existing stock only for OUTBOUND (inbound adds stock)
  const itemOptions = productList
    .filter((p) => !compositionKeys.has(p.inventoryType) && (!invType || p.inventoryType === invType) && (!isOut || (p.currentStock ?? 0) > 0))
    .map((p) => ({
      value: p.id,
      label: isOut ? `${p.name} (${p.sku}) — ${p.currentStock} ${p.unit || ''}`.trim() : `${p.name} (${p.sku})`,
    }));

  const selectedProduct = productList.find((p) => p.id === watchProductId);
  const stockUnit: string = selectedProduct?.unit || '';
  const needsWarehouse = showFrom || showTo;
  const activeWh = showFrom ? watchFromWh : (showTo ? watchToWh : '');

  // Stock of the selected item AT the selected warehouse (summed from its lots)
  const { data: whStockData, isFetching: whStockLoading } = useQuery({
    queryKey: ['wh-stock', watchProductId, activeWh],
    queryFn: () => api.get('/stock-lots', { params: { productId: watchProductId, warehouseId: activeWh, status: 'AVAILABLE', limit: 1000 } }),
    enabled: !!watchProductId && !!activeWh,
  });
  const warehouseStock = Math.round((whStockData?.data?.data || []).reduce((s: number, l: any) => s + (l.quantity || 0), 0) * 1e6) / 1e6;

  // Per-warehouse stock when a warehouse is chosen; otherwise the item's aggregate on-hand.
  // Only relevant for outbound movements (removing stock) — inbound adds stock.
  const currentStock: number = (needsWarehouse && activeWh) ? warehouseStock : (selectedProduct?.currentStock ?? 0);
  const showStock = isOut && !!selectedProduct;
  const overStock = showStock && !whStockLoading && (watchQty || 0) > currentStock;

  const createMut = useMutation({
    mutationFn: (data: MovementFormData) => api.post('/stock-movements', data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast({ title: res?.data?.status === 'PENDING' ? 'Movement submitted for approval' : 'Stock movement recorded' });
    },
    onError: () => toast({ title: 'Failed to record movement', variant: 'destructive' }),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) => api.put(`/stock-movements/${id}/${action}`),
    onSuccess: (res: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-lots'] });
      const st = res?.data?.status;
      const msg = vars.action === 'reject' ? 'Movement rejected'
        : st === 'APPROVED' ? 'Approved & applied' : 'Stage approved — sent to next approver';
      toast({ title: msg });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Action failed', variant: 'destructive' }),
  });

  const openCreate = () => {
    setInvType('');
    form.reset({ productId: '', type: 'PURCHASE', quantity: undefined as unknown as number, fromWarehouseId: '', toWarehouseId: '', manufactureDate: undefined, expiryDate: undefined, reason: '', notes: '' });
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
    {
      key: 'status', label: 'Status', render: (_: any, row: any) => {
        const a = row.approval;
        const st = a?.status || row.status || 'APPROVED';
        return (
          <div className="flex flex-col gap-0.5">
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit', statusStyles[st] || statusStyles.APPROVED)}>
              {st.charAt(0) + st.slice(1).toLowerCase()}
            </span>
            {st === 'PENDING' && a && a.totalSteps > 1 && (
              <span className="text-[11px] text-muted-foreground">Stage {a.currentStep}/{a.totalSteps} · {a.currentStepName || a.currentRole}</span>
            )}
          </div>
        );
      },
    },
    { key: 'createdAt', label: 'Date', sortable: true, render: (v: string) => formatDateTime(v) },
    {
      key: 'actions', label: '', className: 'text-right', render: (_: any, row: any) => {
        const a = row.approval;
        const st = a?.status || row.status;
        if (st !== 'PENDING' || !eligibleFor(a)) return null;
        const busy = decideMut.isPending && decideMut.variables?.id === row.id;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button size="sm" className="h-7 px-2.5 bg-green-600 hover:bg-green-700 text-white" disabled={busy}
              onClick={() => decideMut.mutate({ id: row.id, action: 'approve' })}>
              {busy && decideMut.variables?.action === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span className="ml-1">Approve</span>
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" disabled={busy}
              onClick={() => decideMut.mutate({ id: row.id, action: 'reject' })}>
              {busy && decideMut.variables?.action === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              <span className="ml-1">Reject</span>
            </Button>
          </div>
        );
      },
    },
  ];

  const typeFilters = ['', 'PURCHASE', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'RETURN', 'WRITE_OFF'];
  const typeLabels: Record<string, string> = { '': 'All', PURCHASE: 'Purchase', SALE: 'Sale', TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out', ADJUSTMENT: 'Adjustment', RETURN: 'Return', WRITE_OFF: 'Write Off' };

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Movements" description="Track all inventory changes">
        {can('products', 'create') && (
          <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" /> New Movement
          </Button>
        )}
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
              <FilterField label="Item">
                <SearchableSelect options={products} value={filterProductId} onChange={(v) => { setFilterProductId(v); setPage(1); }} placeholder="All items" />
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
              <Label className="text-[13px]">Movement Type <span className="text-red-500">*</span></Label>
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
              <p className={cn('text-xs mt-0.5 flex items-center gap-1', isOut ? 'text-red-600' : 'text-emerald-600')}>
                {isOut ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {isOut ? 'Reduces stock' : 'Increases stock'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Inventory Type</Label>
              <SearchableSelect options={invTypeOptions} value={invType} onChange={(v) => { setInvType(v); form.setValue('productId', ''); }} placeholder="All types" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Item <span className="text-red-500">*</span></Label>
              <Controller control={form.control} name="productId" render={({ field }) => (
                <SearchableSelect options={itemOptions} value={field.value} onChange={field.onChange} placeholder={isOut ? 'Select item (with stock)' : 'Select item'} />
              )} />
              {itemOptions.length === 0 && <p className="text-xs text-muted-foreground">{isOut ? 'No items with stock' : 'No items'}{invType ? ' for this type' : ''}.</p>}
            </div>
            {showFrom && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">From Warehouse <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="fromWarehouseId" render={({ field }) => (
                  <SearchableSelect options={warehouses} value={field.value || ''} onChange={field.onChange} placeholder="Select warehouse" />
                )} />
              </div>
            )}
            {showTo && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">To Warehouse <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="toWarehouseId" render={({ field }) => (
                  <SearchableSelect options={warehouses} value={field.value || ''} onChange={field.onChange} placeholder="Select warehouse" />
                )} />
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[13px]">Quantity <span className="text-red-500">*</span></Label>
                {showStock && (
                  <span className="text-xs text-muted-foreground">Current stock: <span className="font-mono font-medium text-foreground">{whStockLoading && needsWarehouse ? '…' : `${currentStock} ${stockUnit}`}</span></span>
                )}
              </div>
              <Controller control={form.control} name="quantity" render={({ field }) => (
                <Input
                  type="number" min={0} step="any" placeholder="0"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number.parseFloat(e.target.value))}
                  className={cn('h-9 rounded-lg', overStock && 'border-red-300 focus-visible:ring-red-200')}
                />
              )} />
              {overStock && <p className="text-xs text-red-500">Quantity ({watchQty}) exceeds current stock ({currentStock} {stockUnit}).</p>}
            </div>
            {!isOut && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Manufacturing Date</Label>
                  <Controller control={form.control} name="manufactureDate" render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} placeholder="Optional" />
                  )} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Expiration Date</Label>
                  <Controller control={form.control} name="expiryDate" render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} placeholder="Optional" />
                  )} />
                  {form.formState.errors.expiryDate && <p className="text-xs text-red-500">{form.formState.errors.expiryDate.message}</p>}
                </div>
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
            <Button type="submit" form="movement-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || overStock || (needsWarehouse && !activeWh) || createMut.isPending}>
              {createMut.isPending ? 'Recording...' : 'Record Movement'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
