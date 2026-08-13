'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrencyStore } from '@/lib/currency';
import {
  ShoppingCart, Plus, Pencil, Trash2, Send, CheckCircle, Truck, PackageCheck,
  Clock, X, Package, Filter,
} from 'lucide-react';

const poSchema = z.object({
  vendorId: z.string().min(1, 'Vendor is required'),
  purchaseRequestId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  expectedDate: z.date().optional().nullable(),
  paymentTerms: z.string().optional(),
  shippingAddress: z.string().optional(),
  notes: z.string().optional(),
  taxAmount: z.coerce.number().min(0).optional(),
  shippingCost: z.coerce.number().min(0).optional(),
  items: z.array(z.object({
    productId: z.string().min(1, 'Product required'),
    quantity: z.coerce.number().min(1),
    unitPrice: z.coerce.number().min(0),
  })).min(1, 'At least one item'),
});

type POFormData = z.infer<typeof poSchema>;

// ─── Create from PRs Tab ────────────────────────────────────
function CreateFromPRs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fmt = useCurrencyStore((s) => s.format);
  const [liPage, setLiPage] = useState(1);
  const [liSearch, setLiSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: liRes, isLoading: liLoading } = useQuery({
    queryKey: ['pr-approved-items', liPage, liSearch],
    queryFn: () => api.get('/purchase-requests/items/all', { params: { page: liPage, limit: 20, search: liSearch || undefined, prStatus: 'PROCUREMENT' } }),
  });

  const liItems: any[] = liRes?.data?.data || [];
  const liTotal = liRes?.data?.total || 0;

  function toggleItem(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleAll() {
    if (selectedIds.size === liItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(liItems.map((i: any) => i.id)));
    }
  }

  // Group selected items by vendor for preview
  const selectedItems = liItems.filter((i: any) => selectedIds.has(i.id));
  const vendorGroups = new Map<string, { vendor: any; items: any[] }>();
  for (const item of selectedItems) {
    const vid = item.vendor?.id || 'no-vendor';
    const group = vendorGroups.get(vid) || { vendor: item.vendor, items: [] };
    group.items.push(item);
    vendorGroups.set(vid, group);
  }
  const hasNoVendor = vendorGroups.has('no-vendor');

  const createBatchMutation = useMutation({
    mutationFn: () => api.post('/purchase-orders/from-pr-items', { itemIds: [...selectedIds] }),
    onSuccess: (res) => {
      const count = res.data?.created || 0;
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pr-approved-items'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      setSelectedIds(new Set());
      setConfirmOpen(false);
      toast({ title: `${count} Purchase Order${count === 1 ? '' : 's'} created` });
    },
    onError: (err: any) => toast({ title: 'Failed', description: err?.response?.data?.message || 'Failed to create POs', variant: 'destructive' }),
  });

  const allSelected = liItems.length > 0 && selectedIds.size === liItems.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Input placeholder="Search products, SKU, request #..." value={liSearch} onChange={(e) => { setLiSearch(e.target.value); setLiPage(1); }} className="max-w-xs h-9" />
          <p className="text-sm text-muted-foreground">{liTotal} approved item{liTotal === 1 ? '' : 's'}</p>
        </div>
        {selectedIds.size > 0 && (
          <Button onClick={() => setConfirmOpen(true)} disabled={hasNoVendor} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
            <Package className="h-4 w-4 mr-2" /> Create PO ({selectedIds.size} item{selectedIds.size === 1 ? '' : 's'})
          </Button>
        )}
      </div>

      {/* Items table */}
      {liLoading ? (
        <div className="flex items-center justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : liItems.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">No approved line items available for PO conversion.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                <th className="px-3 py-2.5 w-[36px]">
                  <button onClick={toggleAll} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-colors', allSelected ? 'bg-primary border-primary' : someSelected ? 'border-primary bg-primary/20' : 'border-border')}>
                    {allSelected && <CheckCircle className="h-2.5 w-2.5 text-primary-foreground" />}
                    {someSelected && <div className="w-2 h-0.5 bg-primary rounded-full" />}
                  </button>
                </th>
                <th className="text-left px-3 py-2.5">Request #</th>
                <th className="text-left px-3 py-2.5">Company</th>
                <th className="text-left px-3 py-2.5">Product</th>
                <th className="text-left px-3 py-2.5">Vendor</th>
                <th className="text-center px-3 py-2.5">Qty</th>
                <th className="text-right px-3 py-2.5">Unit Price</th>
                <th className="text-right px-3 py-2.5">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {liItems.map((item: any) => (
                <tr key={item.id} className={cn('transition-colors cursor-pointer', selectedIds.has(item.id) ? 'bg-primary/5' : 'hover:bg-accent/30')} onClick={() => toggleItem(item.id)}>
                  <td className="px-3 py-2.5">
                    <button onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-colors', selectedIds.has(item.id) ? 'bg-primary border-primary' : 'border-border hover:border-primary/50')}>
                      {selectedIds.has(item.id) && <CheckCircle className="h-2.5 w-2.5 text-primary-foreground" />}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-primary">{item.purchaseRequest?.requestNumber || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.purchaseRequest?.company?.name || '—'}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{item.product?.name || item.description || '—'}</p>
                    {item.product?.sku && <p className="font-mono text-xs text-muted-foreground">{item.product.sku}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    {item.vendor ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center shrink-0">
                          <span className="text-white text-[8px] font-bold">{item.vendor.name.charAt(0)}</span>
                        </div>
                        <span className="text-xs">{item.vendor.name}</span>
                      </div>
                    ) : <span className="text-xs text-amber-600 font-medium">No vendor</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmt(item.estimatedPrice || 0)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium">{fmt(item.totalPrice || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {liTotal > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {liPage} of {Math.ceil(liTotal / 20)}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={liPage <= 1} onClick={() => setLiPage(liPage - 1)}>Prev</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={liPage >= Math.ceil(liTotal / 20)} onClick={() => setLiPage(liPage + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Confirm dialog with vendor grouping preview */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Create Purchase Orders</DialogTitle>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              {vendorGroups.size} PO{vendorGroups.size === 1 ? '' : 's'} will be created from {selectedIds.size} selected item{selectedIds.size === 1 ? '' : 's'}:
            </p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {[...vendorGroups.entries()].map(([vid, group]) => (
                <div key={vid} className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{group.vendor?.name || 'No Vendor'}</p>
                    <span className="text-xs text-muted-foreground">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: <span className="font-mono font-medium text-foreground">{fmt(group.items.reduce((s, i) => s + (i.totalPrice || 0), 0))}</span>
                  </p>
                </div>
              ))}
            </div>
            {hasNoVendor && (
              <p className="text-xs text-red-500">Some items have no vendor. Assign vendors before creating POs.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button onClick={() => createBatchMutation.mutate()} disabled={hasNoVendor || createBatchMutation.isPending} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {createBatchMutation.isPending ? 'Creating...' : `Create ${vendorGroups.size} PO${vendorGroups.size === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Advanced filters
  const [filterVendorId, setFilterVendorId] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterOrderFrom, setFilterOrderFrom] = useState<Date | undefined>();
  const [filterOrderTo, setFilterOrderTo] = useState<Date | undefined>();
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');
  const activeFilterCount = [filterVendorId, filterPriority, filterOrderFrom, filterOrderTo, filterAmountMin, filterAmountMax].filter(Boolean).length;
  const toDateStr = (d?: Date) => (d ? d.toISOString().split('T')[0] : '');
  function clearFilters() {
    setFilterVendorId(''); setFilterPriority('');
    setFilterOrderFrom(undefined); setFilterOrderTo(undefined);
    setFilterAmountMin(''); setFilterAmountMax('');
    setPage(1);
  }

  const { data: response, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, search, statusFilter, filterVendorId, filterPriority, filterOrderFrom, filterOrderTo, filterAmountMin, filterAmountMax],
    queryFn: () => api.get('/purchase-orders', { params: {
      page, limit: 10, search,
      ...(statusFilter && { status: statusFilter }),
      ...(filterVendorId && { vendorId: filterVendorId }),
      ...(filterPriority && { priority: filterPriority }),
      ...(filterOrderFrom && { orderDateFrom: toDateStr(filterOrderFrom) }),
      ...(filterOrderTo && { orderDateTo: toDateStr(filterOrderTo) }),
      ...(filterAmountMin && { amountMin: filterAmountMin }),
      ...(filterAmountMax && { amountMax: filterAmountMax }),
    } }),
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendors-approved'],
    queryFn: () => api.get('/vendors', { params: { limit: 1000, status: 'APPROVED' } }),
  });

  const { data: prodData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => api.get('/products', { params: { limit: 1000 } }),
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;

  const stats = useMemo(() => ({
    total,
    pending: items.filter((i: any) => i.status === 'PENDING_APPROVAL').length,
    sent: items.filter((i: any) => i.status === 'SENT').length,
    received: items.filter((i: any) => i.status === 'RECEIVED').length,
  }), [items, total]);

  const vendors = (vendorData?.data?.data || []).map((v: any) => ({ value: v.id, label: v.name }));
  const products = (prodData?.data?.data || []).map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` }));

  const form = useForm<POFormData>({
    resolver: zodResolver(poSchema),
    mode: 'onChange',
    defaultValues: { vendorId: '', purchaseRequestId: '', priority: 'MEDIUM', expectedDate: null, paymentTerms: '', shippingAddress: '', notes: '', taxAmount: 0, shippingCost: 0, items: [{ productId: '', quantity: 1, unitPrice: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  const watchItems = form.watch('items');
  const watchTax = form.watch('taxAmount') || 0;
  const watchShipping = form.watch('shippingCost') || 0;
  const subtotal = watchItems?.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0) || 0;
  const grandTotal = subtotal + watchTax + watchShipping;

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/purchase-orders', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); setModalOpen(false); toast({ title: 'Purchase order created' }); },
    onError: () => toast({ title: 'Failed to create', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/purchase-orders/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); setModalOpen(false); toast({ title: 'Purchase order updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/purchase-orders/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); setDeleteTarget(null); toast({ title: 'Purchase order deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.put(`/purchase-orders/${id}/${action}`),
    onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); toast({ title: `Order ${vars.action === 'receive' ? 'received' : vars.action + 'ed'} successfully` }); },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ vendorId: '', purchaseRequestId: '', priority: 'MEDIUM', expectedDate: null, paymentTerms: '', shippingAddress: '', notes: '', taxAmount: 0, shippingCost: 0, items: [{ productId: '', quantity: 1, unitPrice: 0 }] });
    setModalOpen(true);
  };

  const openEdit = (po: any) => {
    setEditing(po);
    form.reset({
      vendorId: po.vendorId, purchaseRequestId: po.purchaseRequestId || '', priority: po.priority,
      expectedDate: po.expectedDate ? new Date(po.expectedDate) : null,
      paymentTerms: po.paymentTerms || '', shippingAddress: po.shippingAddress || '', notes: po.notes || '',
      taxAmount: po.taxAmount || 0, shippingCost: po.shippingCost || 0,
      items: po.items?.map((i: any) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })) || [{ productId: '', quantity: 1, unitPrice: 0 }],
    });
    setModalOpen(true);
  };

  const onSubmit = (data: POFormData) => {
    const payload = {
      ...data,
      expectedDate: data.expectedDate?.toISOString(),
      subtotal,
      totalAmount: grandTotal,
      items: data.items.map(i => ({ ...i, totalPrice: i.quantity * i.unitPrice })),
    };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const columns = [
    { key: 'orderNumber', label: 'Order #', sortable: true, render: (v: string) => <span className="font-medium text-primary">{v}</span> },
    { key: 'vendor', label: 'Vendor', render: (_: any, row: any) => row.vendor?.name || '—' },
    { key: 'purchaseRequest', label: 'PR Ref', render: (_: any, row: any) => row.purchaseRequest?.requestNumber || <span className="text-muted-foreground text-xs">Direct</span> },
    { key: 'priority', label: 'Priority', render: (v: string) => <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', priorityColors[v])}>{v}</span> },
    { key: 'totalAmount', label: 'Amount', sortable: true, className: 'text-right', render: (v: number) => <span className="font-mono font-medium">{formatCurrency(v)}</span> },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'orderDate', label: 'Date', sortable: true, render: (v: string) => formatDate(v) },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {row.status === 'DRAFT' && (
            <>
              <button onClick={() => actionMut.mutate({ id: row.id, action: 'submit' })} className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600" title="Submit"><Send className="h-3.5 w-3.5" /></button>
              {can('purchase-orders', 'edit') && <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>}
              {can('purchase-orders', 'delete') && <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
            </>
          )}
          {row.status === 'PENDING_APPROVAL' && (
            <button onClick={() => actionMut.mutate({ id: row.id, action: 'approve' })} className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600" title="Approve"><CheckCircle className="h-3.5 w-3.5" /></button>
          )}
          {row.status === 'APPROVED' && (
            <button onClick={() => actionMut.mutate({ id: row.id, action: 'send' })} className="p-1.5 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600" title="Send to Vendor"><Truck className="h-3.5 w-3.5" /></button>
          )}
          {(row.status === 'SENT' || row.status === 'PARTIALLY_RECEIVED') && (
            <button onClick={() => actionMut.mutate({ id: row.id, action: 'receive' })} className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600" title="Receive"><PackageCheck className="h-3.5 w-3.5" /></button>
          )}
        </div>
      ),
    },
  ];

  const statusFilters = ['', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'];
  const statusLabels: Record<string, string> = { '': 'All', DRAFT: 'Draft', PENDING_APPROVAL: 'Pending', APPROVED: 'Approved', SENT: 'Sent', PARTIALLY_RECEIVED: 'Partial', RECEIVED: 'Received' };

  const isSavingPO = createMut.isPending || updateMut.isPending;
  let poSubmitLabel: string;
  if (isSavingPO) poSubmitLabel = 'Saving...';
  else if (editing) poSubmitLabel = 'Update Order';
  else poSubmitLabel = 'Create Order';

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Orders" description="Manage purchase orders and deliveries">
        {can('purchase-orders', 'create') && (
          <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" /> New Order
          </Button>
        )}
      </PageHeader>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            Orders
          </TabsTrigger>
          <TabsTrigger value="create-from-pr" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            Create from PRs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-5 space-y-6">

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Orders" value={stats.total} icon={<ShoppingCart className="h-5 w-5" />} />
        <StatCard title="Pending" value={stats.pending} icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Sent" value={stats.sent} icon={<Truck className="h-5 w-5" />} />
        <StatCard title="Received" value={stats.received} icon={<PackageCheck className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={page}
        limit={10}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search orders..."
        isLoading={isLoading}
        emptyMessage="No purchase orders found"
        onRowClick={(row: any) => router.push(`/purchase-orders/${row.id}`)}
        toolbar={
          <div className="flex items-center gap-3 flex-wrap">
            <FilterPopover activeCount={activeFilterCount} onClear={clearFilters}>
              <FilterField label="Vendor">
                <SearchableSelect options={vendors} value={filterVendorId} onChange={(v) => { setFilterVendorId(v); setPage(1); }} placeholder="All vendors" />
              </FilterField>
              <FilterField label="Priority">
                <Select value={filterPriority || 'ALL'} onValueChange={(v) => { setFilterPriority(v === 'ALL' ? '' : v); setPage(1); }}>
                  <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="All priorities" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All priorities</SelectItem>
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Order Date">
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker value={filterOrderFrom} onChange={(d) => { setFilterOrderFrom(d); setPage(1); }} placeholder="From" className="text-xs" />
                  <DatePicker value={filterOrderTo} onChange={(d) => { setFilterOrderTo(d); setPage(1); }} placeholder="To" className="text-xs" />
                </div>
              </FilterField>
              <FilterField label="Total Amount">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={filterAmountMin} onChange={(e) => { setFilterAmountMin(e.target.value); setPage(1); }} className="h-9 rounded-lg" placeholder="Min" />
                  <Input type="number" value={filterAmountMax} onChange={(e) => { setFilterAmountMax(e.target.value); setPage(1); }} className="h-9 rounded-lg" placeholder="Max" />
                </div>
              </FilterField>
            </FilterPopover>
            <div className="flex items-center gap-1.5 flex-wrap">
              {statusFilters.map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>
        }
      />

        </TabsContent>

        <TabsContent value="create-from-pr" className="mt-5">
          <CreateFromPRs />
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Purchase Order' : 'New Purchase Order'}</DialogTitle>
          </DialogHeader>
          <form id="po-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Vendor <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="vendorId" render={({ field }) => (
                  <SearchableSelect options={vendors} value={field.value} onChange={field.onChange} placeholder="Select vendor" />
                )} />
                {form.formState.errors.vendorId && <p className="text-xs text-red-500">{form.formState.errors.vendorId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Priority</Label>
                <Controller control={form.control} name="priority" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Expected Delivery</Label>
                <Controller control={form.control} name="expectedDate" render={({ field }) => (
                  <DatePicker value={field.value || undefined} onChange={(d) => field.onChange(d)} />
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Payment Terms</Label>
                <Input {...form.register('paymentTerms')} className="h-9 rounded-lg" placeholder="e.g. Net 30" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Shipping Address</Label>
              <Input {...form.register('shippingAddress')} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea {...form.register('notes')} className="rounded-lg" rows={2} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-semibold">Order Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1, unitPrice: 0 })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start p-3 bg-muted/30 rounded-lg">
                    <div className="col-span-5 space-y-1">
                      {index === 0 && <Label className="text-[11px] text-muted-foreground">Product</Label>}
                      <Controller control={form.control} name={`items.${index}.productId`} render={({ field: f }) => (
                        <SearchableSelect options={products} value={f.value} onChange={f.onChange} placeholder="Select product" />
                      )} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      {index === 0 && <Label className="text-[11px] text-muted-foreground">Qty</Label>}
                      <Input type="number" min={1} {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} className="h-9 rounded-lg" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      {index === 0 && <Label className="text-[11px] text-muted-foreground">Unit Price</Label>}
                      <Input type="number" min={0} step="0.01" {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })} className="h-9 rounded-lg" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      {index === 0 && <Label className="text-[11px] text-muted-foreground">Total</Label>}
                      <div className="h-9 flex items-center text-sm font-medium">{formatCurrency((watchItems?.[index]?.quantity || 0) * (watchItems?.[index]?.unitPrice || 0))}</div>
                    </div>
                    <div className="col-span-1">
                      {index === 0 && <Label className="text-[11px] text-muted-foreground">&nbsp;</Label>}
                      {fields.length > 1 && <button type="button" onClick={() => remove(index)} className="h-9 flex items-center text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm text-right">
                <div>Subtotal: {formatCurrency(subtotal)}</div>
                <div className="flex justify-end gap-4">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Tax</Label>
                    <Input type="number" min={0} step="0.01" {...form.register('taxAmount', { valueAsNumber: true })} className="h-8 w-28 rounded-lg text-right" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Shipping</Label>
                    <Input type="number" min={0} step="0.01" {...form.register('shippingCost', { valueAsNumber: true })} className="h-8 w-28 rounded-lg text-right" />
                  </div>
                </div>
                <div className="font-bold text-base pt-1">Grand Total: {formatCurrency(grandTotal)}</div>
              </div>
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="po-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || isSavingPO}>
              {poSubmitLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Purchase Order"
        description={`Delete ${deleteTarget?.orderNumber}? This cannot be undone.`}
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        isLoading={deleteMut.isPending}
      />
    </div>
  );
}
