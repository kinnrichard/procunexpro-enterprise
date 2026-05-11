'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, getInitials, cn } from '@/lib/utils';
import { useCurrencyStore } from '@/lib/currency';
import { useTaxStore } from '@/lib/tax';
import { StatusBadge } from '@/components/status-badge';
import { DocumentsPanel } from '@/components/documents-panel';
import { CommentsPanel } from '@/components/comments-panel';
import { ActivityPanel } from '@/components/activity-panel';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft, Loader2, Send, CheckCircle, XCircle, Truck, PackageCheck,
  Clock, FileText, Link2, Ban, ChevronRight, Building2, Calendar, CreditCard, MapPin, Info,
} from 'lucide-react';

// ─── Status Timeline ──────────────────────────────────────
const statusOrder = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'RECEIVED'];
const statusSteps = [
  { key: 'DRAFT', label: 'Draft', icon: FileText },
  { key: 'PENDING_APPROVAL', label: 'Pending', icon: Clock },
  { key: 'APPROVED', label: 'Approved', icon: CheckCircle },
  { key: 'SENT', label: 'Sent', icon: Truck },
  { key: 'RECEIVED', label: 'Received', icon: PackageCheck },
];

function POStatusTimeline({ status, rejectionNote }: Readonly<{ status: string; rejectionNote?: string }>) {
  const isCancelled = status === 'CANCELLED';
  const currentIndex = statusOrder.indexOf(status);

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
        <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0"><Ban className="h-5 w-5 text-red-600" /></div>
        <div>
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Cancelled</p>
          {rejectionNote && <p className="text-xs text-red-600/70 mt-0.5">{rejectionNote}</p>}
        </div>
      </div>
    );
  }

  if (status === 'PARTIALLY_RECEIVED') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
        <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0"><PackageCheck className="h-5 w-5 text-amber-600" /></div>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Partially Received</p>
      </div>
    );
  }

  const currentColors: Record<string, { chip: string; arrow: string }> = {
    DRAFT: { chip: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300', arrow: 'text-gray-400' },
    PENDING_APPROVAL: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', arrow: 'text-amber-400' },
    APPROVED: { chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', arrow: 'text-emerald-400' },
    SENT: { chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', arrow: 'text-blue-400' },
    RECEIVED: { chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', arrow: 'text-indigo-400' },
  };
  const doneChip = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  const doneArrow = 'text-green-400';

  return (
    <div className="flex items-center gap-1">
      {statusSteps.map((step, i) => {
        const isCurrent = currentIndex === i;
        const isDone = currentIndex > i;
        const isActive = currentIndex >= i;
        const Icon = step.icon;
        const colors = currentColors[step.key];
        return (
          <div key={step.key} className="flex items-center">
            <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors', isDone ? doneChip : isCurrent ? colors.chip : 'bg-muted text-muted-foreground')}>
              <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < statusSteps.length - 1 && <ChevronRight className={cn('h-4 w-4 mx-0.5 shrink-0', isDone ? doneArrow : isActive ? colors.arrow : 'text-muted-foreground/30')} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Inline Edit Cell (same as PR) ───────────────────────
function InlineEditCell({ value, onSave, suffix, align = 'right', disabled, integer, stepper, toast: toastFn }: Readonly<{
  value: number; onSave: (val: number) => void; suffix?: string; align?: 'left' | 'right' | 'center'; disabled?: boolean; integer?: boolean; stepper?: boolean; toast?: (opts: any) => void;
}>) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(String(value));
  const startEdit = (e: React.MouseEvent) => { e.stopPropagation(); setLocalVal(String(value)); setEditing(true); };
  const alignClass = (() => { if (align === 'right') return 'text-right'; if (align === 'center') return 'text-center'; return ''; })();

  const clampInteger = (num: number): number => {
    const clamped = Math.min(Math.max(num > 0 ? Math.round(num) : 0, 0), 100);
    if (num > 100 && toastFn) toastFn({ title: 'Invalid discount', description: 'Cannot exceed 100%.', variant: 'destructive' });
    return clamped;
  };
  const handleBlur = () => {
    let num = Number.parseFloat(localVal) || 0;
    if (integer) num = clampInteger(num);
    if (num !== value) onSave(num);
    setEditing(false);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') { setLocalVal(String(value)); setEditing(false); }
  };

  if (!editing && stepper && !disabled) {
    return (
      <div className="flex items-stretch gap-0">
        <button type="button" onClick={(e) => { e.stopPropagation(); const n = Math.max(1, value - 1); if (n !== value) onSave(n); }} className="w-6 shrink-0 flex items-center justify-center border border-border/60 bg-muted hover:bg-accent transition-colors text-muted-foreground text-xs">−</button>
        <button type="button" onClick={startEdit} className="flex-1 font-mono text-xs px-2 py-1.5 border-y border-border/60 bg-background hover:border-primary/40 cursor-text text-center">{value}{suffix}</button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onSave(value + 1); }} className="w-6 shrink-0 flex items-center justify-center border border-border/60 bg-muted hover:bg-accent transition-colors text-muted-foreground text-xs">+</button>
      </div>
    );
  }
  if (!editing) {
    return <button type="button" onClick={(e) => { if (!disabled) startEdit(e); }} className={cn('w-full font-mono text-xs px-2 py-1.5 transition-colors', disabled ? '' : 'border border-border/60 bg-background hover:border-primary/40 cursor-text rounded-none', alignClass)}>{value}{suffix}</button>;
  }

  const inputEl = <input type="number" step="0.01" autoFocus value={localVal} onChange={(e) => setLocalVal(e.target.value)} onClick={(e) => e.stopPropagation()} onBlur={handleBlur} onKeyDown={handleKeyDown}
    className={cn('w-full font-mono text-xs px-1 py-0.5 border border-primary/50 bg-background outline-none focus:ring-1 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none', alignClass)} />;

  if (stepper) {
    const stepEdit = (delta: number) => () => { const n = Math.max(1, (Number.parseInt(localVal) || 1) + delta); setLocalVal(String(n)); onSave(n); setEditing(false); };
    return (
      <div className="flex items-stretch gap-0">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={stepEdit(-1)} className="w-6 shrink-0 flex items-center justify-center border border-primary/50 border-r-0 bg-muted hover:bg-accent transition-colors text-muted-foreground text-xs">−</button>
        {inputEl}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={stepEdit(1)} className="w-6 shrink-0 flex items-center justify-center border border-primary/50 border-l-0 bg-muted hover:bg-accent transition-colors text-muted-foreground text-xs">+</button>
      </div>
    );
  }
  return inputEl;
}

// ─── Helpers ──────────────────────────────────────────────
function getVendorPricing(item: any, vendorId: string) {
  if (vendorId && item.product?.pricings) {
    const pricing = item.product.pricings.find((p: any) => p.vendorId === vendorId);
    if (pricing) return { opQty: pricing.originalPackagingQty || 1, pcsPerPack: pricing.pcsPerPack || 1, uom: pricing.originalPackagingUom || 'pcs' };
  }
  return { opQty: 1, pcsPerPack: 1, uom: item.uom || 'pcs' };
}

function calcItemAmount(item: any, vendorId: string, taxRate: number) {
  const vp = getVendorPricing(item, vendorId);
  const invQty = (item.quantity || vp.opQty) * vp.pcsPerPack;
  const subtotal = invQty * (item.unitPrice || 0);
  const discounted = subtotal - (subtotal * (item.discount || 0) / 100);
  if (item.taxable && taxRate > 0 && !item.taxIncluded) return discounted + (discounted * taxRate / 100);
  return discounted;
}

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700', HIGH: 'bg-amber-100 text-amber-700',
  MEDIUM: 'bg-blue-100 text-blue-700', LOW: 'bg-gray-100 text-gray-600',
};

// ─── Main Component ───────────────────────────────────────
export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formatCurrency = useCurrencyStore((s) => s.format);
  const currencySymbol = useCurrencyStore((s) => s.symbol);
  const taxRate = useTaxStore((s) => s.getDefaultRate)();
  const poId = params.id as string;

  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [receiveConfirmOpen, setReceiveConfirmOpen] = useState(false);

  const { data: poData, isLoading } = useQuery({
    queryKey: ['po-detail', poId],
    queryFn: () => api.get(`/purchase-orders/${poId}`),
  });
  const po = poData?.data;

  const { data: glAccountsRes } = useQuery({
    queryKey: ['gl-accounts-active'],
    queryFn: () => api.get('/gl-accounts/active'),
  });
  const glAccountOptions = (glAccountsRes?.data?.data || []).map((g: any) => ({ value: g.id, label: `${g.code} - ${g.name}` }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['po-detail', poId] });
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['audit', 'PURCHASE_ORDER', poId] });
  };

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => api.patch(`/purchase-orders/${poId}/items/${itemId}`, data),
    onSuccess: () => invalidate(),
    onError: () => toast({ title: 'Failed to update item', variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.put(`/purchase-orders/${poId}/submit`),
    onSuccess: () => { invalidate(); toast({ title: 'Submitted for approval' }); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed', variant: 'destructive' }),
  });
  const approveMutation = useMutation({
    mutationFn: () => api.put(`/purchase-orders/${poId}/approve`),
    onSuccess: () => { invalidate(); toast({ title: 'Approved' }); },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });
  const sendMutation = useMutation({
    mutationFn: () => api.put(`/purchase-orders/${poId}/send`),
    onSuccess: () => { invalidate(); toast({ title: 'Sent to vendor' }); },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });
  const receiveMutation = useMutation({
    mutationFn: () => api.put(`/purchase-orders/${poId}/receive`),
    onSuccess: () => { invalidate(); toast({ title: 'Received' }); },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });

  function inlineSave(itemId: string, field: string, value: number | boolean | string | null) {
    updateItemMutation.mutate({ itemId, data: { [field]: value } });
  }

  function renderHeaderActions() {
    if (!po) return null;
    return (
      <div className="flex items-center gap-2">
        {po.status === 'DRAFT' && (
          <Button onClick={() => setSubmitConfirmOpen(true)} disabled={submitMutation.isPending || (po.items?.length || 0) === 0} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Submit
          </Button>
        )}
        {po.status === 'PENDING_APPROVAL' && (
          <>
            <Button onClick={() => setApproveConfirmOpen(true)} className="bg-green-600 hover:bg-green-700 text-white"><CheckCircle className="h-4 w-4 mr-2" /> Approve</Button>
            <Button variant="destructive" onClick={() => setRejectConfirmOpen(true)}><XCircle className="h-4 w-4 mr-2" /> Reject</Button>
          </>
        )}
        {po.status === 'APPROVED' && (
          <Button onClick={() => setSendConfirmOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white"><Truck className="h-4 w-4 mr-2" /> Send to Vendor</Button>
        )}
        {(po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') && (
          <Button onClick={() => setReceiveConfirmOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white"><PackageCheck className="h-4 w-4 mr-2" /> Mark Received</Button>
        )}
      </div>
    );
  }

  if (isLoading) return <div className="flex items-center justify-center h-full py-20 text-muted-foreground">Loading…</div>;
  if (!po) return <div className="flex items-center justify-center h-full py-20 text-muted-foreground">Purchase order not found</div>;

  const isDraft = po.status === 'DRAFT';
  const vendorId = po.vendorId;
  const totalAmount = (po.items || []).reduce((sum: number, item: any) => sum + calcItemAmount(item, vendorId, taxRate), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/purchase-orders')} className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight">{po.orderNumber}</h1>
              <StatusBadge status={po.status} />
              <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', priorityColors[po.priority])}>{po.priority}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {po.vendor?.name}{po.purchaseRequest && <span> · PR {po.purchaseRequest.requestNumber}</span>}
            </p>
          </div>
        </div>
        {renderHeaderActions()}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Details</TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-5 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <POStatusTimeline status={po.status} rejectionNote={po.rejectionNote} />
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Amount</p>
              <p className="text-2xl font-bold font-mono text-primary">{formatCurrency(totalAmount)}</p>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Created By</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center text-white text-[10px] font-semibold">
                  {po.createdBy ? getInitials(po.createdBy.firstName, po.createdBy.lastName) : '?'}
                </div>
                <span className="text-sm font-medium">{po.createdBy ? `${po.createdBy.firstName} ${po.createdBy.lastName}` : '—'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vendor</p>
              <p className="text-sm font-medium flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{po.vendor?.name || '—'}</p>
            </div>
            {po.purchaseRequest && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">PR Reference</p>
                <button onClick={() => router.push(`/purchase-requests/${po.purchaseRequest.id}`)} className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />{po.purchaseRequest.requestNumber}</button>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Order Date</p>
              <p className="text-sm flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{formatDate(po.orderDate)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Expected Delivery</p>
              <p className="text-sm flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{po.expectedDate ? formatDate(po.expectedDate) : 'Not specified'}</p>
            </div>
            {po.paymentTerms && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Payment Terms</p>
                <p className="text-sm flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-muted-foreground" />{po.paymentTerms}</p>
              </div>
            )}
            {po.shippingAddress && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Shipping Address</p>
                <p className="text-sm flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{po.shippingAddress}</p>
              </div>
            )}
          </div>

          {po.notes && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Notes</p>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">{po.notes}</p>
            </div>
          )}

          {/* ─── Line Items (matching PR design) ──────── */}
          <Separator />
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Order Items</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{po.items?.length || 0} item{(po.items?.length || 0) === 1 ? '' : 's'}</p>
            </div>

            {(!po.items || po.items.length === 0) ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                <p className="text-sm text-muted-foreground">No items in this order</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                      <th className="text-left px-3 py-2.5 w-[40px]">#</th>
                      <th className="text-left px-3 py-2.5 w-[180px]">Product</th>
                      <th className="text-left px-3 py-2.5 w-[65px]">UOM</th>
                      <th className="text-center px-3 py-2.5 w-[60px]">OP Qty</th>
                      <th className="text-center px-3 py-2.5 w-[65px]">Pcs/Pack</th>
                      <th className="text-center px-3 py-2.5 w-[70px]">
                        <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">Inv Qty <Info className="h-3 w-3 text-muted-foreground" /></span>
                        </TooltipTrigger><TooltipContent side="top" className="text-xs">OP Qty × Pcs/Pack</TooltipContent></Tooltip></TooltipProvider>
                      </th>
                      <th className="text-center px-3 py-2.5 w-[70px]">Received</th>
                      <th className="text-right px-3 py-2.5 w-[90px]">Unit Price</th>
                      <th className="text-right px-3 py-2.5 w-[70px]">Discount</th>
                      <th className="text-center px-3 py-2.5 w-[55px]">Taxable</th>
                      <th className="text-center px-3 py-2.5 w-[55px]">Tax Incl</th>
                      <th className="text-left px-3 py-2.5 w-[140px]">GL Account</th>
                      <th className="text-right px-3 py-2.5 w-[90px]">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((item: any, idx: number) => {
                      const vp = getVendorPricing(item, vendorId);
                      const pkgQty = item.quantity || vp.opQty;
                      const pcsPerPack = vp.pcsPerPack;
                      const invQty = pkgQty * pcsPerPack;
                      return (
                        <tr key={item.id} className="border-t border-border/50 transition-colors hover:bg-accent/30">
                          <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <p className="font-medium">{item.product?.name || item.description || '—'}</p>
                            {item.product?.sku && <p className="font-mono text-xs text-muted-foreground">{item.product.sku}</p>}
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{(vp.uom || item.uom || '—').toUpperCase()}</td>
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <InlineEditCell value={pkgQty} onSave={(v) => inlineSave(item.id, 'quantity', v)} align="center" disabled={!isDraft} stepper />
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-xs">{pcsPerPack || '—'}</td>
                          <td className="px-3 py-3 text-center font-mono text-xs font-semibold">{invQty ? invQty.toLocaleString() : '—'}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={cn('font-mono', item.receivedQty >= item.quantity ? 'text-green-600 font-semibold' : item.receivedQty > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                              {item.receivedQty}/{item.quantity}
                            </span>
                          </td>
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-[10px] text-muted-foreground">{currencySymbol}</span>
                              <InlineEditCell value={item.unitPrice || 0} onSave={(v) => inlineSave(item.id, 'unitPrice', v)} align="right" disabled={!isDraft} />
                            </div>
                          </td>
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <InlineEditCell value={item.discount || 0} onSave={(v) => inlineSave(item.id, 'discount', v)} suffix="%" align="right" disabled={!isDraft} integer toast={toast} />
                          </td>
                          <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => isDraft && inlineSave(item.id, 'taxable', !item.taxable)} disabled={!isDraft}
                              className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors', isDraft && 'cursor-pointer hover:opacity-80', item.taxable ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground')}>
                              {item.taxable ? 'Yes' : 'No'}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => isDraft && inlineSave(item.id, 'taxIncluded', !item.taxIncluded)} disabled={!isDraft}
                              className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors', isDraft && 'cursor-pointer hover:opacity-80', item.taxIncluded ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground')}>
                              {item.taxIncluded ? 'Yes' : 'No'}
                            </button>
                          </td>
                          <td className="px-3 py-2 w-[140px]" onClick={(e) => e.stopPropagation()}>
                            {isDraft ? (
                              <SearchableSelect
                                options={[{ value: '', label: '— None —' }, ...glAccountOptions]}
                                value={item.glAccountId || ''}
                                onChange={(v) => inlineSave(item.id, 'glAccountId', v || null)}
                                placeholder="—"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">{item.glAccount?.code || '—'}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-medium">{formatCurrency(calcItemAmount(item, vendorId, taxRate))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── Comments & Activity ─────────────────────── */}
          <Separator />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[500px]">
            <div className="flex flex-col gap-4 min-h-0">
              <h2 className="text-base font-semibold shrink-0">Comments</h2>
              <div className="flex-1 min-h-0">{po.id && <CommentsPanel entityType="PURCHASE_ORDER" entityId={po.id} />}</div>
            </div>
            <div className="flex flex-col gap-4 min-h-0">
              <h2 className="text-base font-semibold shrink-0">Activity</h2>
              <div className="flex-1 min-h-0">{po.id && <ActivityPanel entityType="PURCHASE_ORDER" entityId={po.id} />}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-5">
          {po.id && <DocumentsPanel entityType="PURCHASE_ORDER" entityId={po.id} />}
        </TabsContent>
      </Tabs>

      {/* ─── Confirm Dialogs ──────────────────────────── */}
      <ConfirmDialog open={submitConfirmOpen} onOpenChange={(o) => !o && setSubmitConfirmOpen(false)} title="Submit for Approval" description={`Submit "${po.orderNumber}" for approval?`} confirmLabel="Submit" onConfirm={() => submitMutation.mutate(undefined, { onSuccess: () => setSubmitConfirmOpen(false) })} isLoading={submitMutation.isPending} />
      <ConfirmDialog open={approveConfirmOpen} onOpenChange={(o) => !o && setApproveConfirmOpen(false)} title="Approve Order" description={`Approve "${po.orderNumber}"?`} confirmLabel="Approve" onConfirm={() => approveMutation.mutate(undefined, { onSuccess: () => setApproveConfirmOpen(false) })} isLoading={approveMutation.isPending} />
      <ConfirmDialog open={sendConfirmOpen} onOpenChange={(o) => !o && setSendConfirmOpen(false)} title="Send to Vendor" description={`Send "${po.orderNumber}" to ${po.vendor?.name}?`} confirmLabel="Send" onConfirm={() => sendMutation.mutate(undefined, { onSuccess: () => setSendConfirmOpen(false) })} isLoading={sendMutation.isPending} />
      <ConfirmDialog open={receiveConfirmOpen} onOpenChange={(o) => !o && setReceiveConfirmOpen(false)} title="Mark as Received" description={`Mark "${po.orderNumber}" as fully received?`} confirmLabel="Receive" onConfirm={() => receiveMutation.mutate(undefined, { onSuccess: () => setReceiveConfirmOpen(false) })} isLoading={receiveMutation.isPending} />

      <Dialog open={rejectConfirmOpen} onOpenChange={(o) => { if (!o) { setRejectConfirmOpen(false); setRejectionNote(''); } }}>
        <DialogContent className="max-w-xs p-5">
          <DialogTitle className="text-sm font-semibold">Reject Order</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1.5">Reject &quot;{po.orderNumber}&quot;?</p>
          <div className="mt-3 space-y-1.5">
            <Label className="text-sm">Reason <span className="text-red-500">*</span></Label>
            <Textarea value={rejectionNote} onChange={(e) => setRejectionNote(e.target.value)} placeholder="Enter reason..." rows={3} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setRejectConfirmOpen(false); setRejectionNote(''); }}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={!rejectionNote.trim()}>Reject</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
