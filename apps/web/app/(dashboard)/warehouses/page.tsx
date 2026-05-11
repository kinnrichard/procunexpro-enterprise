'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Warehouse, Plus, Pencil, Trash2, MapPin } from 'lucide-react';

const warehouseSchema = z.object({
  name: z.string().min(2, 'Name required'),
  code: z.string().min(1, 'Code required'),
  address: z.string().optional(),
  city: z.string().optional(),
});

const locationSchema = z.object({
  name: z.string().min(2, 'Name required'),
  code: z.string().min(1, 'Code required'),
  description: z.string().optional(),
});

export default function WarehousesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [locationModal, setLocationModal] = useState<any>(null);
  const [deleteLocationTarget, setDeleteLocationTarget] = useState<any>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['warehouses', page, search],
    queryFn: () => api.get('/warehouses', { params: { page, limit: 10, search } }),
  });

  const { data: locationsData, refetch: refetchLocations } = useQuery({
    queryKey: ['warehouse-locations', locationModal?.id],
    queryFn: () => api.get(`/warehouses/${locationModal.id}/locations`),
    enabled: !!locationModal,
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const locations = locationsData?.data || [];

  const form = useForm({ resolver: zodResolver(warehouseSchema), mode: 'onChange', defaultValues: { name: '', code: '', address: '', city: '' } });
  const locForm = useForm({ resolver: zodResolver(locationSchema), mode: 'onChange', defaultValues: { name: '', code: '', description: '' } });

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/warehouses', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['warehouses'] }); setModalOpen(false); toast({ title: 'Warehouse created' }); },
    onError: () => toast({ title: 'Failed to create', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/warehouses/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['warehouses'] }); setModalOpen(false); toast({ title: 'Warehouse updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/warehouses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['warehouses'] }); setDeleteTarget(null); toast({ title: 'Warehouse deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const addLocationMut = useMutation({
    mutationFn: (data: any) => api.post(`/warehouses/${locationModal.id}/locations`, data),
    onSuccess: () => { refetchLocations(); locForm.reset(); toast({ title: 'Location added' }); },
    onError: () => toast({ title: 'Failed to add location', variant: 'destructive' }),
  });

  const deleteLocationMut = useMutation({
    mutationFn: (locId: string) => api.delete(`/warehouses/${locationModal.id}/locations/${locId}`),
    onSuccess: () => { refetchLocations(); setDeleteLocationTarget(null); toast({ title: 'Location deleted' }); },
    onError: () => toast({ title: 'Failed to delete location', variant: 'destructive' }),
  });

  const openCreate = () => { setEditing(null); form.reset({ name: '', code: '', address: '', city: '' }); setModalOpen(true); };
  const openEdit = (wh: any) => { setEditing(wh); form.reset({ name: wh.name, code: wh.code, address: wh.address || '', city: wh.city || '' }); setModalOpen(true); };

  const onSubmit = (data: any) => {
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true, render: (v: string) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Warehouse className="h-4 w-4 text-primary" /></div>
        <span className="font-medium">{v}</span>
      </div>
    ) },
    { key: 'code', label: 'Code', render: (v: string) => <span className="font-mono text-sm">{v}</span> },
    { key: 'address', label: 'Address', render: (v: string) => v || '—' },
    { key: 'city', label: 'City', render: (v: string) => v || '—' },
    { key: 'isActive', label: 'Status', render: (v: boolean) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        <button type="button" className="flex items-center gap-1" onClick={e => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
          <button onClick={() => { setLocationModal(row); locForm.reset(); }} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="Locations"><MapPin className="h-3.5 w-3.5" /></button>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouses" description="Manage warehouse locations and storage">
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Add Warehouse
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Warehouses" value={total} icon={<Warehouse className="h-5 w-5" />} />
        <StatCard title="Active" value={items.filter((i: any) => i.isActive).length} icon={<Warehouse className="h-5 w-5" />} />
      </div>

      <DataTable columns={columns} data={items} total={total} page={page} limit={10} onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search warehouses..." isLoading={isLoading} emptyMessage="No warehouses found" />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Warehouse' : 'Add Warehouse'}</DialogTitle>
          </DialogHeader>
          <form id="wh-form" onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Name <span className="text-red-500">*</span></Label>
                <Input {...form.register('name')} className={cn('h-9 rounded-lg', form.formState.errors.name && 'border-red-300')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Code <span className="text-red-500">*</span></Label>
                <Input {...form.register('code')} className={cn('h-9 rounded-lg', form.formState.errors.code && 'border-red-300')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Address</Label>
              <Input {...form.register('address')} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">City</Label>
              <Input {...form.register('city')} className="h-9 rounded-lg" />
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="wh-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMut.isPending || updateMut.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Locations Modal */}
      <Dialog open={!!locationModal} onOpenChange={() => setLocationModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>Locations — {locationModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <form onSubmit={locForm.handleSubmit((d) => addLocationMut.mutate(d))} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[11px]">Name</Label>
                <Input {...locForm.register('name')} className="h-8 rounded-lg" placeholder="e.g. Aisle A, Shelf 1" />
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-[11px]">Code</Label>
                <Input {...locForm.register('code')} className="h-8 rounded-lg" placeholder="e.g. A1" />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-[11px]">Description</Label>
                <Input {...locForm.register('description')} className="h-8 rounded-lg" />
              </div>
              <Button type="submit" size="sm" className="bg-gradient-primary text-white h-8" disabled={!locForm.formState.isValid || addLocationMut.isPending}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </form>
            {locations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No locations yet</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                    <th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Code</th><th className="text-left px-4 py-2">Description</th><th className="px-4 py-2 w-10"></th>
                  </tr></thead>
                  <tbody>
                    {locations.map((loc: any) => (
                      <tr key={loc.id} className="border-t border-border/50">
                        <td className="px-4 py-2.5">{loc.name}</td>
                        <td className="px-4 py-2.5 font-mono">{loc.code}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{loc.description || '—'}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => setDeleteLocationTarget(loc)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Warehouse" description={`Delete ${deleteTarget?.name}?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
      <ConfirmDialog open={!!deleteLocationTarget} onOpenChange={() => setDeleteLocationTarget(null)} title="Delete Location" description={`Delete location ${deleteLocationTarget?.name}?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteLocationTarget && deleteLocationMut.mutate(deleteLocationTarget.id)} isLoading={deleteLocationMut.isPending} />
    </div>
  );
}
