'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Warehouse, Plus, Pencil, Trash2, MapPin, LayoutGrid } from 'lucide-react';

const warehouseSchema = z.object({
  name: z.string().min(2, 'Name required'),
  code: z.string().min(1, 'Code required'),
  address: z.string().optional(),
  city: z.string().optional(),
});

const areaSchema = z.object({
  name: z.string().min(2, 'Name required'),
  code: z.string().min(1, 'Code required'),
  description: z.string().optional(),
});

const locationSchema = z.object({
  name: z.string().min(2, 'Name required'),
  code: z.string().min(1, 'Code required'),
  areaId: z.string().optional(),
  description: z.string().optional(),
});

export function WarehousesConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [locationModal, setLocationModal] = useState<any>(null);
  const [deleteLocationTarget, setDeleteLocationTarget] = useState<any>(null);
  const [deleteAreaTarget, setDeleteAreaTarget] = useState<any>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['warehouses', page, search],
    queryFn: () => api.get('/warehouses', { params: { page, limit: 10, search } }),
  });
  const { data: locationsData, refetch: refetchLocations } = useQuery({
    queryKey: ['warehouse-locations', locationModal?.id],
    queryFn: () => api.get(`/warehouses/${locationModal.id}/locations`),
    enabled: !!locationModal,
  });
  const { data: areasData, refetch: refetchAreas } = useQuery({
    queryKey: ['warehouse-areas', locationModal?.id],
    queryFn: () => api.get(`/warehouses/${locationModal.id}/areas`),
    enabled: !!locationModal,
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const locations = locationsData?.data || [];
  const areas = areasData?.data || [];

  const form = useForm({ resolver: zodResolver(warehouseSchema), mode: 'onChange', defaultValues: { name: '', code: '', address: '', city: '' } });
  const locForm = useForm({ resolver: zodResolver(locationSchema), mode: 'onChange', defaultValues: { name: '', code: '', areaId: '', description: '' } });
  const areaForm = useForm({ resolver: zodResolver(areaSchema), mode: 'onChange', defaultValues: { name: '', code: '', description: '' } });

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
    onSuccess: () => { refetchLocations(); locForm.reset({ name: '', code: '', areaId: '', description: '' }); toast({ title: 'Location added' }); },
    onError: () => toast({ title: 'Failed to add location', variant: 'destructive' }),
  });
  const addAreaMut = useMutation({
    mutationFn: (data: any) => api.post(`/warehouses/${locationModal.id}/areas`, data),
    onSuccess: () => { refetchAreas(); areaForm.reset(); toast({ title: 'Area added' }); },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to add area', variant: 'destructive' }),
  });
  const deleteAreaMut = useMutation({
    mutationFn: (areaId: string) => api.delete(`/warehouses/${locationModal.id}/areas/${areaId}`),
    onSuccess: () => { refetchAreas(); refetchLocations(); setDeleteAreaTarget(null); toast({ title: 'Area deleted' }); },
    onError: () => toast({ title: 'Failed to delete area', variant: 'destructive' }),
  });
  const deleteLocationMut = useMutation({
    mutationFn: (locId: string) => api.delete(`/warehouses/${locationModal.id}/locations/${locId}`),
    onSuccess: () => { refetchLocations(); setDeleteLocationTarget(null); toast({ title: 'Location deleted' }); },
    onError: () => toast({ title: 'Failed to delete location', variant: 'destructive' }),
  });

  const openCreate = () => { setEditing(null); form.reset({ name: '', code: '', address: '', city: '' }); setModalOpen(true); };
  const openEdit = (wh: any) => { setEditing(wh); form.reset({ name: wh.name, code: wh.code, address: wh.address || '', city: wh.city || '' }); setModalOpen(true); };
  const onSubmit = (data: any) => { if (editing) updateMut.mutate({ id: editing.id, data }); else createMut.mutate(data); };

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
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => { setLocationModal(row); locForm.reset(); }} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="Areas & Locations"><MapPin className="h-3.5 w-3.5" /></button>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Manage warehouses, their areas (zones) and storage locations.</p>
        <Button size="sm" onClick={openCreate} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Warehouse
        </Button>
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

      {/* Areas & Locations Modal */}
      <Dialog open={!!locationModal} onOpenChange={() => setLocationModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>Areas &amp; Locations — {locationModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Areas */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Areas <span className="text-xs font-normal text-muted-foreground">— zones within this warehouse</span></p>
              <form onSubmit={areaForm.handleSubmit((d) => addAreaMut.mutate(d))} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-[11px]">Name</Label>
                  <Input {...areaForm.register('name')} className="h-8 rounded-lg" placeholder="e.g. Cold Storage, Dry Goods" />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-[11px]">Code</Label>
                  <Input {...areaForm.register('code')} className="h-8 rounded-lg" placeholder="e.g. CS" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-[11px]">Description</Label>
                  <Input {...areaForm.register('description')} className="h-8 rounded-lg" />
                </div>
                <Button type="submit" size="sm" className="bg-gradient-primary text-white h-8" disabled={!areaForm.formState.isValid || addAreaMut.isPending}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </form>
              {areas.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">No areas yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {areas.map((a: any) => (
                    <span key={a.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-muted/40 text-sm">
                      <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{a.code}</span>
                      <span className="text-xs text-muted-foreground">· {a._count?.locations ?? 0} loc</span>
                      <button onClick={() => setDeleteAreaTarget(a)} className="ml-1 text-red-500 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Locations */}
            <div className="space-y-3 border-t pt-5">
              <p className="text-sm font-semibold">Locations <span className="text-xs font-normal text-muted-foreground">— bins/shelves, optionally within an area</span></p>
              <form onSubmit={locForm.handleSubmit((d) => addLocationMut.mutate(d))} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-[11px]">Name</Label>
                  <Input {...locForm.register('name')} className="h-8 rounded-lg" placeholder="e.g. Aisle A, Shelf 1" />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-[11px]">Code</Label>
                  <Input {...locForm.register('code')} className="h-8 rounded-lg" placeholder="A1" />
                </div>
                <div className="w-36 space-y-1">
                  <Label className="text-[11px]">Area</Label>
                  <select {...locForm.register('areaId')} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm">
                    <option value="">No area</option>
                    {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <Button type="submit" size="sm" className="bg-gradient-primary text-white h-8" disabled={!locForm.formState.isValid || addLocationMut.isPending}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </form>
              {locations.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">No locations yet</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                      <th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Code</th><th className="text-left px-4 py-2">Area</th><th className="px-4 py-2 w-10"></th>
                    </tr></thead>
                    <tbody>
                      {locations.map((loc: any) => (
                        <tr key={loc.id} className="border-t border-border/50">
                          <td className="px-4 py-2.5">{loc.name}</td>
                          <td className="px-4 py-2.5 font-mono">{loc.code}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{loc.area?.name || '—'}</td>
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
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Warehouse" description={`Delete ${deleteTarget?.name}?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
      <ConfirmDialog open={!!deleteLocationTarget} onOpenChange={() => setDeleteLocationTarget(null)} title="Delete Location" description={`Delete location ${deleteLocationTarget?.name}?`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteLocationTarget && deleteLocationMut.mutate(deleteLocationTarget.id)} isLoading={deleteLocationMut.isPending} />
      <ConfirmDialog open={!!deleteAreaTarget} onOpenChange={() => setDeleteAreaTarget(null)} title="Delete Area" description={`Delete area "${deleteAreaTarget?.name}"? Its locations will be unassigned.`} variant="destructive" confirmLabel="Delete" onConfirm={() => deleteAreaTarget && deleteAreaMut.mutate(deleteAreaTarget.id)} isLoading={deleteAreaMut.isPending} />
    </div>
  );
}
