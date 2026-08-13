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
import { useToast } from '@/components/ui/use-toast';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';

const blank = { name: '', code: '', contactPerson: '', email: '', phone: '', address: '', city: '', country: '', taxId: '', notes: '', isActive: true };

export default function CustomersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState({ ...blank });

  const { data: response, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => api.get('/customers', { params: { page, limit: 10, search } }),
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;

  const saveMut = useMutation({
    mutationFn: () => editing ? api.put(`/customers/${editing.id}`, form) : api.post('/customers', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-active'] });
      setModalOpen(false);
      toast({ title: editing ? 'Customer updated' : 'Customer created' });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to save customer', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setDeleteTarget(null); toast({ title: 'Customer deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const openAdd = () => { setEditing(null); setForm({ ...blank }); setModalOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setForm({ name: row.name, code: row.code, contactPerson: row.contactPerson || '', email: row.email || '', phone: row.phone || '', address: row.address || '', city: row.city || '', country: row.country || '', taxId: row.taxId || '', notes: row.notes || '', isActive: row.isActive }); setModalOpen(true); };

  const columns = [
    { key: 'name', label: 'Customer', render: (v: string, row: any) => <div><p className="font-medium">{v}</p><p className="text-xs text-muted-foreground font-mono">{row.code}</p></div> },
    { key: 'contactPerson', label: 'Contact', render: (v: string) => v || <span className="text-muted-foreground">—</span> },
    { key: 'email', label: 'Email', render: (v: string) => v || <span className="text-muted-foreground">—</span> },
    { key: 'phone', label: 'Phone', render: (v: string) => v || <span className="text-muted-foreground">—</span> },
    { key: 'city', label: 'Location', render: (v: string, row: any) => [v, row.country].filter(Boolean).join(', ') || <span className="text-muted-foreground">—</span> },
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
      <PageHeader title="Customers" description="Clients you deliver finished goods to (used by Delivery Receipts)">
        <Button onClick={openAdd} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Add Customer
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Customers" value={total} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Active" value={items.filter((c: any) => c.isActive).length} icon={<Users className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={page}
        limit={10}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search customers..."
        isLoading={isLoading}
        emptyMessage="No customers yet"
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Name <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 rounded-lg" placeholder="e.g., TBMC" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Code <span className="text-red-500">*</span></Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-9 rounded-lg" placeholder="e.g., TBMC" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Contact Person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Tax ID</Label>
                <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-lg" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Country</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="h-9 rounded-lg" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-input" />
              <span>Active</span>
            </label>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => saveMut.mutate()} className="bg-gradient-primary text-white" disabled={saveMut.isPending || !form.name || !form.code}>
              {saveMut.isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Customer"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        isLoading={deleteMut.isPending}
      />
    </div>
  );
}
