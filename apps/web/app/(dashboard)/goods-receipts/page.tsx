'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/use-toast';
import { PackageCheck, Plus, Truck } from 'lucide-react';

interface Row { purchaseOrderItemId: string; productId: string; name: string; sku: string; uom: string; outstanding: number; quantity: number; lotNumber: string; expiryDate: string; }

export default function GoodsReceiptsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [poId, setPoId] = useState('');
  const [supplierDrRef, setSupplierDrRef] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  const { data: response, isLoading } = useQuery({
    queryKey: ['goods-receipts', page, search],
    queryFn: () => api.get('/goods-receipts', { params: { page, limit: 10, search } }),
  });
  const { data: poData } = useQuery({ queryKey: ['receivable-pos'], queryFn: () => api.get('/goods-receipts/receivable-pos'), enabled: modalOpen });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const receivablePOs = poData?.data?.data || [];
  const poOptions = receivablePOs.map((po: any) => ({ value: po.id, label: `${po.orderNumber}${po.vendorName ? ` — ${po.vendorName}` : ''}` }));

  const onPickPO = (id: string) => {
    setPoId(id);
    const po = receivablePOs.find((p: any) => p.id === id);
    setRows((po?.items || []).map((i: any) => ({ ...i, quantity: i.outstanding, lotNumber: '', expiryDate: '' })));
  };
  const updateRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const saveMut = useMutation({
    mutationFn: () => api.post('/goods-receipts', {
      purchaseOrderId: poId || undefined,
      supplierDrRef: supplierDrRef || undefined,
      notes: notes || undefined,
      items: rows.filter((r) => r.quantity > 0).map((r) => ({ purchaseOrderItemId: r.purchaseOrderItemId, productId: r.productId, quantity: r.quantity, uom: r.uom, lotNumber: r.lotNumber || undefined, expiryDate: r.expiryDate || undefined })),
    }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-lots'] });
      setModalOpen(false);
      toast({ title: `Received — ${res?.data?.receiptNumber || ''}` });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to receive', variant: 'destructive' }),
  });

  const openCreate = () => { setPoId(''); setSupplierDrRef(''); setNotes(''); setRows([]); setModalOpen(true); };

  const columns = [
    { key: 'receiptNumber', label: 'Receipt #', render: (v: string) => <span className="font-mono text-sm font-medium">{v}</span> },
    { key: 'purchaseOrder', label: 'PO', render: (_: any, row: any) => row.purchaseOrder?.orderNumber || '—' },
    { key: 'supplierDrRef', label: 'Supplier DR', render: (v: string) => v || <span className="text-muted-foreground">—</span> },
    { key: '_count', label: 'Items', className: 'text-center', render: (v: any) => <span className="font-mono text-sm">{v?.items ?? 0}</span> },
    { key: 'receiptDate', label: 'Date', render: (v: string) => formatDate(v) },
  ];

  const canSave = rows.length > 0 && rows.some((r) => r.quantity > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Goods Receipts" description="Receive goods against a purchase order, capturing lot # and expiry">
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90"><Plus className="h-4 w-4 mr-2" /> New Receipt</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Receipts" value={total} icon={<PackageCheck className="h-5 w-5" />} />
      </div>

      <DataTable columns={columns} data={items} total={total} page={page} limit={10} onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search receipts..." isLoading={isLoading} emptyMessage="No goods receipts yet" />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>New Goods Receipt</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Purchase Order <span className="text-red-500">*</span></Label>
                <SearchableSelect options={poOptions} value={poId} onChange={onPickPO} placeholder="Select a sent PO" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Supplier DR / Invoice #</Label>
                <Input value={supplierDrRef} onChange={(e) => setSupplierDrRef(e.target.value)} className="h-9 rounded-lg" placeholder="e.g., supplier's DR / invoice #" />
              </div>
            </div>

            {rows.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Item</th>
                      <th className="text-right font-medium px-3 py-2">Outstanding</th>
                      <th className="text-right font-medium px-3 py-2 w-[90px]">Receive</th>
                      <th className="text-left font-medium px-3 py-2 w-[120px]">Lot #</th>
                      <th className="text-left font-medium px-3 py-2 w-[140px]">Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.purchaseOrderItemId} className="border-t">
                        <td className="px-3 py-2">{r.name} <span className="text-muted-foreground text-xs">({r.sku})</span></td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{r.outstanding} {r.uom}</td>
                        <td className="px-3 py-2"><Input type="number" step="any" value={r.quantity} onChange={(e) => updateRow(i, { quantity: Number.parseFloat(e.target.value) || 0 })} className="h-8 rounded-lg text-right" /></td>
                        <td className="px-3 py-2"><Input value={r.lotNumber} onChange={(e) => updateRow(i, { lotNumber: e.target.value })} placeholder="auto" className="h-8 rounded-lg" /></td>
                        <td className="px-3 py-2"><Input type="date" value={r.expiryDate} onChange={(e) => updateRow(i, { expiryDate: e.target.value })} className="h-8 rounded-lg" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {poId && rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing outstanding on this PO.</p>}

            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-lg" rows={2} placeholder="Optional notes about this receipt..." />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => saveMut.mutate()} className="bg-gradient-primary text-white" disabled={!canSave || saveMut.isPending}>
              <Truck className="h-4 w-4 mr-2" />{saveMut.isPending ? 'Receiving…' : 'Receive Goods'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
