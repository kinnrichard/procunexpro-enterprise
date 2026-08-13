'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { cn, formatDateTime, getInitials } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FilterPopover, FilterField } from '@/components/filter-popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/components/ui/use-toast';
import { Users, Plus, Pencil, Trash2, UserCheck, UserX, Shield } from 'lucide-react';
const roleColors: Record<string, string> = {
  SUPERADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PROCUREMENT_OFFICER: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  WAREHOUSE_STAFF: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  FINANCE_OFFICER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  VIEWER: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const userSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  username: z.string().min(2, 'Min 2 chars'),
  email: z.string().email('Invalid email'),
  password: z.string().optional(),
  role: z.string().min(1, 'Required'),
  departmentId: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean(),
});

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [filterCreatedFrom, setFilterCreatedFrom] = useState<Date | undefined>();
  const [filterCreatedTo, setFilterCreatedTo] = useState<Date | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const activeFilterCount = [roleFilter, statusFilter, filterCreatedFrom, filterCreatedTo].filter(Boolean).length;
  const toDateStr = (d?: Date) => (d ? d.toISOString().split('T')[0] : '');
  function clearFilters() {
    setRoleFilter(''); setStatusFilter('');
    setFilterCreatedFrom(undefined); setFilterCreatedTo(undefined);
    setPage(1);
  }

  const { data: response, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter, statusFilter, filterCreatedFrom, filterCreatedTo],
    queryFn: () => api.get('/users', { params: {
      page, limit: 10, search,
      ...(roleFilter && { role: roleFilter }),
      ...(statusFilter && { status: statusFilter }),
      ...(filterCreatedFrom && { createdDateFrom: toDateStr(filterCreatedFrom) }),
      ...(filterCreatedTo && { createdDateTo: toDateStr(filterCreatedTo) }),
    } }),
  });

  const { data: deptData } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/departments', { params: { limit: 1000 } }),
  });

  const { data: rolesData } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles') });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const departments = (deptData?.data?.data || []).map((d: any) => ({ value: d.id, label: d.name }));
  const allRoles: any[] = rolesData?.data || [];
  const roleLabel = (key: string) => allRoles.find((r) => r.key === key)?.label || key.replaceAll('_', ' ');
  // SUPERADMIN is developer-only — not assignable through the UI
  const assignableRoles = allRoles.filter((r) => r.key !== 'SUPERADMIN');

  const form = useForm({
    resolver: zodResolver(userSchema),
    mode: 'onChange',
    defaultValues: { firstName: '', lastName: '', username: '', email: '', password: '', role: 'VIEWER', departmentId: '', phone: '', isActive: true },
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/users', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setModalOpen(false); toast({ title: 'User created' }); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to create', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/users/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setModalOpen(false); toast({ title: 'User updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setDeleteTarget(null); toast({ title: 'User deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.put(`/users/${id}/${action}`),
    onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast({ title: `User ${vars.action}d` }); },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  });

  const openCreate = () => { setEditing(null); form.reset({ firstName: '', lastName: '', username: '', email: '', password: '', role: 'VIEWER', departmentId: '', phone: '', isActive: true }); setModalOpen(true); };
  const openEdit = (user: any) => { setEditing(user); form.reset({ firstName: user.firstName, lastName: user.lastName, username: user.username, email: user.email, password: '', role: user.role, departmentId: user.departmentId || '', phone: user.phone || '', isActive: user.isActive }); setModalOpen(true); };

  const onSubmit = (data: any) => {
    const payload = { ...data, departmentId: data.departmentId || null };
    if (editing) {
      const updatePayload = payload.password ? payload : (({ password: _pw, ...rest }) => rest)(payload);
      updateMut.mutate({ id: editing.id, data: updatePayload });
    } else {
      createMut.mutate(payload);
    }
  };

  const columns = [
    {
      key: 'firstName', label: 'User', sortable: true, render: (_: any, row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-[#1e3a5f] rounded-full flex items-center justify-center text-white text-xs font-semibold">
            {getInitials(row.firstName, row.lastName)}
          </div>
          <div>
            <div className="font-medium">{row.firstName} {row.lastName}</div>
            <div className="text-xs text-muted-foreground">{row.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'username', label: 'Username', render: (v: string) => <span className="font-mono text-sm">{v}</span> },
    {
      key: 'role', label: 'Role', render: (v: string) => (
        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', roleColors[v] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>
          {roleLabel(v)}
        </span>
      ),
    },
    { key: 'department', label: 'Department', render: (_: any, row: any) => row.department?.name || '—' },
    { key: 'lastLogin', label: 'Last Login', render: (v: string) => v ? formatDateTime(v) : <span className="text-muted-foreground text-xs">Never</span> },
    { key: 'isActive', label: 'Status', render: (v: boolean) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          <button
            onClick={() => toggleMut.mutate({ id: row.id, action: row.isActive ? 'deactivate' : 'activate' })}
            className={cn('p-1.5 rounded-md', row.isActive ? 'hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600' : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600')}
            title={row.isActive ? 'Deactivate' : 'Activate'}
          >
            {row.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage user accounts and permissions">
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={total} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Active" value={items.filter((i: any) => i.isActive).length} icon={<UserCheck className="h-5 w-5" />} />
        <StatCard title="Inactive" value={items.filter((i: any) => !i.isActive).length} icon={<UserX className="h-5 w-5" />} />
        <StatCard title="Admins" value={items.filter((i: any) => i.role === 'ADMIN').length} icon={<Shield className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={page}
        limit={10}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search users..."
        isLoading={isLoading}
        emptyMessage="No users found"
        toolbar={
          <FilterPopover activeCount={activeFilterCount} onClear={clearFilters}>
            <FilterField label="Role">
              <Select value={roleFilter || 'ALL'} onValueChange={(v) => { setRoleFilter(v === 'ALL' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="All roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  {allRoles.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Status">
              <Select value={statusFilter || 'ALL'} onValueChange={(v) => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
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
            <DialogTitle>{editing ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          <form id="user-form" onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">First Name <span className="text-red-500">*</span></Label>
                <Input {...form.register('firstName')} className={cn('h-9 rounded-lg', form.formState.errors.firstName && 'border-red-300')} placeholder="e.g., Maria" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Last Name <span className="text-red-500">*</span></Label>
                <Input {...form.register('lastName')} className={cn('h-9 rounded-lg', form.formState.errors.lastName && 'border-red-300')} placeholder="e.g., Santos" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Username <span className="text-red-500">*</span></Label>
                <Input {...form.register('username')} className={cn('h-9 rounded-lg', form.formState.errors.username && 'border-red-300')} placeholder="e.g., maria.santos" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Email <span className="text-red-500">*</span></Label>
                <Input {...form.register('email')} className={cn('h-9 rounded-lg', form.formState.errors.email && 'border-red-300')} placeholder="user@email.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Password {!editing && <span className="text-red-500">*</span>}</Label>
                <Input type="password" {...form.register('password')} className="h-9 rounded-lg" placeholder={editing ? 'Leave blank to keep current' : 'Set a password'} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Role <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="role" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Department</Label>
                <Controller control={form.control} name="departmentId" render={({ field }) => (
                  <SearchableSelect options={departments} value={field.value || ''} onChange={field.onChange} placeholder="Select department" />
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Phone</Label>
                <Input {...form.register('phone')} className="h-9 rounded-lg" placeholder="+1 234 567 8900" />
              </div>
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
            <Button type="submit" form="user-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMut.isPending || updateMut.isPending}>
              {editing ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete User" description={`Delete ${deleteTarget?.firstName} ${deleteTarget?.lastName}?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
    </div>
  );
}
