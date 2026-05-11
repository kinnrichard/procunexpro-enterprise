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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Wallet, Plus, Pencil, Trash2, Play, Square, X, DollarSign, PieChart } from 'lucide-react';

const budgetSchema = z.object({
  name: z.string().min(2, 'Name required'),
  fiscalYear: z.coerce.number().min(2020).max(2050),
  period: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  totalAmount: z.coerce.number().min(0),
  startDate: z.date({ required_error: 'Start date required' }),
  endDate: z.date({ required_error: 'End date required' }),
  notes: z.string().optional(),
  allocations: z.array(z.object({
    departmentId: z.string().optional(),
    categoryId: z.string().optional(),
    amount: z.coerce.number().min(0),
    notes: z.string().optional(),
  })),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

export default function BudgetsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [detailBudget, setDetailBudget] = useState<any>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['budgets', page, search, statusFilter],
    queryFn: () => api.get('/budgets', { params: { page, limit: 10, search, ...(statusFilter && { status: statusFilter }) } }),
  });

  const { data: detailData } = useQuery({
    queryKey: ['budget-detail', detailBudget?.id],
    queryFn: () => api.get(`/budgets/${detailBudget.id}`),
    enabled: !!detailBudget,
  });

  const { data: deptData } = useQuery({ queryKey: ['departments-all'], queryFn: () => api.get('/departments', { params: { limit: 1000 } }) });
  const { data: catData } = useQuery({ queryKey: ['categories-all'], queryFn: () => api.get('/categories', { params: { limit: 1000 } }) });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const departments = (deptData?.data?.data || []).map((d: any) => ({ value: d.id, label: d.name }));
  const categories = (catData?.data?.data || []).map((c: any) => ({ value: c.id, label: c.name }));
  const detail = detailData?.data;

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    mode: 'onChange',
    defaultValues: { name: '', fiscalYear: new Date().getFullYear(), period: 'YEARLY', totalAmount: 0, startDate: undefined as any, endDate: undefined as any, notes: '', allocations: [] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'allocations' });

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/budgets', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); setModalOpen(false); toast({ title: 'Budget created' }); },
    onError: () => toast({ title: 'Failed to create', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/budgets/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); setModalOpen(false); toast({ title: 'Budget updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); setDeleteTarget(null); toast({ title: 'Budget deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.put(`/budgets/${id}/${action}`),
    onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); toast({ title: `Budget ${vars.action}d` }); },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', fiscalYear: new Date().getFullYear(), period: 'YEARLY', totalAmount: 0, startDate: undefined as any, endDate: undefined as any, notes: '', allocations: [] });
    setModalOpen(true);
  };

  const openEdit = (b: any) => {
    setEditing(b);
    form.reset({
      name: b.name, fiscalYear: b.fiscalYear, period: b.period, totalAmount: b.totalAmount,
      startDate: new Date(b.startDate), endDate: new Date(b.endDate), notes: b.notes || '',
      allocations: b.allocations?.map((a: any) => ({ departmentId: a.departmentId || '', categoryId: a.categoryId || '', amount: a.amount, notes: a.notes || '' })) || [],
    });
    setModalOpen(true);
  };

  const onSubmit = (data: BudgetFormData) => {
    const payload = { ...data, startDate: data.startDate.toISOString(), endDate: data.endDate.toISOString() };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true, render: (v: string) => <span className="font-medium">{v}</span> },
    { key: 'fiscalYear', label: 'Year', sortable: true },
    { key: 'period', label: 'Period', render: (v: string) => <span className="text-xs font-medium text-muted-foreground">{v}</span> },
    { key: 'totalAmount', label: 'Budget', sortable: true, render: (v: number) => formatCurrency(v) },
    {
      key: 'spentAmount', label: 'Spent', render: (v: number, row: any) => {
        const pct = row.totalAmount > 0 ? (v / row.totalAmount) * 100 : 0;
        let pctClass = 'text-muted-foreground';
        if (pct > 90) pctClass = 'text-red-600';
        else if (pct > 75) pctClass = 'text-amber-600';
        return (
          <div className="space-y-1 min-w-[120px]">
            <div className="flex justify-between text-xs">
              <span>{formatCurrency(v)}</span>
              <span className={cn(pctClass)}>{pct.toFixed(0)}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        );
      },
    },
    { key: 'startDate', label: 'Period', render: (_: any, row: any) => `${formatDate(row.startDate)} - ${formatDate(row.endDate)}` },
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
            <button onClick={() => actionMut.mutate({ id: row.id, action: 'close' })} className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600" title="Close"><Square className="h-3.5 w-3.5" /></button>
          )}
        </button>
      ),
    },
  ];

  const statusFilters = ['', 'DRAFT', 'ACTIVE', 'CLOSED', 'OVERSPENT'];
  const statusLabels: Record<string, string> = { '': 'All', DRAFT: 'Draft', ACTIVE: 'Active', CLOSED: 'Closed', OVERSPENT: 'Overspent' };

  const totalBudget = items.reduce((s: number, i: any) => s + i.totalAmount, 0);
  const totalSpent = items.reduce((s: number, i: any) => s + i.spentAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Budgets" description="Manage fiscal budgets and allocations">
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> New Budget
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Budgets" value={total} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Total Budget" value={formatCurrency(totalBudget)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Total Spent" value={formatCurrency(totalSpent)} icon={<PieChart className="h-5 w-5" />} />
        <StatCard title="Active" value={items.filter((i: any) => i.status === 'ACTIVE').length} icon={<Wallet className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={page}
        limit={10}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search budgets..."
        isLoading={isLoading}
        emptyMessage="No budgets found"
        onRowClick={(row: any) => setDetailBudget(row)}
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

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Budget' : 'New Budget'}</DialogTitle>
          </DialogHeader>
          <form id="budget-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Name <span className="text-red-500">*</span></Label>
                <Input {...form.register('name')} className={cn('h-9 rounded-lg', form.formState.errors.name && 'border-red-300')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Fiscal Year <span className="text-red-500">*</span></Label>
                <Input type="number" {...form.register('fiscalYear', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Period</Label>
                <Controller control={form.control} name="period" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['MONTHLY', 'QUARTERLY', 'YEARLY'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Total Budget <span className="text-red-500">*</span></Label>
                <Input type="number" min={0} step="0.01" {...form.register('totalAmount', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Notes</Label>
                <Input {...form.register('notes')} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-semibold">Budget Allocations</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ departmentId: '', categoryId: '', amount: 0, notes: '' })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Allocation
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start p-3 bg-muted/30 rounded-lg">
                  <div className="col-span-4 space-y-1">
                    {index === 0 && <Label className="text-[11px] text-muted-foreground">Department</Label>}
                    <Controller control={form.control} name={`allocations.${index}.departmentId`} render={({ field: f }) => (
                      <SearchableSelect options={departments} value={f.value || ''} onChange={f.onChange} placeholder="Any" />
                    )} />
                  </div>
                  <div className="col-span-4 space-y-1">
                    {index === 0 && <Label className="text-[11px] text-muted-foreground">Category</Label>}
                    <Controller control={form.control} name={`allocations.${index}.categoryId`} render={({ field: f }) => (
                      <SearchableSelect options={categories} value={f.value || ''} onChange={f.onChange} placeholder="Any" />
                    )} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    {index === 0 && <Label className="text-[11px] text-muted-foreground">Amount</Label>}
                    <Input type="number" min={0} step="0.01" {...form.register(`allocations.${index}.amount`, { valueAsNumber: true })} className="h-9 rounded-lg" />
                  </div>
                  <div className="col-span-1">
                    {index === 0 && <Label className="text-[11px] text-muted-foreground">&nbsp;</Label>}
                    <button type="button" onClick={() => remove(index)} className="h-9 flex items-center text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="budget-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMut.isPending || updateMut.isPending}>
              {editing ? 'Update Budget' : 'Create Budget'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailBudget} onOpenChange={() => setDetailBudget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{detail?.name || 'Budget Details'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {detail && (
              <>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Year:</span> {detail.fiscalYear}</div>
                  <div><span className="text-muted-foreground">Period:</span> {detail.period}</div>
                  <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={detail.status} /></div>
                  <div><span className="text-muted-foreground">Budget:</span> {formatCurrency(detail.totalAmount)}</div>
                  <div><span className="text-muted-foreground">Spent:</span> {formatCurrency(detail.spentAmount)}</div>
                  <div><span className="text-muted-foreground">Remaining:</span> {formatCurrency(detail.totalAmount - detail.spentAmount)}</div>
                </div>
                <div>
                  <Progress value={detail.totalAmount > 0 ? (detail.spentAmount / detail.totalAmount) * 100 : 0} className="h-2" />
                </div>
                {detail.allocations?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Allocations</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                          <th className="text-left px-4 py-2">Department</th>
                          <th className="text-left px-4 py-2">Category</th>
                          <th className="text-right px-4 py-2">Allocated</th>
                          <th className="text-right px-4 py-2">Spent</th>
                          <th className="text-right px-4 py-2">%</th>
                        </tr></thead>
                        <tbody>
                          {detail.allocations.map((a: any) => {
                            const pct = a.amount > 0 ? (a.spentAmount / a.amount) * 100 : 0;
                            let pctColor = '';
                            if (pct > 90) pctColor = 'text-red-600';
                            else if (pct > 75) pctColor = 'text-amber-600';
                            return (
                              <tr key={a.id} className="border-t border-border/50">
                                <td className="px-4 py-2.5">{a.department?.name || 'All'}</td>
                                <td className="px-4 py-2.5">{a.category?.name || 'All'}</td>
                                <td className="px-4 py-2.5 text-right">{formatCurrency(a.amount)}</td>
                                <td className="px-4 py-2.5 text-right">{formatCurrency(a.spentAmount)}</td>
                                <td className={cn('px-4 py-2.5 text-right font-medium', pctColor)}>{pct.toFixed(0)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Budget" description={`Delete ${deleteTarget?.name}?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
    </div>
  );
}
