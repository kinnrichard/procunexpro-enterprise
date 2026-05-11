'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
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
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileSignature, Plus, Pencil, Trash2, Play, XCircle, AlertTriangle,
  CheckCircle,
} from 'lucide-react';

const contractSchema = z.object({
  title: z.string().min(2, 'Title required'),
  vendorId: z.string().min(1, 'Vendor required'),
  startDate: z.date({ required_error: 'Start date required' }),
  endDate: z.date({ required_error: 'End date required' }),
  totalValue: z.coerce.number().min(0),
  terms: z.string().optional(),
  autoRenew: z.boolean(),
  renewalNoticeDays: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type ContractFormData = z.infer<typeof contractSchema>;

export default function ContractsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['contracts', page, search, statusFilter],
    queryFn: () => api.get('/contracts', { params: { page, limit: 10, search, ...(statusFilter && { status: statusFilter }) } }),
  });

  const { data: expiringData } = useQuery({
    queryKey: ['contracts-expiring'],
    queryFn: () => api.get('/contracts/expiring'),
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendors-approved'],
    queryFn: () => api.get('/vendors', { params: { limit: 1000, status: 'APPROVED' } }),
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const expiring = expiringData?.data?.data || expiringData?.data || [];
  const vendors = (vendorData?.data?.data || []).map((v: any) => ({ value: v.id, label: v.name }));

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    mode: 'onChange',
    defaultValues: { title: '', vendorId: '', startDate: undefined as any, endDate: undefined as any, totalValue: 0, terms: '', autoRenew: false, renewalNoticeDays: 30, notes: '' },
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/contracts', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contracts'] }); setModalOpen(false); toast({ title: 'Contract created' }); },
    onError: () => toast({ title: 'Failed to create', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/contracts/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contracts'] }); setModalOpen(false); toast({ title: 'Contract updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/contracts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contracts'] }); setDeleteTarget(null); toast({ title: 'Contract deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.put(`/contracts/${id}/${action}`),
    onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['contracts'] }); toast({ title: `Contract ${vars.action}d` }); },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ title: '', vendorId: '', startDate: undefined as any, endDate: undefined as any, totalValue: 0, terms: '', autoRenew: false, renewalNoticeDays: 30, notes: '' });
    setModalOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    form.reset({
      title: c.title, vendorId: c.vendorId, startDate: new Date(c.startDate), endDate: new Date(c.endDate),
      totalValue: c.totalValue, terms: c.terms || '', autoRenew: c.autoRenew, renewalNoticeDays: c.renewalNoticeDays, notes: c.notes || '',
    });
    setModalOpen(true);
  };

  const onSubmit = (data: ContractFormData) => {
    const payload = { ...data, startDate: data.startDate.toISOString(), endDate: data.endDate.toISOString() };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const columns = [
    { key: 'contractNumber', label: 'Contract #', sortable: true, render: (v: string) => <span className="font-medium font-mono text-primary">{v}</span> },
    { key: 'title', label: 'Title', sortable: true },
    { key: 'vendor', label: 'Vendor', render: (_: any, row: any) => row.vendor?.name || '—' },
    { key: 'totalValue', label: 'Value', sortable: true, render: (v: number) => formatCurrency(v) },
    { key: 'startDate', label: 'Start', render: (v: string) => formatDate(v) },
    { key: 'endDate', label: 'End', render: (v: string) => formatDate(v) },
    { key: 'autoRenew', label: 'Renew', render: (v: boolean) => v ? <Badge variant="outline" className="text-xs">Auto</Badge> : '—' },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        <button type="button" className="flex items-center gap-1" onClick={e => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
          {row.status === 'DRAFT' && (
            <>
              <button onClick={() => actionMut.mutate({ id: row.id, action: 'activate' })} className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600" title="Activate"><Play className="h-3.5 w-3.5" /></button>
              <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
          {row.status === 'ACTIVE' && (
            <button onClick={() => actionMut.mutate({ id: row.id, action: 'terminate' })} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Terminate"><XCircle className="h-3.5 w-3.5" /></button>
          )}
        </button>
      ),
    },
  ];

  const statusFilters = ['', 'DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'];
  const statusLabels: Record<string, string> = { '': 'All', DRAFT: 'Draft', ACTIVE: 'Active', EXPIRED: 'Expired', TERMINATED: 'Terminated' };

  return (
    <div className="space-y-6">
      <PageHeader title="Contracts" description="Manage vendor contracts and agreements">
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> New Contract
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Contracts" value={total} icon={<FileSignature className="h-5 w-5" />} />
        <StatCard title="Active" value={items.filter((i: any) => i.status === 'ACTIVE').length} icon={<CheckCircle className="h-5 w-5" />} />
        <StatCard title="Expiring Soon" value={Array.isArray(expiring) ? expiring.length : 0} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="Total Value" value={formatCurrency(items.reduce((s: number, i: any) => s + i.totalValue, 0))} icon={<FileSignature className="h-5 w-5" />} />
      </div>

      {Array.isArray(expiring) && expiring.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> Contracts Expiring Within 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {expiring.slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.title} ({c.contractNumber})</span>
                  <span className="text-muted-foreground">Expires {formatDate(c.endDate)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns} data={items} total={total} page={page} limit={10}
        onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search contracts..."
        isLoading={isLoading} emptyMessage="No contracts found"
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Contract' : 'New Contract'}</DialogTitle>
          </DialogHeader>
          <form id="contract-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Title <span className="text-red-500">*</span></Label>
                <Input {...form.register('title')} className={cn('h-9 rounded-lg', form.formState.errors.title && 'border-red-300')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Vendor <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="vendorId" render={({ field }) => (
                  <SearchableSelect options={vendors} value={field.value} onChange={field.onChange} placeholder="Select vendor" />
                )} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Start Date <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="startDate" render={({ field }) => (
                  <DatePicker value={field.value} onChange={(d) => field.onChange(d)} />
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">End Date <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="endDate" render={({ field }) => (
                  <DatePicker value={field.value} onChange={(d) => field.onChange(d)} />
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Total Value</Label>
                <Input type="number" min={0} step="0.01" {...form.register('totalValue', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Terms & Conditions</Label>
              <Textarea {...form.register('terms')} className="rounded-lg" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Controller control={form.control} name="autoRenew" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
                <Label className="text-[13px]">Auto-Renew</Label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Renewal Notice (days)</Label>
                <Input type="number" min={0} {...form.register('renewalNoticeDays', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea {...form.register('notes')} className="rounded-lg" rows={2} />
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="contract-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMut.isPending || updateMut.isPending}>
              {editing ? 'Update Contract' : 'Create Contract'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Contract" description={`Delete ${deleteTarget?.title}?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
    </div>
  );
}
