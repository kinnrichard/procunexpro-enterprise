'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/components/ui/use-toast';
import {
  ShoppingCart, Plus, Pencil, Trash2, Send, CheckCircle, Truck, PackageCheck,
  Clock, X,
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

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function PurchaseOrdersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, search, statusFilter],
    queryFn: () => api.get('/purchase-orders', { params: { page, limit: 10, search, ...(statusFilter && { status: statusFilter }) } }),
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
    { key: 'totalAmount', label: 'Amount', sortable: true, render: (v: number) => formatCurrency(v) },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'orderDate', label: 'Date', sortable: true, render: (v: string) => formatDate(v) },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        <button type="button" className="flex items-center gap-1" onClick={e => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
          {row.status === 'DRAFT' && (
            <>
              <button onClick={() => actionMut.mutate({ id: row.id, action: 'submit' })} className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600" title="Submit"><Send className="h-3.5 w-3.5" /></button>
              <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
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
        </button>
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
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> New Order
        </Button>
      </PageHeader>

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
        toolbar={
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusFilters.map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                {statusLabels[s]}
              </button>
            ))}
          </div>
        }
      />

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
