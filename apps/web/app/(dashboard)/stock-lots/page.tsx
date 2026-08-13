'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/use-toast';
import { Boxes, Plus, AlertTriangle, Clock, Pencil, Check, X } from 'lucide-react';

const statusColors: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DEPLETED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  EXPIRED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  QUARANTINE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const qcColors: Record<string, string> = {
  PASSED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HOLD: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export default function StockLotsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ productId: '', lotNumber: '', quantity: 0, expiryDate: '', source: '', status: 'AVAILABLE', qcStatus: 'PASSED' });

  const expiringMode = filter === 'expiring';
  const qcFilter = filter === 'PENDING_QC' ? 'PENDING' : undefined;
  const statusFilter = ['AVAILABLE', 'EXPIRED', 'DEPLETED'].includes(filter) ? filter : undefined;

  const { data: response, isLoading } = useQuery({
    queryKey: ['stock-lots', page, search, filter],
    queryFn: () => expiringMode
      ? api.get('/stock-lots/expiring', { params: { days: 30 } })
      : api.get('/stock-lots', { params: { page, limit: 10, search, ...(statusFilter && { status: statusFilter }), ...(qcFilter && { qcStatus: qcFilter }) } }),
  });

  const { data: expData } = useQuery({ queryKey: ['stock-lots-expiring'], queryFn: () => api.get('/stock-lots/expiring', { params: { days: 30 } }) });
  const { data: prodData } = useQuery({ queryKey: ['products-all'], queryFn: () => api.get('/products', { params: { limit: 1000 } }) });

  const rawItems = expiringMode ? (response?.data?.data || []) : (response?.data?.data || []);
  const items = Array.isArray(rawItems) ? rawItems : [];
  const total = expiringMode ? items.length : (response?.data?.total || 0);
  const expiringList = expData?.data?.data || [];
  const expiredCount = expiringList.filter((l: any) => (daysUntil(l.expiryDate) ?? 1) < 0).length;
  const products = (prodData?.data?.data || []).map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` }));

  const saveMut = useMutation({
    mutationFn: () => editing
      ? api.put(`/stock-lots/${editing.id}`, { lotNumber: form.lotNumber, expiryDate: form.expiryDate || null, source: form.source, status: form.status, qcStatus: form.qcStatus })
      : api.post('/stock-lots', { productId: form.productId, lotNumber: form.lotNumber, quantity: form.quantity, expiryDate: form.expiryDate || null, source: form.source }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-lots'] });
      queryClient.invalidateQueries({ queryKey: ['stock-lots-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast({ title: editing ? 'Lot updated' : 'Lot added' });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to save lot', variant: 'destructive' }),
  });

  const qcMut = useMutation({
    mutationFn: ({ id, qcStatus }: { id: string; qcStatus: string }) => api.put(`/stock-lots/${id}`, { qcStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-lots'] });
      toast({ title: 'QC status updated' });
    },
    onError: () => toast({ title: 'Failed to update QC', variant: 'destructive' }),
  });

  const openAdd = () => { setEditing(null); setForm({ productId: '', lotNumber: '', quantity: 0, expiryDate: '', source: '', status: 'AVAILABLE', qcStatus: 'PASSED' }); setModalOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setForm({ productId: row.productId, lotNumber: row.lotNumber, quantity: row.quantity, expiryDate: row.expiryDate ? row.expiryDate.slice(0, 10) : '', source: row.source || '', status: row.status, qcStatus: row.qcStatus }); setModalOpen(true); };

  const expiryClass = (d: number | null) => {
    if (d === null) return '';
    if (d < 0) return 'text-red-600 font-medium';
    if (d <= 30) return 'text-amber-600 font-medium';
    return 'text-foreground';
  };
  const expirySuffix = (d: number | null) => {
    if (d === null) return '';
    return d < 0 ? ' (expired)' : ` (${d}d)`;
  };
  const renderExpiry = (v: string | null) => {
    if (!v) return <span className="text-muted-foreground">—</span>;
    const d = daysUntil(v);
    return <span className={expiryClass(d)}>{formatDate(v)}{expirySuffix(d)}</span>;
  };

  const columns = [
    { key: 'lotNumber', label: 'Lot #', render: (v: string) => <span className="font-mono text-sm font-medium">{v}</span> },
    { key: 'product', label: 'Product', render: (_: any, row: any) => row.product?.name || '—' },
    { key: 'quantity', label: 'Qty', render: (v: number, row: any) => <span className="font-medium">{v} <span className="text-xs text-muted-foreground">{row.product?.unit}</span></span> },
    { key: 'expiryDate', label: 'Expiry', render: renderExpiry },
    { key: 'status', label: 'Status', render: (v: string) => <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', statusColors[v] || statusColors.DEPLETED)}>{v}</span> },
    { key: 'qcStatus', label: 'QC', render: (v: string) => <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', qcColors[v] || qcColors.PASSED)}>{v}</span> },
    { key: 'source', label: 'Source', render: (v: string) => <span className="text-xs text-muted-foreground">{v || '—'}</span> },
    { key: 'actions', label: '', render: (_: any, row: any) => (
      <div className="flex items-center gap-0.5 justify-end">
        {['PENDING', 'HOLD'].includes(row.qcStatus) && (
          <>
            <button onClick={() => qcMut.mutate({ id: row.id, qcStatus: 'PASSED' })} title="Pass QC" className="p-1.5 rounded text-green-600 hover:bg-green-50"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => qcMut.mutate({ id: row.id, qcStatus: 'FAILED' })} title="Fail QC" className="p-1.5 rounded text-red-600 hover:bg-red-50"><X className="h-3.5 w-3.5" /></button>
          </>
        )}
        <button onClick={() => openEdit(row)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
      </div>
    ) },
  ];

  const filters = ['', 'AVAILABLE', 'PENDING_QC', 'expiring', 'EXPIRED', 'DEPLETED'];
  const filterLabels: Record<string, string> = { '': 'All', AVAILABLE: 'Available', PENDING_QC: 'Pending QC', expiring: 'Expiring ≤30d', EXPIRED: 'Expired', DEPLETED: 'Depleted' };

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Lots & Expiry" description="Batch/lot tracking with expiry dates and traceability">
        <Button onClick={openAdd} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Add Lot
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Lots (page)" value={total} icon={<Boxes className="h-5 w-5" />} />
        <StatCard title="Expiring ≤30 days" value={expiringList.length} icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Expired" value={expiredCount} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={page}
        limit={10}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search lots..."
        isLoading={isLoading}
        emptyMessage="No lots found"
        toolbar={
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.map(f => (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                {filterLabels[f]}
              </button>
            ))}
          </div>
        }
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Lot' : 'Add Lot'}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            {!editing && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">Product <span className="text-red-500">*</span></Label>
                <SearchableSelect options={products} value={form.productId} onChange={(v) => setForm({ ...form, productId: v })} placeholder="Select product" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Lot Number <span className="text-red-500">*</span></Label>
                <Input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} className="h-9 rounded-lg" placeholder="e.g., LOT-2026-001" />
              </div>
              {!editing && (
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Quantity</Label>
                  <Input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number.parseFloat(e.target.value) || 0 })} className="h-9 rounded-lg" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Expiry Date</Label>
                <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="h-9 rounded-lg" />
              </div>
              {editing && (
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Status</Label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
                    {['AVAILABLE', 'QUARANTINE', 'EXPIRED', 'DEPLETED'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
            {editing && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">QC Status</Label>
                  <select value={form.qcStatus} onChange={(e) => setForm({ ...form, qcStatus: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
                    {['PENDING', 'PASSED', 'FAILED', 'HOLD'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Source</Label>
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="h-9 rounded-lg" placeholder="e.g., supplier ref" />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => saveMut.mutate()} className="bg-gradient-primary text-white" disabled={saveMut.isPending || (!editing && (!form.productId || !form.lotNumber)) || (!!editing && !form.lotNumber)}>
              {saveMut.isPending ? 'Saving…' : editing ? 'Save' : 'Add Lot'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
