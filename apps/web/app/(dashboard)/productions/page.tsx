'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime, formatCurrency, cn } from '@/lib/utils';
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
import { Factory, Plus, CheckCircle2, FileEdit, XCircle, AlertTriangle } from 'lucide-react';

interface PreviewRow {
  materialId: string;
  material: { id: string; name: string; sku: string; unit: string; currentStock: number };
  perUnit: number;
  uom: string;
  requiredInStock: number;
  stockUnit: string;
  quantity: number;
  lineCost: number;
  available: number;
  sufficient: boolean;
}

export default function ProductionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ row: any; action: 'complete' | 'cancel' } | null>(null);

  // Create form state
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [laborRateId, setLaborRateId] = useState('');
  const [laborHours, setLaborHours] = useState(0);
  const [overheadCost, setOverheadCost] = useState(0);

  const { data: response, isLoading } = useQuery({
    queryKey: ['productions', page, search, statusFilter],
    queryFn: () => api.get('/productions', { params: { page, limit: 10, search, ...(statusFilter && { status: statusFilter }) } }),
  });

  const { data: prodData } = useQuery({ queryKey: ['products-all'], queryFn: () => api.get('/products', { params: { limit: 1000 } }) });
  const { data: whData } = useQuery({ queryKey: ['warehouses-all'], queryFn: () => api.get('/warehouses', { params: { limit: 1000 } }) });
  const { data: laborData } = useQuery({ queryKey: ['labor-rates-active'], queryFn: () => api.get('/labor-rates/active') });

  // Live BOM preview for the selected product + quantity
  const { data: previewData, isFetching: previewLoading } = useQuery({
    queryKey: ['production-preview', productId, quantity],
    queryFn: () => api.get('/productions/preview', { params: { productId, quantity } }),
    enabled: !!productId && modalOpen,
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  // Only Finished Goods and Components can be produced (raw materials/consumables/packaging are bought, not made)
  const producibleTypes = new Set(['product', 'component']);
  const products = (prodData?.data?.data || [])
    .filter((p: any) => producibleTypes.has(p.inventoryType))
    .map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  const warehouses = (whData?.data?.data || []).map((w: any) => ({ value: w.id, label: w.name }));
  const preview: PreviewRow[] = previewData?.data || [];
  const hasShortage = preview.some((r) => !r.sufficient);
  const canSubmit = !!productId && quantity > 0 && preview.length > 0 && !hasShortage;

  const laborRates = (laborData?.data?.data || []);
  const laborRateOptions = laborRates.map((r: any) => ({ value: r.id, label: `${r.name} (${r.ratePerHour}/hr)` }));
  const selectedRate = laborRates.find((r: any) => r.id === laborRateId);
  const laborCost = (selectedRate?.ratePerHour || 0) * (laborHours || 0);
  const materialsCost = preview.reduce((s, r) => s + (r.lineCost || 0), 0);
  const batchCost = materialsCost + laborCost + (overheadCost || 0);
  const unitCost = quantity > 0 ? batchCost / quantity : 0;

  const createMut = useMutation({
    mutationFn: () => api.post('/productions', { productId, quantity, warehouseId: warehouseId || undefined, notes: notes || undefined, laborRateId: laborRateId || undefined, laborHours, overheadCost }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      setModalOpen(false);
      toast({ title: 'Production run created' });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to create production', variant: 'destructive' }),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => api.post(`/productions/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast({ title: 'Production completed — stock updated' });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to complete production', variant: 'destructive' }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.post(`/productions/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      toast({ title: 'Production cancelled' });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to cancel', variant: 'destructive' }),
  });

  const openCreate = () => {
    setProductId('');
    setQuantity(1);
    setWarehouseId('');
    setNotes('');
    setLaborRateId('');
    setLaborHours(0);
    setOverheadCost(0);
    setModalOpen(true);
  };

  const onConfirm = () => {
    if (!confirmTarget) return;
    const { row, action } = confirmTarget;
    if (action === 'complete') completeMut.mutate(row.id, { onSuccess: () => setConfirmTarget(null) });
    else cancelMut.mutate(row.id, { onSuccess: () => setConfirmTarget(null) });
  };

  const confirmCopy = confirmTarget?.action === 'complete'
    ? {
        title: 'Complete production?',
        description: `${confirmTarget.row.referenceNumber} will consume its materials and add ${Math.round(confirmTarget.row.quantity)} unit(s) of ${confirmTarget.row.product?.name} to stock. This cannot be undone.`,
        confirmLabel: 'Complete',
        variant: 'default' as const,
      }
    : {
        title: 'Cancel production?',
        description: `${confirmTarget?.row.referenceNumber} will be marked as cancelled. No stock will be changed.`,
        confirmLabel: 'Cancel production',
        variant: 'destructive' as const,
      };

  const confirmLoading = completeMut.isPending || cancelMut.isPending;

  const columns = [
    { key: 'referenceNumber', label: 'Reference', sortable: true, render: (v: string) => <span className="font-medium font-mono text-sm">{v}</span> },
    { key: 'product', label: 'Product', render: (_: any, row: any) => row.product?.name || '—' },
    { key: 'quantity', label: 'Qty', render: (v: number) => <span className="font-medium">{v}</span> },
    { key: '_count', label: 'Materials', render: (v: any) => v?.items ?? 0 },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'createdAt', label: 'Created', sortable: true, render: (v: string) => formatDateTime(v) },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        row.status === 'DRAFT' ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-8 text-green-600 hover:text-green-700" onClick={() => setConfirmTarget({ row, action: 'complete' })} disabled={confirmLoading}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700" onClick={() => setConfirmTarget({ row, action: 'cancel' })} disabled={confirmLoading}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        ) : null
      ),
    },
  ];

  const statusFilters = ['', 'DRAFT', 'COMPLETED', 'CANCELLED'];
  const statusLabels: Record<string, string> = { '': 'All', DRAFT: 'Draft', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

  return (
    <div className="space-y-6">
      <PageHeader title="Production" description="Consume materials and produce finished goods from a product's composition">
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> New Production
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Runs" value={total} icon={<Factory className="h-5 w-5" />} />
        <StatCard title="Draft" value={items.filter((i: any) => i.status === 'DRAFT').length} icon={<FileEdit className="h-5 w-5" />} />
        <StatCard title="Completed" value={items.filter((i: any) => i.status === 'COMPLETED').length} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Cancelled" value={items.filter((i: any) => i.status === 'CANCELLED').length} icon={<XCircle className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={page}
        limit={10}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search productions..."
        isLoading={isLoading}
        emptyMessage="No production runs found"
        toolbar={
          <div className="flex items-center gap-1.5 flex-wrap">
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
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>New Production Run</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Product to produce <span className="text-red-500">*</span></Label>
                <SearchableSelect options={products} value={productId} onChange={setProductId} placeholder="Select product" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Quantity <span className="text-red-500">*</span></Label>
                <Input type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(Number.parseFloat(e.target.value) || 0)} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Warehouse</Label>
              <SearchableSelect options={warehouses} value={warehouseId} onChange={setWarehouseId} placeholder="Select warehouse (optional)" />
            </div>

            {/* BOM preview */}
            <div className="space-y-2">
              <Label className="text-[13px]">Materials to consume (from composition)</Label>
              {!productId && <p className="text-sm text-muted-foreground">Select a product to see its materials.</p>}
              {productId && previewLoading && <p className="text-sm text-muted-foreground">Loading composition…</p>}
              {productId && !previewLoading && preview.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/40 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>This product has no composition defined. Set up its Bill of Materials on the product page first.</span>
                </div>
              )}
              {preview.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Material</th>
                        <th className="text-right font-medium px-3 py-2">Required</th>
                        <th className="text-right font-medium px-3 py-2">In Stock</th>
                        <th className="text-center font-medium px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r) => (
                        <tr key={r.materialId} className="border-t">
                          <td className="px-3 py-2">{r.material.name} <span className="text-muted-foreground text-xs">({r.material.sku})</span></td>
                          <td className="px-3 py-2 text-right font-medium">
                            {r.quantity} {r.uom}
                            {r.uom !== r.stockUnit && (
                              <span className="block text-[11px] text-muted-foreground">= {r.requiredInStock} {r.stockUnit}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">{r.available} {r.stockUnit}</td>
                          <td className="px-3 py-2 text-center">
                            {r.sufficient
                              ? <span className="text-green-600 text-xs font-medium">OK</span>
                              : <span className="text-red-600 text-xs font-medium">Short</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {hasShortage && (
                <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Not enough stock for one or more materials.</p>
              )}
            </div>

            {/* Batch costing: materials + labor + overhead */}
            {preview.length > 0 && (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Materials cost</span>
                  <span className="tabular-nums font-medium">{formatCurrency(materialsCost)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[13px] text-muted-foreground">Labor rate</Label>
                    <SearchableSelect options={laborRateOptions} value={laborRateId} onChange={setLaborRateId} placeholder="Select rate" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[13px] text-muted-foreground">Labor hours</Label>
                    <Input type="number" step="any" value={laborHours} onChange={(e) => setLaborHours(Number.parseFloat(e.target.value) || 0)} className="h-8 rounded-lg" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Labor cost {selectedRate ? `(${selectedRate.ratePerHour}/hr × ${laborHours}h)` : ''}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(laborCost)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-[13px] text-muted-foreground">Overhead cost</Label>
                  <Input type="number" step="any" value={overheadCost} onChange={(e) => setOverheadCost(Number.parseFloat(e.target.value) || 0)} className="h-8 w-28 rounded-lg text-right" />
                </div>
                <div className="flex items-center justify-between border-t pt-2 text-sm">
                  <span className="font-medium">Batch total / unit cost</span>
                  <span className="tabular-nums font-semibold">{formatCurrency(batchCost)} <span className="text-muted-foreground font-normal">/ {formatCurrency(unitCost)} ea</span></span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-lg" rows={2} />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => createMut.mutate()} className="bg-gradient-primary text-white" disabled={!canSubmit || createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create Production'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        variant={confirmCopy.variant}
        onConfirm={onConfirm}
        isLoading={confirmLoading}
      />
    </div>
  );
}
