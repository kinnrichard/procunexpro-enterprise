'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

import { useToast } from '@/components/ui/use-toast';
import { GitBranch, Plus, Pencil, Trash2, Eye, X, ArrowDown, CheckCircle, XCircle } from 'lucide-react';

const roles = ['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'WAREHOUSE_STAFF', 'FINANCE_OFFICER'];
const entityTypes = ['PURCHASE_REQUEST', 'PURCHASE_ORDER'];

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PROCUREMENT_OFFICER: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  WAREHOUSE_STAFF: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  FINANCE_OFFICER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const workflowSchema = z.object({
  name: z.string().min(2, 'Name required'),
  entityType: z.string().min(1, 'Entity type required'),
  minAmount: z.coerce.number().optional().nullable(),
  maxAmount: z.coerce.number().optional().nullable(),
  rules: z.array(z.object({
    stepOrder: z.coerce.number().min(1),
    role: z.string().min(1, 'Role required'),
    isRequired: z.boolean(),
  })).min(1, 'At least one approval step required'),
});

type WorkflowFormData = z.infer<typeof workflowSchema>;

export default function WorkflowsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [detailWorkflow, setDetailWorkflow] = useState<any>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['workflows', page, search],
    queryFn: () => api.get('/workflows', { params: { page, limit: 10, search } }),
  });

  const { data: detailData } = useQuery({
    queryKey: ['workflow-detail', detailWorkflow?.id],
    queryFn: () => api.get(`/workflows/${detailWorkflow.id}`),
    enabled: !!detailWorkflow,
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const detail = detailData?.data;

  const form = useForm<WorkflowFormData>({
    resolver: zodResolver(workflowSchema),
    mode: 'onChange',
    defaultValues: { name: '', entityType: 'PURCHASE_REQUEST', minAmount: null, maxAmount: null, rules: [{ stepOrder: 1, role: 'MANAGER', isRequired: true }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rules' });

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/workflows', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); setModalOpen(false); toast({ title: 'Workflow created' }); },
    onError: () => toast({ title: 'Failed to create', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/workflows/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); setModalOpen(false); toast({ title: 'Workflow updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/workflows/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); setDeleteTarget(null); toast({ title: 'Workflow deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.put(`/workflows/${id}/${action}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); toast({ title: 'Workflow updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', entityType: 'PURCHASE_REQUEST', minAmount: null, maxAmount: null, rules: [{ stepOrder: 1, role: 'MANAGER', isRequired: true }] });
    setModalOpen(true);
  };

  const openEdit = (wf: any) => {
    setEditing(wf);
    form.reset({
      name: wf.name, entityType: wf.entityType, minAmount: wf.minAmount, maxAmount: wf.maxAmount,
      rules: wf.rules?.map((r: any) => ({ stepOrder: r.stepOrder, role: r.role, isRequired: r.isRequired })) || [{ stepOrder: 1, role: 'MANAGER', isRequired: true }],
    });
    setModalOpen(true);
  };

  const onSubmit = (data: WorkflowFormData) => {
    const payload = { ...data, minAmount: data.minAmount || null, maxAmount: data.maxAmount || null };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true, render: (v: string) => <span className="font-medium">{v}</span> },
    {
      key: 'entityType', label: 'Applies To', render: (v: string) => (
        <Badge variant="outline" className="font-mono text-xs">{v.replaceAll('_', ' ')}</Badge>
      ),
    },
    {
      key: 'minAmount', label: 'Amount Range', render: (_: any, row: any) => {
        if (!row.minAmount && !row.maxAmount) return <span className="text-muted-foreground text-xs">Any amount</span>;
        const min = row.minAmount ? `$${row.minAmount.toLocaleString()}` : '$0';
        const max = row.maxAmount ? `$${row.maxAmount.toLocaleString()}` : 'No limit';
        return <span className="text-xs">{min} — {max}</span>;
      },
    },
    { key: '_count', label: 'Steps', render: (_: any, row: any) => row._count?.rules ?? row.rules?.length ?? 0 },
    { key: 'isActive', label: 'Status', render: (v: boolean) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        <button type="button" className="flex items-center gap-1" onClick={e => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
          <button onClick={() => setDetailWorkflow(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="View"><Eye className="h-3.5 w-3.5" /></button>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          <button
            onClick={() => toggleMut.mutate({ id: row.id, action: row.isActive ? 'deactivate' : 'activate' })}
            className={cn('p-1.5 rounded-md', row.isActive ? 'hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600' : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600')}
            title={row.isActive ? 'Deactivate' : 'Activate'}
          >
            {row.isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Approval Workflows" description="Configure multi-step approval chains for PRs and POs">
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> New Workflow
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Workflows" value={total} icon={<GitBranch className="h-5 w-5" />} />
        <StatCard title="Active" value={items.filter((i: any) => i.isActive).length} icon={<CheckCircle className="h-5 w-5" />} />
        <StatCard title="For PRs" value={items.filter((i: any) => i.entityType === 'PURCHASE_REQUEST').length} icon={<GitBranch className="h-5 w-5" />} />
        <StatCard title="For POs" value={items.filter((i: any) => i.entityType === 'PURCHASE_ORDER').length} icon={<GitBranch className="h-5 w-5" />} />
      </div>

      <DataTable columns={columns} data={items} total={total} page={page} limit={10} onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search workflows..." isLoading={isLoading} emptyMessage="No workflows configured" />

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Workflow' : 'New Workflow'}</DialogTitle>
          </DialogHeader>
          <form id="wf-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Name <span className="text-red-500">*</span></Label>
                <Input {...form.register('name')} className={cn('h-9 rounded-lg', form.formState.errors.name && 'border-red-300')} placeholder="e.g. Standard PR Approval" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Applies To <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="entityType" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {entityTypes.map(t => <SelectItem key={t} value={t}>{t.replaceAll('_', ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Min Amount (optional)</Label>
                <Input type="number" min={0} step="0.01" {...form.register('minAmount', { setValueAs: v => v === '' ? null : Number(v) })} className="h-9 rounded-lg" placeholder="No minimum" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Max Amount (optional)</Label>
                <Input type="number" min={0} step="0.01" {...form.register('maxAmount', { setValueAs: v => v === '' ? null : Number(v) })} className="h-9 rounded-lg" placeholder="No maximum" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-semibold">Approval Steps</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ stepOrder: fields.length + 1, role: 'MANAGER', isRequired: true })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
                </Button>
              </div>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {index + 1}
                    </div>
                    {index > 0 && <ArrowDown className="h-3 w-3 text-muted-foreground shrink-0 -ml-1 -mt-8 absolute" />}
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <Controller control={form.control} name={`rules.${index}.role`} render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {roles.map(r => <SelectItem key={r} value={r}>{r.replaceAll('_', ' ')}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Controller control={form.control} name={`rules.${index}.isRequired`} render={({ field: f }) => (
                          <Switch checked={f.value} onCheckedChange={f.onChange} />
                        )} />
                        <Label className="text-xs text-muted-foreground">Required</Label>
                      </div>
                      <input type="hidden" {...form.register(`rules.${index}.stepOrder`, { value: index + 1 })} />
                    </div>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 shrink-0"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="wf-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMut.isPending || updateMut.isPending}>
              {editing ? 'Update Workflow' : 'Create Workflow'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailWorkflow} onOpenChange={() => setDetailWorkflow(null)}>
        <DialogContent className="max-w-md p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{detail?.name || 'Workflow'}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Type:</span> {detail?.entityType?.replaceAll('_', ' ')}</div>
              <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={detail?.isActive ? 'ACTIVE' : 'INACTIVE'} /></div>
              <div><span className="text-muted-foreground">Min:</span> {detail?.minAmount ? `$${detail.minAmount.toLocaleString()}` : 'Any'}</div>
              <div><span className="text-muted-foreground">Max:</span> {detail?.maxAmount ? `$${detail.maxAmount.toLocaleString()}` : 'Any'}</div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Approval Chain</h4>
              <div className="space-y-0">
                {detail?.rules?.sort((a: any, b: any) => a.stepOrder - b.stepOrder).map((rule: any, i: number) => (
                  <div key={rule.id}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{rule.stepOrder}</div>
                      <div className="flex-1">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', roleColors[rule.role] || 'bg-gray-100 text-gray-600')}>
                          {rule.role.replaceAll('_', ' ')}
                        </span>
                        {rule.isRequired && <span className="ml-2 text-xs text-muted-foreground">(Required)</span>}
                        {!rule.isRequired && <span className="ml-2 text-xs text-muted-foreground">(Optional)</span>}
                      </div>
                    </div>
                    {i < (detail?.rules?.length || 0) - 1 && (
                      <div className="ml-4 h-6 border-l-2 border-dashed border-muted-foreground/30" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Workflow" description={`Delete "${deleteTarget?.name}"?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
    </div>
  );
}
