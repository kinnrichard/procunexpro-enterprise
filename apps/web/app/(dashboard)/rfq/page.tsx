'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { useCurrencyStore } from '@/lib/currency';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  FileSearch, Plus, Pencil, Trash2, Send, Lock, Eye,
  X, Clock, Trophy, Loader2,
} from 'lucide-react';

const rfqSchema = z.object({
  title: z.string().min(2, 'Title required'),
  description: z.string().optional(),
  deadline: z.date().optional().nullable(),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, 'Description required'),
    quantity: z.coerce.number().min(1),
    unit: z.string().min(1),
  })).min(1, 'At least one item'),
});

type RFQFormData = z.infer<typeof rfqSchema>;

// ─── Create from PRs Tab ─────────────────────────────────
function CreateFromPRs() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const formatCurrency = useCurrencyStore((s) => s.format);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rfqTitle, setRfqTitle] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [prSearch, setPrSearch] = useState('');
  const [prPage, setPrPage] = useState(1);

  const { data: prItemsRes, isLoading } = useQuery({
    queryKey: ['pr-items-approved', prPage, prSearch],
    queryFn: () => api.get('/purchase-requests/items/all', { params: { page: prPage, limit: 20, prStatus: 'PROCUREMENT', search: prSearch } }),
  });

  const prItems = prItemsRes?.data?.data || [];
  const prTotal = prItemsRes?.data?.total || 0;

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/rfq/from-pr-items', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      setConfirmOpen(false);
      setSelectedIds(new Set());
      setRfqTitle('');
      toast({ title: 'RFQ created from PR items' });
      const rfqId = res?.data?.id;
      if (rfqId) router.push(`/rfq/${rfqId}`);
    },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to create RFQ', variant: 'destructive' }),
  });

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === prItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(prItems.map((i: any) => i.id)));
  };

  const handleCreate = () => {
    if (!rfqTitle.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    createMut.mutate({ itemIds: [...selectedIds], title: rfqTitle });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Create RFQ from Approved PR Items</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Select items from approved PRs to create a new RFQ</p>
        </div>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={selectedIds.size === 0}
          className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Create RFQ ({selectedIds.size})
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search items..."
          value={prSearch}
          onChange={(e) => { setPrSearch(e.target.value); setPrPage(1); }}
          className="max-w-xs h-9"
        />
      </div>

      <div className="border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
              <th className="px-3 py-2.5 w-[40px]">
                <input type="checkbox" checked={prItems.length > 0 && selectedIds.size === prItems.length} onChange={toggleAll} className="rounded" />
              </th>
              <th className="text-left px-3 py-2.5">Request #</th>
              <th className="text-left px-3 py-2.5">PR Title</th>
              <th className="text-left px-3 py-2.5">Product</th>
              <th className="text-left px-3 py-2.5">Vendor</th>
              <th className="text-center px-3 py-2.5 w-[70px]">Qty</th>
              <th className="text-right px-3 py-2.5 w-[100px]">Unit Price</th>
              <th className="text-right px-3 py-2.5 w-[100px]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading...</td></tr>
            ) : prItems.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No approved PR items found</td></tr>
            ) : prItems.map((item: any) => (
              <tr key={item.id} className={cn('border-t border-border/50 transition-colors cursor-pointer', selectedIds.has(item.id) ? 'bg-primary/5' : 'hover:bg-accent/30')} onClick={() => toggleItem(item.id)}>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)} className="rounded" />
                </td>
                <td className="px-3 py-2.5 font-mono text-xs font-medium text-primary">{item.purchaseRequest?.requestNumber || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{item.purchaseRequest?.title || '—'}</td>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{item.product?.name || item.description || '—'}</p>
                  {item.product?.sku && <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>}
                </td>
                <td className="px-3 py-2.5 text-xs">{item.vendor?.name || '—'}</td>
                <td className="px-3 py-2.5 text-center font-mono text-xs">{item.quantity}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">{formatCurrency(item.estimatedPrice || 0)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-medium">{formatCurrency((item.estimatedPrice || 0) * (item.quantity || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {prTotal > 20 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {(prPage - 1) * 20 + 1}–{Math.min(prPage * 20, prTotal)} of {prTotal}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={prPage === 1} onClick={() => setPrPage(prPage - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={prPage * 20 >= prTotal} onClick={() => setPrPage(prPage + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm p-0 gap-0">
          <div className="px-5 pt-5 pb-3">
            <DialogTitle className="text-sm font-semibold">Create RFQ from PR Items</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">{selectedIds.size} item{selectedIds.size === 1 ? '' : 's'} selected</p>
          </div>
          <div className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">RFQ Title <span className="text-red-500">*</span></Label>
              <Input value={rfqTitle} onChange={(e) => setRfqTitle(e.target.value)} placeholder="e.g. Office Supplies Q2 2026" className="h-9" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90" onClick={handleCreate} disabled={!rfqTitle.trim() || createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Create RFQ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function RFQPage() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['rfqs', page, search, statusFilter],
    queryFn: () => api.get('/rfq', { params: { page, limit: 10, search, ...(statusFilter && { status: statusFilter }) } }),
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;

  const form = useForm<RFQFormData>({
    resolver: zodResolver(rfqSchema),
    mode: 'onChange',
    defaultValues: { title: '', description: '', deadline: null, notes: '', items: [{ description: '', quantity: 1, unit: 'pcs' }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/rfq', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rfqs'] }); setModalOpen(false); toast({ title: 'RFQ created' }); },
    onError: () => toast({ title: 'Failed to create', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/rfq/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rfqs'] }); setModalOpen(false); toast({ title: 'RFQ updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/rfq/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rfqs'] }); setDeleteTarget(null); toast({ title: 'RFQ deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.put(`/rfq/${id}/${action}`),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      toast({ title: `RFQ ${vars.action === 'publish' ? 'published' : 'closed'}` });
    },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ title: '', description: '', deadline: null, notes: '', items: [{ description: '', quantity: 1, unit: 'pcs' }] });
    setModalOpen(true);
  };

  const openEdit = (rfq: any) => {
    setEditing(rfq);
    form.reset({
      title: rfq.title, description: rfq.description || '', deadline: rfq.deadline ? new Date(rfq.deadline) : null,
      notes: rfq.notes || '',
      items: rfq.items?.map((i: any) => ({ description: i.description, quantity: i.quantity, unit: i.unit })) || [{ description: '', quantity: 1, unit: 'pcs' }],
    });
    setModalOpen(true);
  };

  const onSubmit = (data: RFQFormData) => {
    const payload = { ...data, deadline: data.deadline?.toISOString() };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const columns = [
    { key: 'rfqNumber', label: 'RFQ #', sortable: true, render: (v: string) => <span className="font-medium font-mono text-primary">{v}</span> },
    { key: 'title', label: 'Title', sortable: true },
    { key: 'createdByName', label: 'Created By', render: (v: string) => v || '—' },
    { key: '_count', label: 'Items', render: (_: any, row: any) => row._count?.items ?? 0 },
    { key: 'quotes', label: 'Quotes', render: (_: any, row: any) => row._count?.quotes ?? 0 },
    { key: 'deadline', label: 'Deadline', render: (v: string) => v ? formatDate(v) : '—' },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'createdAt', label: 'Created', sortable: true, render: (v: string) => formatDate(v) },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.status === 'DRAFT' && (
            <>
              <button onClick={() => actionMut.mutate({ id: row.id, action: 'publish' })} className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600" title="Publish"><Send className="h-3.5 w-3.5" /></button>
              <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
          {row.status === 'PUBLISHED' && (
            <button onClick={() => actionMut.mutate({ id: row.id, action: 'close' })} className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600" title="Close"><Lock className="h-3.5 w-3.5" /></button>
          )}
        </div>
      ),
    },
  ];

  const statusFilters = ['', 'DRAFT', 'PUBLISHED', 'CLOSED', 'AWARDED', 'CANCELLED'];
  const statusLabels: Record<string, string> = { '': 'All', DRAFT: 'Draft', PUBLISHED: 'Published', CLOSED: 'Closed', AWARDED: 'Awarded', CANCELLED: 'Cancelled' };

  return (
    <div className="space-y-6">
      <PageHeader title="Request for Quotation" description="Create RFQs, collect and compare vendor quotes">
        <Button onClick={openCreate} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> New RFQ
        </Button>
      </PageHeader>

      <Tabs defaultValue="rfqs" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger value="rfqs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">RFQs</TabsTrigger>
          <TabsTrigger value="from-prs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Create from PRs</TabsTrigger>
        </TabsList>

        <TabsContent value="rfqs" className="mt-5 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total RFQs" value={total} icon={<FileSearch className="h-5 w-5" />} />
            <StatCard title="Published" value={items.filter((i: any) => i.status === 'PUBLISHED').length} icon={<Send className="h-5 w-5" />} />
            <StatCard title="Awarded" value={items.filter((i: any) => i.status === 'AWARDED').length} icon={<Trophy className="h-5 w-5" />} />
            <StatCard title="Pending Close" value={items.filter((i: any) => i.status === 'CLOSED').length} icon={<Clock className="h-5 w-5" />} />
          </div>

          <DataTable
            columns={columns} data={items} total={total} page={page} limit={10}
            onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search RFQs..."
            isLoading={isLoading} emptyMessage="No RFQs found"
            onRowClick={(row: any) => router.push(`/rfq/${row.id}`)}
            toolbar={
              <div className="flex items-center gap-1.5">
                {statusFilters.map((s) => (
                  <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="from-prs" className="mt-5">
          <CreateFromPRs />
        </TabsContent>
      </Tabs>

      {/* Create/Edit RFQ Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit RFQ' : 'New RFQ'}</DialogTitle>
          </DialogHeader>
          <form id="rfq-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Title <span className="text-red-500">*</span></Label>
                <Input {...form.register('title')} className={cn('h-9 rounded-lg', form.formState.errors.title && 'border-red-300')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Deadline</Label>
                <Controller control={form.control} name="deadline" render={({ field }) => (
                  <DatePicker value={field.value || undefined} onChange={(d) => field.onChange(d)} />
                )} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Description</Label>
              <Textarea {...form.register('description')} className="rounded-lg" rows={2} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-semibold">Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unit: 'pcs' })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start p-3 bg-muted/30 rounded-lg">
                  <div className="col-span-6 space-y-1">
                    {index === 0 && <Label className="text-[11px] text-muted-foreground">Description</Label>}
                    <Input {...form.register(`items.${index}.description`)} className="h-9 rounded-lg" placeholder="Item description" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-[11px] text-muted-foreground">Qty</Label>}
                    <Input type="number" min={1} {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} className="h-9 rounded-lg" />
                  </div>
                  <div className="col-span-3 space-y-1">
                    {index === 0 && <Label className="text-[11px] text-muted-foreground">Unit</Label>}
                    <Input {...form.register(`items.${index}.unit`)} className="h-9 rounded-lg" />
                  </div>
                  <div className="col-span-1">
                    {index === 0 && <Label className="text-[11px]">&nbsp;</Label>}
                    {fields.length > 1 && <button type="button" onClick={() => remove(index)} className="h-9 flex items-center text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="rfq-form" className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90" disabled={!form.formState.isValid || createMut.isPending || updateMut.isPending}>
              {editing ? 'Update RFQ' : 'Create RFQ'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete RFQ" description={`Delete ${deleteTarget?.rfqNumber}?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
    </div>
  );
}
