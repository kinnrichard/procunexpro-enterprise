'use client';

import { useState } from 'react';
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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  FileSearch, Plus, Pencil, Trash2, Send, Lock, Trophy, Eye,
  X, Clock, Building2, BarChart3,
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

const quoteSchema = z.object({
  vendorId: z.string().min(1, 'Vendor required'),
  leadTime: z.coerce.number().optional(),
  validUntil: z.date().optional().nullable(),
  notes: z.string().optional(),
  items: z.array(z.object({
    rfqItemId: z.string(),
    unitPrice: z.coerce.number().min(0),
  })),
});

type RFQFormData = z.infer<typeof rfqSchema>;
type QuoteFormData = z.infer<typeof quoteSchema>;

export default function RFQPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [detailRfq, setDetailRfq] = useState<any>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [compareView, setCompareView] = useState(false);

  const { data: response, isLoading } = useQuery({
    queryKey: ['rfqs', page, search, statusFilter],
    queryFn: () => api.get('/rfq', { params: { page, limit: 10, search, ...(statusFilter && { status: statusFilter }) } }),
  });

  const { data: detailData } = useQuery({
    queryKey: ['rfq-detail', detailRfq?.id],
    queryFn: () => api.get(`/rfq/${detailRfq.id}`),
    enabled: !!detailRfq,
  });

  const { data: compareData } = useQuery({
    queryKey: ['rfq-compare', detailRfq?.id],
    queryFn: () => api.get(`/rfq/${detailRfq.id}/compare`),
    enabled: !!detailRfq && compareView,
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendors-approved'],
    queryFn: () => api.get('/vendors', { params: { limit: 1000, status: 'APPROVED' } }),
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const detail = detailData?.data;
  const comparison = compareData?.data;
  const vendors = (vendorData?.data?.data || []).map((v: any) => ({ value: v.id, label: v.name }));

  const form = useForm<RFQFormData>({
    resolver: zodResolver(rfqSchema),
    mode: 'onChange',
    defaultValues: { title: '', description: '', deadline: null, notes: '', items: [{ description: '', quantity: 1, unit: 'pcs' }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  const quoteForm = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    mode: 'onChange',
  });

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
      queryClient.invalidateQueries({ queryKey: ['rfq-detail'] });
      toast({ title: `RFQ ${vars.action === 'publish' ? 'published' : 'closed'}` });
    },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  });

  const addQuoteMut = useMutation({
    mutationFn: (data: any) => api.post(`/rfq/${detailRfq.id}/quotes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfq-detail'] });
      queryClient.invalidateQueries({ queryKey: ['rfq-compare'] });
      setQuoteModalOpen(false);
      toast({ title: 'Quote added' });
    },
    onError: () => toast({ title: 'Failed to add quote', variant: 'destructive' }),
  });

  const awardMut = useMutation({
    mutationFn: (quoteId: string) => api.put(`/rfq/${detailRfq.id}/award/${quoteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['rfq-detail'] });
      toast({ title: 'Quote awarded' });
    },
    onError: () => toast({ title: 'Failed to award', variant: 'destructive' }),
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

  const openQuoteModal = () => {
    if (!detail?.items) return;
    quoteForm.reset({
      vendorId: '', leadTime: undefined, validUntil: null, notes: '',
      items: detail.items.map((i: any) => ({ rfqItemId: i.id, unitPrice: 0 })),
    });
    setQuoteModalOpen(true);
  };

  const onSubmit = (data: RFQFormData) => {
    const payload = { ...data, deadline: data.deadline?.toISOString() };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const onQuoteSubmit = (data: QuoteFormData) => {
    const payload = { ...data, validUntil: data.validUntil?.toISOString() };
    addQuoteMut.mutate(payload);
  };

  const columns = [
    { key: 'rfqNumber', label: 'RFQ #', sortable: true, render: (v: string) => <span className="font-medium font-mono text-primary">{v}</span> },
    { key: 'title', label: 'Title', sortable: true },
    { key: '_count', label: 'Items', render: (_: any, row: any) => row._count?.items ?? 0 },
    { key: 'quotes', label: 'Quotes', render: (_: any, row: any) => row._count?.quotes ?? 0 },
    { key: 'deadline', label: 'Deadline', render: (v: string) => v ? formatDate(v) : '—' },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'createdAt', label: 'Created', sortable: true, render: (v: string) => formatDate(v) },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        <button type="button" className="flex items-center gap-1" onClick={e => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
          <button onClick={() => { setDetailRfq(row); setCompareView(false); }} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="View"><Eye className="h-3.5 w-3.5" /></button>
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
        </button>
      ),
    },
  ];

  const statusFilters = ['', 'DRAFT', 'PUBLISHED', 'CLOSED', 'AWARDED'];
  const statusLabels: Record<string, string> = { '': 'All', DRAFT: 'Draft', PUBLISHED: 'Published', CLOSED: 'Closed', AWARDED: 'Awarded' };

  return (
    <div className="space-y-6">
      <PageHeader title="Request for Quotation" description="Create RFQs, collect and compare vendor quotes">
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> New RFQ
        </Button>
      </PageHeader>

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
        toolbar={
          <div className="flex items-center gap-1.5">
            {statusFilters.map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                {statusLabels[s]}
              </button>
            ))}
          </div>
        }
      />

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
            <Button type="submit" form="rfq-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMut.isPending || updateMut.isPending}>
              {editing ? 'Update RFQ' : 'Create RFQ'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* RFQ Detail Modal */}
      <Dialog open={!!detailRfq} onOpenChange={() => { setDetailRfq(null); setCompareView(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{detail?.title || 'RFQ Details'}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{detail?.rfqNumber} <StatusBadge status={detail?.status || ''} /></p>
              </div>
              <div className="flex gap-2">
                {(detail?.status === 'PUBLISHED' || detail?.status === 'CLOSED') && (
                  <Button size="sm" variant="outline" onClick={openQuoteModal}><Plus className="h-3.5 w-3.5 mr-1" /> Add Quote</Button>
                )}
                {detail?.quotes?.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setCompareView(!compareView)}>
                    <BarChart3 className="h-3.5 w-3.5 mr-1" /> {compareView ? 'Details' : 'Compare'}
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {compareView ? (
              /* Compare View */
              <div>
                <h4 className="text-sm font-semibold mb-2">Quote Comparison</h4>
                {comparison ? (
                  <div className="border rounded-lg overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                          <th className="text-left px-4 py-2 sticky left-0 bg-muted/50">Item</th>
                          <th className="text-right px-4 py-2">Qty</th>
                          {comparison.vendors?.map((v: any) => (
                            <th key={v.vendorId} className="text-right px-4 py-2 min-w-[120px]">{v.vendorName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.items?.map((item: any) => {
                          const prices = comparison.vendors?.map((v: any) => {
                            const qi = item.quotes?.find((q: any) => q.vendorId === v.vendorId);
                            return qi?.unitPrice ?? null;
                          }) || [];
                          const validPrices = prices.filter((p: any) => p !== null);
                          const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

                          return (
                            <tr key={item.rfqItemId} className="border-t border-border/50">
                              <td className="px-4 py-2.5 sticky left-0 bg-background font-medium">{item.description}</td>
                              <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                              {prices.map((price: any, i: number) => (
                                <td key={comparison.vendors[i]?.vendorId ?? `price-col-${i}`} className={cn('px-4 py-2.5 text-right font-medium', price === minPrice && price !== null && 'text-green-600 font-bold')}>
                                  {price === null ? '—' : formatCurrency(price)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                        <tr className="border-t-2 border-border font-bold bg-muted/30">
                          <td className="px-4 py-2.5 sticky left-0 bg-muted/30">Total</td>
                          <td className="px-4 py-2.5"></td>
                          {comparison.vendors?.map((v: any) => (
                            <td key={v.vendorId} className="px-4 py-2.5 text-right">{formatCurrency(v.totalAmount || 0)}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Loading comparison...</div>
                )}
              </div>
            ) : (
              <>
                {/* Items */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Requested Items</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                        <th className="text-left px-4 py-2">#</th>
                        <th className="text-left px-4 py-2">Description</th>
                        <th className="text-right px-4 py-2">Qty</th>
                        <th className="text-left px-4 py-2">Unit</th>
                      </tr></thead>
                      <tbody>
                        {detail?.items?.map((item: any, i: number) => (
                          <tr key={item.id} className="border-t border-border/50">
                            <td className="px-4 py-2.5">{i + 1}</td>
                            <td className="px-4 py-2.5">{item.description}</td>
                            <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                            <td className="px-4 py-2.5">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Quotes */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Vendor Quotes ({detail?.quotes?.length || 0})</h4>
                  {detail?.quotes?.length > 0 ? (
                    <div className="grid gap-3">
                      {detail.quotes.map((quote: any) => (
                        <Card key={quote.id} className={cn(quote.isAwarded && 'ring-2 ring-green-500')}>
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Building2 className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    {quote.vendor?.name || 'Unknown'}
                                    {quote.isAwarded && <Badge variant="default" className="bg-green-600 text-xs">Awarded</Badge>}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Lead time: {quote.leadTime || '—'} days
                                    {quote.validUntil && ` | Valid until: ${formatDate(quote.validUntil)}`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold">{formatCurrency(quote.totalAmount)}</span>
                                {detail.status === 'CLOSED' && !detail.quotes.some((q: any) => q.isAwarded) && (
                                  <Button size="sm" variant="outline" onClick={() => awardMut.mutate(quote.id)} className="text-green-600 border-green-300 hover:bg-green-50">
                                    <Trophy className="h-3.5 w-3.5 mr-1" /> Award
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">No quotes received yet</div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Quote Modal */}
      <Dialog open={quoteModalOpen} onOpenChange={setQuoteModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>Add Vendor Quote</DialogTitle>
          </DialogHeader>
          <form id="quote-form" onSubmit={quoteForm.handleSubmit(onQuoteSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Vendor <span className="text-red-500">*</span></Label>
                <Controller control={quoteForm.control} name="vendorId" render={({ field }) => (
                  <SearchableSelect options={vendors} value={field.value} onChange={field.onChange} placeholder="Select vendor" />
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Lead Time (days)</Label>
                <Input type="number" min={0} {...quoteForm.register('leadTime', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Valid Until</Label>
                <Controller control={quoteForm.control} name="validUntil" render={({ field }) => (
                  <DatePicker value={field.value || undefined} onChange={(d) => field.onChange(d)} />
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Notes</Label>
                <Input {...quoteForm.register('notes')} className="h-9 rounded-lg" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">Item Pricing</Label>
              {detail?.items?.map((item: any, index: number) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-3 bg-muted/30 rounded-lg">
                  <div className="col-span-6 text-sm">
                    <span className="font-medium">{item.description}</span>
                    <span className="text-muted-foreground ml-2">({item.quantity} {item.unit})</span>
                  </div>
                  <div className="col-span-3">
                    <Input type="number" min={0} step="0.01" {...quoteForm.register(`items.${index}.unitPrice`, { valueAsNumber: true })} className="h-9 rounded-lg" placeholder="Unit price" />
                  </div>
                  <div className="col-span-3 text-sm font-medium text-right">
                    {formatCurrency((quoteForm.watch(`items.${index}.unitPrice`) || 0) * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setQuoteModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="quote-form" className="bg-gradient-primary text-white" disabled={addQuoteMut.isPending}>
              {addQuoteMut.isPending ? 'Adding...' : 'Add Quote'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete RFQ" description={`Delete ${deleteTarget?.rfqNumber}?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
    </div>
  );
}
