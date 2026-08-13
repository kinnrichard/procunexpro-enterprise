'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
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
import { useToast } from '@/components/ui/use-toast';
import { Contact, Plus, Pencil, Trash2, KeyRound } from 'lucide-react';

const blank = { employeeId: '', firstName: '', lastName: '', position: '', departmentId: '', email: '', phone: '', hireDate: '', userId: '', isActive: true, notes: '' };

export default function StaffPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState({ ...blank });

  const { data: response, isLoading } = useQuery({
    queryKey: ['staff', page, search],
    queryFn: () => api.get('/staff', { params: { page, limit: 10, search } }),
  });
  const { data: deptData } = useQuery({ queryKey: ['departments-all'], queryFn: () => api.get('/departments', { params: { limit: 1000 } }) });
  const { data: userData } = useQuery({ queryKey: ['staff-available-users'], queryFn: () => api.get('/staff/available-users'), enabled: modalOpen });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const departments = (deptData?.data?.data || []).map((d: any) => ({ value: d.id, label: d.name }));
  const availableUsers = (userData?.data?.data || []).map((u: any) => ({ value: u.id, label: `${u.username} — ${u.firstName} ${u.lastName} (${u.role})` }));
  // Keep the currently-linked user visible in the dropdown even though it's "taken"
  const userOptions = editing?.user && !availableUsers.some((o: any) => o.value === editing.user.id)
    ? [{ value: editing.user.id, label: `${editing.user.username} (${editing.user.role})` }, ...availableUsers]
    : availableUsers;

  const saveMut = useMutation({
    mutationFn: () => editing ? api.put(`/staff/${editing.id}`, form) : api.post('/staff', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setModalOpen(false);
      toast({ title: editing ? 'Staff updated' : 'Staff added' });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to save staff', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); setDeleteTarget(null); toast({ title: 'Staff deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const openAdd = () => { setEditing(null); setForm({ ...blank }); setModalOpen(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ employeeId: row.employeeId, firstName: row.firstName, lastName: row.lastName, position: row.position || '', departmentId: row.departmentId || '', email: row.email || '', phone: row.phone || '', hireDate: row.hireDate ? row.hireDate.slice(0, 10) : '', userId: row.userId || '', isActive: row.isActive, notes: row.notes || '' });
    setModalOpen(true);
  };

  const columns = [
    { key: 'lastName', label: 'Staff', render: (_: any, row: any) => <div><p className="font-medium">{row.firstName} {row.lastName}</p><p className="text-xs text-muted-foreground font-mono">{row.employeeId}</p></div> },
    { key: 'position', label: 'Position', render: (v: string) => v || <span className="text-muted-foreground">—</span> },
    { key: 'department', label: 'Department', render: (_: any, row: any) => row.department?.name || <span className="text-muted-foreground">—</span> },
    { key: 'user', label: 'Login Account', render: (_: any, row: any) => row.user
      ? <span className="inline-flex items-center gap-1 text-xs"><KeyRound className="h-3 w-3 text-green-600" /> {row.user.username} <span className="text-muted-foreground">({row.user.role})</span></span>
      : <span className="text-xs text-muted-foreground">Not linked</span> },
    { key: 'isActive', label: 'Status', render: (v: boolean) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', label: '', render: (_: any, row: any) => (
      <div className="flex items-center gap-0.5 justify-end">
        <button onClick={() => openEdit(row)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description="Employee records — optionally tied to a login account">
        <Button onClick={openAdd} className="bg-gradient-primary text-white hover:opacity-90"><Plus className="h-4 w-4 mr-2" /> Add Staff</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Staff" value={total} icon={<Contact className="h-5 w-5" />} />
        <StatCard title="With login" value={items.filter((s: any) => s.user).length} icon={<KeyRound className="h-5 w-5" />} />
      </div>

      <DataTable columns={columns} data={items} total={total} page={page} limit={10} onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search staff..." isLoading={isLoading} emptyMessage="No staff yet" />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Employee ID <span className="text-red-500">*</span></Label>
                <Input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="h-9 rounded-lg" placeholder="e.g., EMP-001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Position</Label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="h-9 rounded-lg" placeholder="e.g., Line Operator" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">First Name <span className="text-red-500">*</span></Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="h-9 rounded-lg" placeholder="e.g., Maria" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Last Name <span className="text-red-500">*</span></Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="h-9 rounded-lg" placeholder="e.g., Santos" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Department</Label>
                <SearchableSelect options={departments} value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} placeholder="None" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Hire Date</Label>
                <Input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 rounded-lg" placeholder="staff@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 rounded-lg" placeholder="+1 234 567 8900" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Linked login account <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <SearchableSelect options={userOptions} value={form.userId} onChange={(v) => setForm({ ...form, userId: v })} placeholder="No login account" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-lg" rows={2} placeholder="Optional notes about this staff member..." />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-input" />
              <span>Active</span>
            </label>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => saveMut.mutate()} className="bg-gradient-primary text-white" disabled={saveMut.isPending || !form.employeeId || !form.firstName || !form.lastName}>
              {saveMut.isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Staff"
        description={`Delete "${deleteTarget?.firstName} ${deleteTarget?.lastName}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        isLoading={deleteMut.isPending}
      />
    </div>
  );
}
