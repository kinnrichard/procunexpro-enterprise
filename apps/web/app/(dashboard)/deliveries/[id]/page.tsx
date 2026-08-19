'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { CommentsPanel } from '@/components/comments-panel';
import { ActivityPanel } from '@/components/activity-panel';
import { DocumentsPanel } from '@/components/documents-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/lib/permissions';
import { ApprovalStatusBadge, ApprovalActions } from '@/components/approval-controls';
import { usePrintDoc, PrintDocHost } from '@/components/printables/print-document';
import { DRDocument } from '@/components/printables/documents';
import {
  ArrowLeft, Plus, Trash2, Truck, Link2, XCircle, CheckCircle2, Printer, Loader2,
  User, Calendar, Warehouse, PenLine,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  RELEASED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SIGNED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DRAFT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const drId = params.id as string;
  const { toast } = useToast();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const { ref: printRef, print: handlePrint } = usePrintDoc();

  const [addOpen, setAddOpen] = useState(false);
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState<number>(0);
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const { data: drData, isLoading } = useQuery({
    queryKey: ['dr-detail', drId],
    queryFn: () => api.get(`/delivery-receipts/${drId}`).then((r) => r.data),
  });
  const dr = drData;

  const { data: prodData } = useQuery({ queryKey: ['products-all'], queryFn: () => api.get('/products', { params: { limit: 1000 } }) });
  const { data: whData } = useQuery({ queryKey: ['warehouses-all'], queryFn: () => api.get('/warehouses', { params: { limit: 1000 } }) });
  const warehouseName = (whData?.data?.data || []).find((w: any) => w.id === dr?.warehouseId)?.name;
  const productList = (prodData?.data?.data || []).filter((p: any) => ['product', 'component'].includes(p.inventoryType));
  const productOptions = productList.map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  const stockByProduct = useMemo(() => new Map<string, number>(productList.map((p: any) => [p.id, p.currentStock])), [productList]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['dr-detail', drId] });
    queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['audit', 'DELIVERY_RECEIPT', drId] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const addItemMut = useMutation({
    mutationFn: () => api.post(`/delivery-receipts/${drId}/items`, { productId: addProductId, quantity: addQty }),
    onSuccess: () => { invalidate(); setAddOpen(false); setAddProductId(''); setAddQty(0); toast({ title: 'Item added' }); },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to add item', variant: 'destructive' }),
  });
  const updateItemMut = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => api.put(`/delivery-receipts/${drId}/items/${itemId}`, { quantity }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to update item', variant: 'destructive' }),
  });
  const removeItemMut = useMutation({
    mutationFn: (itemId: string) => api.delete(`/delivery-receipts/${drId}/items/${itemId}`),
    onSuccess: () => { invalidate(); toast({ title: 'Item removed' }); },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to remove item', variant: 'destructive' }),
  });
  const releaseMut = useMutation({
    mutationFn: () => api.post(`/delivery-receipts/${drId}/release`),
    onSuccess: (res: any) => { invalidate(); setReleaseConfirm(false); toast({ title: res?.data?.status === 'RELEASED' ? 'Goods released' : 'Submitted for approval' }); },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to release', variant: 'destructive' }),
  });
  const cancelMut = useMutation({
    mutationFn: () => api.post(`/delivery-receipts/${drId}/cancel`),
    onSuccess: () => { invalidate(); setCancelConfirm(false); toast({ title: 'Delivery cancelled' }); },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to cancel', variant: 'destructive' }),
  });

  const copyLink = () => { globalThis.navigator?.clipboard?.writeText(dr?.signUrl || ''); toast({ title: 'Sign link copied' }); };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!dr) {
    return <div className="text-center py-20 text-muted-foreground">Delivery receipt not found.</div>;
  }

  const pending = dr.status === 'DRAFT' && dr.approval?.status === 'PENDING';
  const editable = can('deliveries', 'edit') && dr.status === 'DRAFT' && dr.approval?.status !== 'PENDING';
  const items: any[] = dr.items || [];

  return (
    <div className="space-y-6">
      <PrintDocHost innerRef={printRef}><DRDocument dr={dr} /></PrintDocHost>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/deliveries')} className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight">{dr.drNumber}</h1>
              {pending
                ? <ApprovalStatusBadge approval={dr.approval} fallback={dr.status} />
                : <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', statusColors[dr.status] || statusColors.DRAFT)}>
                    {dr.status === 'SIGNED' && <CheckCircle2 className="h-3 w-3" />}{dr.status}
                  </span>}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{dr.customer?.name || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1.5" /> Print</Button>
          {(dr.status === 'RELEASED' || dr.status === 'SIGNED') && (
            <Button variant="outline" size="sm" onClick={copyLink}><Link2 className="h-4 w-4 mr-1.5" /> Sign link</Button>
          )}
          {pending && <ApprovalActions endpoint="/delivery-receipts" id={dr.id} approval={dr.approval} invalidateKeys={['dr-detail', 'delivery-receipts', 'products', 'stock-lots', 'stock-movements']} appliedLabel="Goods released" />}
          {editable && (
            <Button size="sm" onClick={() => setReleaseConfirm(true)} disabled={items.length === 0} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
              <Truck className="h-4 w-4 mr-1.5" /> Release
            </Button>
          )}
          {can('deliveries', 'edit') && (dr.status === 'DRAFT' || dr.status === 'RELEASED') && (
            <Button variant="outline" size="sm" onClick={() => setCancelConfirm(true)} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"><XCircle className="h-4 w-4 mr-1.5" /> Cancel</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5">Details</TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-5 space-y-6">
          {/* Rejection note */}
          {dr.approval?.status === 'REJECTED' && dr.rejectionReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <span className="font-medium">Rejected:</span> {dr.rejectionReason}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
            <Info label="Customer" icon={<User className="h-3.5 w-3.5 text-muted-foreground" />} value={dr.customer?.name || '—'} />
            <Info label="Warehouse" icon={<Warehouse className="h-3.5 w-3.5 text-muted-foreground" />} value={warehouseName || (dr.warehouseId ? '—' : '—')} />
            <Info label="Delivery Date" icon={<Calendar className="h-3.5 w-3.5 text-muted-foreground" />} value={dr.deliveryDate ? formatDate(dr.deliveryDate) : '—'} />
            <Info label="Created" value={dr.createdAt ? formatDate(dr.createdAt) : '—'} />
            {dr.releasedAt && <Info label="Released" value={formatDate(dr.releasedAt)} />}
            {dr.signedAt && <Info label="Signed" icon={<PenLine className="h-3.5 w-3.5 text-muted-foreground" />} value={`${dr.signedByName || ''} · ${formatDate(dr.signedAt)}`} />}
          </div>

          {dr.notes && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Notes</p>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">{dr.notes}</p>
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Items {items.length > 0 && <span className="text-muted-foreground font-normal">({items.length})</span>}</h2>
              {editable && <Button size="sm" variant="outline" onClick={() => { setAddProductId(''); setAddQty(0); setAddOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> Add Item</Button>}
            </div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium w-10">#</th>
                    <th className="px-3 py-2.5 text-left font-medium">Item</th>
                    <th className="px-3 py-2.5 text-left font-medium">UOM</th>
                    <th className="px-3 py-2.5 text-right font-medium">Quantity</th>
                    {editable && <th className="px-3 py-2.5 w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={editable ? 5 : 4} className="px-3 py-10 text-center text-muted-foreground">
                      No items yet. {editable && 'Click “Add Item” to build this delivery.'}
                    </td></tr>
                  ) : items.map((it, idx) => {
                    const stock = stockByProduct.get(it.productId);
                    const short = typeof stock === 'number' && stock < it.quantity;
                    return (
                      <tr key={it.id} className="border-t border-border/50">
                        <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{it.product?.name || '—'}</p>
                          <p className="font-mono text-xs text-muted-foreground">{it.product?.sku || ''}{typeof stock === 'number' && <span className={cn('ml-2', short ? 'text-red-600' : 'text-muted-foreground')}>· on hand {stock}</span>}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{it.uom?.toUpperCase() || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {editable
                            ? <Input type="number" step="any" min={0} defaultValue={it.quantity} onBlur={(e) => { const v = Number.parseFloat(e.target.value) || 0; if (v !== it.quantity) updateItemMut.mutate({ itemId: it.id, quantity: v }); }} className={cn('h-8 w-24 ml-auto rounded-lg text-right font-mono', short && 'border-red-300')} />
                            : <span className={cn('font-mono font-semibold', short && 'text-red-600')}>{it.quantity}</span>}
                        </td>
                        {editable && (
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => removeItemMut.mutate(it.id)} title="Remove" className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {editable && items.some((it) => { const s = stockByProduct.get(it.productId); return typeof s === 'number' && s < it.quantity; }) && (
              <p className="text-xs text-red-600">One or more items exceed on-hand stock — releasing will fail until stock is available.</p>
            )}
          </div>

          {/* Comments + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[500px]">
            <div className="flex flex-col gap-4 min-h-0">
              <h2 className="text-base font-semibold shrink-0">Comments</h2>
              <div className="flex-1 min-h-0"><CommentsPanel entityType="DELIVERY_RECEIPT" entityId={dr.id} /></div>
            </div>
            <div className="flex flex-col gap-4 min-h-0">
              <h2 className="text-base font-semibold shrink-0">Activity</h2>
              <div className="flex-1 min-h-0"><ActivityPanel entityType="DELIVERY_RECEIPT" entityId={dr.id} /></div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-5">
          <DocumentsPanel entityType="DELIVERY_RECEIPT" entityId={dr.id} />
        </TabsContent>
      </Tabs>

      {/* Add item dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>Add Item</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Product <span className="text-red-500">*</span></Label>
              <SearchableSelect options={productOptions} value={addProductId} onChange={setAddProductId} placeholder="Select finished product" />
              {addProductId && typeof stockByProduct.get(addProductId) === 'number' && (
                <p className="text-xs text-muted-foreground">On hand: {stockByProduct.get(addProductId)}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Quantity <span className="text-red-500">*</span></Label>
              <Input type="number" step="any" min={0} value={addQty || ''} placeholder="0" onChange={(e) => setAddQty(Number.parseFloat(e.target.value) || 0)} className="h-9 rounded-lg" />
            </div>
          </div>
          <div className="px-6 py-4 border-t flex justify-between">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addItemMut.mutate()} disabled={!addProductId || !(addQty > 0) || addItemMut.isPending} className="bg-gradient-primary text-white">
              {addItemMut.isPending ? 'Adding…' : 'Add Item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={releaseConfirm}
        onOpenChange={setReleaseConfirm}
        title="Release goods?"
        description="This will draw the finished goods from stock (FEFO) and release the delivery — or submit it for approval if a workflow is configured."
        confirmLabel="Release"
        isLoading={releaseMut.isPending}
        onConfirm={() => releaseMut.mutate()}
      />
      <ConfirmDialog
        open={cancelConfirm}
        onOpenChange={setCancelConfirm}
        title="Cancel delivery?"
        description="This delivery receipt will be cancelled."
        confirmLabel="Cancel Delivery"
        variant="destructive"
        isLoading={cancelMut.isPending}
        onConfirm={() => cancelMut.mutate()}
      />
    </div>
  );
}

function Info({ label, value, icon }: Readonly<{ label: string; value: ReactNode; icon?: ReactNode }>) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium flex items-center gap-1.5">{icon}{value}</p>
    </div>
  );
}
