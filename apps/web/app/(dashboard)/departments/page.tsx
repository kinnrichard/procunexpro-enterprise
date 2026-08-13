'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
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
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/components/ui/use-toast';
import { Network, Plus, Pencil, Trash2, Users } from 'lucide-react';

const deptSchema = z.object({
  name: z.string().min(2, 'Name required'),
  code: z.string().min(1, 'Code required'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  isActive: z.boolean(),
});

export default function DepartmentsPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Advanced filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterParentId, setFilterParentId] = useState('');
  const [filterCreatedFrom, setFilterCreatedFrom] = useState<Date | undefined>();
  const [filterCreatedTo, setFilterCreatedTo] = useState<Date | undefined>();
  const activeFilterCount = [filterStatus, filterParentId, filterCreatedFrom, filterCreatedTo].filter(Boolean).length;
  const toDateStr = (d?: Date) => (d ? d.toISOString().split('T')[0] : '');
  function clearFilters() {
    setFilterStatus('');
    setFilterParentId('');
    setFilterCreatedFrom(undefined);
    setFilterCreatedTo(undefined);
    setPage(1);
  }

  const { data: response, isLoading } = useQuery({
    queryKey: ['departments', page, search, filterStatus, filterParentId, filterCreatedFrom, filterCreatedTo],
    queryFn: () => api.get('/departments', { params: {
      page, limit: 10, search,
      ...(filterStatus && { status: filterStatus }),
      ...(filterParentId && { parentId: filterParentId }),
      ...(filterCreatedFrom && { createdDateFrom: toDateStr(filterCreatedFrom) }),
      ...(filterCreatedTo && { createdDateTo: toDateStr(filterCreatedTo) }),
    } }),
  });

  const { data: allDepts } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/departments', { params: { limit: 1000 } }),
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const deptOptions = (allDepts?.data?.data || []).map((d: any) => ({ value: d.id, label: d.name }));

  const form = useForm({ resolver: zodResolver(deptSchema), mode: 'onChange', defaultValues: { name: '', code: '', description: '', parentId: '', isActive: true } });

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/departments', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setModalOpen(false); toast({ title: 'Department created' }); },
    onError: () => toast({ title: 'Failed to create', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/departments/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setModalOpen(false); toast({ title: 'Department updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setDeleteTarget(null); toast({ title: 'Department deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const openCreate = () => { setEditing(null); form.reset({ name: '', code: '', description: '', parentId: '', isActive: true }); setModalOpen(true); };
  const openEdit = (dept: any) => { setEditing(dept); form.reset({ name: dept.name, code: dept.code, description: dept.description || '', parentId: dept.parentId || '', isActive: dept.isActive }); setModalOpen(true); };

  const onSubmit = (data: any) => {
    const payload = { ...data, parentId: data.parentId || null };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true, render: (v: string) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Network className="h-4 w-4 text-primary" /></div>
        <span className="font-medium">{v}</span>
      </div>
    ) },
    { key: 'code', label: 'Code', render: (v: string) => <span className="font-mono text-sm">{v}</span> },
    { key: 'description', label: 'Description', render: (v: string) => v || '—', className: 'max-w-[200px] truncate' },
    { key: 'parent', label: 'Parent', render: (_: any, row: any) => row.parent?.name || '—' },
    { key: '_count', label: 'Users', render: (_: any, row: any) => (
      <span className="inline-flex items-center gap-1 text-sm"><Users className="h-3.5 w-3.5 text-muted-foreground" />{row._count?.users ?? 0}</span>
    ) },
    { key: 'isActive', label: 'Status', render: (v: boolean) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {can('departments', 'edit') && <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>}
          {can('departments', 'delete') && <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Departments" description="Manage organizational departments">
        {can('departments', 'create') && (
          <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" /> Add Department
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Departments" value={total} icon={<Network className="h-5 w-5" />} />
        <StatCard title="Active" value={items.filter((i: any) => i.isActive).length} icon={<Network className="h-5 w-5" />} />
        <StatCard title="Top Level" value={items.filter((i: any) => !i.parentId).length} icon={<Network className="h-5 w-5" />} />
      </div>

      <DataTable columns={columns} data={items} total={total} page={page} limit={10} onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search departments..." isLoading={isLoading} emptyMessage="No departments found"
        toolbar={
          <FilterPopover activeCount={activeFilterCount} onClear={clearFilters}>
            <FilterField label="Status">
              <Select value={filterStatus || 'ALL'} onValueChange={(v) => { setFilterStatus(v === 'ALL' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Parent Department">
              <SearchableSelect options={deptOptions} value={filterParentId} onChange={(v) => { setFilterParentId(v); setPage(1); }} placeholder="All parents" />
            </FilterField>
            <FilterField label="Date Created">
              <div className="grid grid-cols-2 gap-2">
                <DatePicker value={filterCreatedFrom} onChange={(d) => { setFilterCreatedFrom(d); setPage(1); }} placeholder="From" className="text-xs" />
                <DatePicker value={filterCreatedTo} onChange={(d) => { setFilterCreatedTo(d); setPage(1); }} placeholder="To" className="text-xs" />
              </div>
            </FilterField>
          </FilterPopover>
        }
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Department' : 'Add Department'}</DialogTitle>
          </DialogHeader>
          <form id="dept-form" onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Name <span className="text-red-500">*</span></Label>
                <Input {...form.register('name')} className={cn('h-9 rounded-lg', form.formState.errors.name && 'border-red-300')} placeholder="e.g., Production" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Code <span className="text-red-500">*</span></Label>
                <Input {...form.register('code')} className={cn('h-9 rounded-lg', form.formState.errors.code && 'border-red-300')} placeholder="e.g., PROD" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Description</Label>
              <Textarea {...form.register('description')} className="rounded-lg" rows={2} placeholder="What this department is responsible for..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Parent Department</Label>
              <Controller control={form.control} name="parentId" render={({ field }) => (
                <SearchableSelect options={deptOptions.filter((d: any) => d.value !== editing?.id)} value={field.value || ''} onChange={field.onChange} placeholder="None (top level)" />
              )} />
            </div>
            <div className="flex items-center gap-3">
              <Controller control={form.control} name="isActive" render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )} />
              <Label className="text-[13px]">Active</Label>
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="dept-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMut.isPending || updateMut.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Department" description={`Delete ${deleteTarget?.name}?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
    </div>
  );
}
