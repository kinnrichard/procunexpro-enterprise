'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, getInitials, cn } from '@/lib/utils';
import { useCurrencyStore } from '@/lib/currency';
import { StatusBadge } from '@/components/status-badge';
import { DocumentsPanel } from '@/components/documents-panel';
import { CommentsPanel } from '@/components/comments-panel';
import { ActivityPanel } from '@/components/activity-panel';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft, Loader2, Send, CheckCircle, XCircle, Trophy,
  Clock, FileText, Ban, ChevronRight, Calendar, StickyNote,
  Package, BarChart3, Plus, User,
} from 'lucide-react';

// ─── Status Timeline ──────────────────────────────────────
const statusOrder = ['DRAFT', 'PUBLISHED', 'CLOSED', 'AWARDED'];
const statusSteps = [
  { key: 'DRAFT', label: 'Draft', icon: FileText },
  { key: 'PUBLISHED', label: 'Published', icon: Send },
  { key: 'CLOSED', label: 'Closed', icon: XCircle },
  { key: 'AWARDED', label: 'Awarded', icon: Trophy },
];

function RFQStatusTimeline({ status }: Readonly<{ status: string }>) {
  const isCancelled = status === 'CANCELLED';
  const currentIndex = statusOrder.indexOf(status);

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
        <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0"><Ban className="h-5 w-5 text-red-600" /></div>
        <div>
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Cancelled</p>
        </div>
      </div>
    );
  }

  const currentColors: Record<string, { chip: string; arrow: string }> = {
    DRAFT: { chip: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300', arrow: 'text-gray-400' },
    PUBLISHED: { chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', arrow: 'text-blue-400' },
    CLOSED: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', arrow: 'text-amber-400' },
    AWARDED: { chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', arrow: 'text-emerald-400' },
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

// ─── Main Component ───────────────────────────────────────
export default function RFQDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formatCurrency = useCurrencyStore((s) => s.format);
  const rfqId = params.id as string;

  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [awardConfirmOpen, setAwardConfirmOpen] = useState(false);
  const [awardQuoteId, setAwardQuoteId] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ vendorId: '', leadTime: '', validUntil: '', notes: '', items: [] as { rfqItemId: string; unitPrice: number }[] });

  const { data: rfqData, isLoading } = useQuery({
    queryKey: ['rfq-detail', rfqId],
    queryFn: () => api.get(`/rfq/${rfqId}`),
  });
  const rfq = rfqData?.data;

  const { data: compareData, isLoading: compareLoading } = useQuery({
    queryKey: ['rfq-compare', rfqId],
    queryFn: () => api.get(`/rfq/${rfqId}/compare`),
    enabled: compareOpen,
  });

  const { data: vendorsRes } = useQuery({
    queryKey: ['vendors-approved'],
    queryFn: () => api.get('/vendors?status=APPROVED'),
    enabled: quoteModalOpen,
  });
  const vendorOptions = (vendorsRes?.data?.data || vendorsRes?.data || []).map((v: any) => ({ value: v.id, label: v.name }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rfq-detail', rfqId] });
    queryClient.invalidateQueries({ queryKey: ['rfq'] });
    queryClient.invalidateQueries({ queryKey: ['rfq-compare', rfqId] });
    queryClient.invalidateQueries({ queryKey: ['audit', 'RFQ', rfqId] });
  };

  const publishMutation = useMutation({
    mutationFn: () => api.put(`/rfq/${rfqId}/publish`),
    onSuccess: () => { invalidate(); toast({ title: 'RFQ Published' }); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to publish', variant: 'destructive' }),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.put(`/rfq/${rfqId}/close`),
    onSuccess: () => { invalidate(); toast({ title: 'Bidding Closed' }); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to close', variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.put(`/rfq/${rfqId}/cancel`),
    onSuccess: () => { invalidate(); toast({ title: 'RFQ Cancelled' }); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to cancel', variant: 'destructive' }),
  });

  const awardMutation = useMutation({
    mutationFn: (quoteId: string) => api.put(`/rfq/${rfqId}/award/${quoteId}`),
    onSuccess: (res) => {
      invalidate();
      const s = res.data?.prSync;
      toast({
        title: 'Quote Awarded',
        description: s?.updatedItems ? `Updated ${s.updatedItems} PR item(s) with the awarded price.` : undefined,
      });
    },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to award', variant: 'destructive' }),
  });

  const addQuoteMutation = useMutation({
    mutationFn: (data: any) => api.post(`/rfq/${rfqId}/quotes`, data),
    onSuccess: () => { invalidate(); toast({ title: 'Quote Added' }); setQuoteModalOpen(false); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to add quote', variant: 'destructive' }),
  });

  function openQuoteModal() {
    const items = (rfq?.items || []).map((item: any) => ({ rfqItemId: item.id, unitPrice: 0 }));
    setQuoteForm({ vendorId: '', leadTime: '', validUntil: '', notes: '', items });
    setQuoteModalOpen(true);
  }

  function submitQuote() {
    const payload = {
      vendorId: quoteForm.vendorId,
      leadTime: quoteForm.leadTime ? Number.parseInt(quoteForm.leadTime) : undefined,
      validUntil: quoteForm.validUntil || undefined,
      notes: quoteForm.notes || undefined,
      items: quoteForm.items,
    };
    addQuoteMutation.mutate(payload);
  }

  function renderHeaderActions() {
    if (!rfq) return null;
    return (
      <div className="flex items-center gap-2">
        {rfq.status === 'DRAFT' && (
          <Button onClick={() => setPublishConfirmOpen(true)} disabled={publishMutation.isPending || (rfq.items?.length || 0) === 0} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
            {publishMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Publish
          </Button>
        )}
        {rfq.status === 'PUBLISHED' && (
          <Button onClick={() => setCloseConfirmOpen(true)} disabled={closeMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
            {closeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />} Close Bidding
          </Button>
        )}
        {rfq.status !== 'AWARDED' && rfq.status !== 'CANCELLED' && (
          <Button variant="destructive" onClick={() => setCancelConfirmOpen(true)} disabled={cancelMutation.isPending}>
            {cancelMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />} Cancel
          </Button>
        )}
      </div>
    );
  }

  if (isLoading) return <div className="flex items-center justify-center h-full py-20 text-muted-foreground">Loading...</div>;
  if (!rfq) return <div className="flex items-center justify-center h-full py-20 text-muted-foreground">RFQ not found</div>;

  const hasAwardedQuote = (rfq.quotes || []).some((q: any) => q.isAwarded);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/rfq')} className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight">{rfq.rfqNumber}</h1>
              <StatusBadge status={rfq.status} />
            </div>
            {rfq.title && <p className="text-sm text-muted-foreground mt-0.5">{rfq.title}</p>}
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
          {/* Status Timeline */}
          <RFQStatusTimeline status={rfq.status} />

          {/* Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Created By</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center text-white text-[10px] font-semibold">
                  {rfq.createdByUser ? getInitials(rfq.createdByUser.firstName, rfq.createdByUser.lastName) : '?'}
                </div>
                <span className="text-sm font-medium">{rfq.createdByUser ? `${rfq.createdByUser.firstName} ${rfq.createdByUser.lastName}` : '—'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Deadline</p>
              <p className="text-sm flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{rfq.deadline ? formatDate(rfq.deadline) : 'Not specified'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Created At</p>
              <p className="text-sm flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{formatDate(rfq.createdAt)}</p>
            </div>
          </div>

          {/* Vendor + PR Reference + Response Link */}
          {(rfq.vendor || rfq.purchaseRequest || rfq.vendorResponseUrl) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
              {rfq.vendor && (
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vendor</p>
                  <p className="text-sm font-medium">{rfq.vendor.name}</p>
                  {rfq.vendor.email && <p className="text-xs text-muted-foreground">{rfq.vendor.email}</p>}
                </div>
              )}
              {rfq.purchaseRequest && (
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">PR Reference</p>
                  <button onClick={() => router.push(`/purchase-requests/${rfq.purchaseRequest.id}`)} className="text-sm font-medium text-primary hover:underline">
                    {rfq.purchaseRequest.requestNumber}
                  </button>
                </div>
              )}
              {rfq.vendorResponseUrl && (
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vendor Response Link</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={rfq.vendorResponseUrl} className="text-xs bg-muted px-2 py-1 rounded border border-border w-full truncate" />
                    <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(rfq.vendorResponseUrl); toast({ title: 'Link copied' }); }}>Copy</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {rfq.notes && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Notes</p>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">{rfq.notes}</p>
            </div>
          )}

          {/* ─── RFQ Items ──────────────────────────────── */}
          <Separator />
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">RFQ Items</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{rfq.items?.length || 0} item{(rfq.items?.length || 0) === 1 ? '' : 's'}</p>
            </div>

            {(!rfq.items || rfq.items.length === 0) ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                <p className="text-sm text-muted-foreground">No items in this RFQ</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                      <th className="text-left px-3 py-2.5 w-[40px]">#</th>
                      <th className="text-left px-3 py-2.5">Description</th>
                      <th className="text-center px-3 py-2.5 w-[80px]">Qty</th>
                      <th className="text-left px-3 py-2.5 w-[80px]">Unit</th>
                      <th className="text-left px-3 py-2.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfq.items.map((item: any, idx: number) => (
                      <tr key={item.id} className="border-t border-border/50 transition-colors hover:bg-accent/30">
                        <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="px-3 py-3 font-medium">{item.description || '—'}</td>
                        <td className="px-3 py-3 text-center font-mono">{item.quantity}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{(item.unit || item.uom || '—').toUpperCase()}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{item.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── Quotes Section ───────────────────────────── */}
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Vendor Quotes</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{rfq.quotes?.length || 0} quote{(rfq.quotes?.length || 0) === 1 ? '' : 's'} received</p>
              </div>
              <div className="flex items-center gap-2">
                {(rfq.quotes?.length || 0) >= 2 && (
                  <Button variant="outline" size="sm" onClick={() => setCompareOpen(!compareOpen)}>
                    <BarChart3 className="h-4 w-4 mr-1.5" /> {compareOpen ? 'Hide Comparison' : 'Compare'}
                  </Button>
                )}
                {(rfq.status === 'PUBLISHED' || rfq.status === 'CLOSED') && (
                  <Button size="sm" onClick={openQuoteModal} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                    <Plus className="h-4 w-4 mr-1.5" /> Add Quote
                  </Button>
                )}
              </div>
            </div>

            {/* Compare Table */}
            {compareOpen && (
              <CompareTable data={compareData?.data} loading={compareLoading} formatCurrency={formatCurrency} />
            )}

            {/* Quote Cards */}
            {(!rfq.quotes || rfq.quotes.length === 0) ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                <p className="text-sm text-muted-foreground">No quotes received yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rfq.quotes.map((quote: any) => (
                  <div key={quote.id} className={cn('border rounded-xl p-4 space-y-3 transition-colors', quote.isAwarded ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-900/10' : 'border-border')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center text-white text-[10px] font-semibold">
                          {quote.vendor ? getInitials(quote.vendor.name, '') : '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{quote.vendor?.name || '—'}</p>
                          {quote.isAwarded && <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Awarded</span>}
                        </div>
                      </div>
                      {rfq.status === 'CLOSED' && !hasAwardedQuote && (
                        <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => { setAwardQuoteId(quote.id); setAwardConfirmOpen(true); }}>
                          <Trophy className="h-3.5 w-3.5 mr-1" /> Award
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Total Amount</p>
                        <p className="font-semibold font-mono">{quote.totalAmount ? formatCurrency(quote.totalAmount) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lead Time</p>
                        <p className="font-medium">{quote.leadTime ? `${quote.leadTime} days` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Valid Until</p>
                        <p className="font-medium">{quote.validUntil ? formatDate(quote.validUntil) : '—'}</p>
                      </div>
                    </div>
                    {quote.notes && <p className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">{quote.notes}</p>}
                    {quote.items && quote.items.length > 0 && (
                      <div className="border-t border-border/50 pt-2 space-y-1">
                        {quote.items.map((qi: any) => (
                          <div key={qi.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate max-w-[60%]">{qi.rfqItem?.description || qi.description || '—'}</span>
                            <span className="font-mono font-medium">{formatCurrency(qi.unitPrice || 0)} x {qi.rfqItem?.quantity || qi.quantity || 0}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Comments & Activity ─────────────────────── */}
          <Separator />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[500px]">
            <div className="flex flex-col gap-4 min-h-0">
              <h2 className="text-base font-semibold shrink-0">Comments</h2>
              <div className="flex-1 min-h-0">{rfq.id && <CommentsPanel entityType="RFQ" entityId={rfq.id} />}</div>
            </div>
            <div className="flex flex-col gap-4 min-h-0">
              <h2 className="text-base font-semibold shrink-0">Activity</h2>
              <div className="flex-1 min-h-0">{rfq.id && <ActivityPanel entityType="RFQ" entityId={rfq.id} />}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-5">
          {rfq.id && <DocumentsPanel entityType="RFQ" entityId={rfq.id} />}
        </TabsContent>
      </Tabs>

      {/* ─── Confirm Dialogs ──────────────────────────── */}
      <ConfirmDialog open={publishConfirmOpen} onOpenChange={(o) => !o && setPublishConfirmOpen(false)} title="Publish RFQ" description={`Publish "${rfq.rfqNumber}" and send to vendors?`} confirmLabel="Publish" onConfirm={() => publishMutation.mutate(undefined, { onSuccess: () => setPublishConfirmOpen(false) })} isLoading={publishMutation.isPending} />
      <ConfirmDialog open={closeConfirmOpen} onOpenChange={(o) => !o && setCloseConfirmOpen(false)} title="Close Bidding" description={`Close bidding for "${rfq.rfqNumber}"? No more quotes will be accepted.`} confirmLabel="Close" onConfirm={() => closeMutation.mutate(undefined, { onSuccess: () => setCloseConfirmOpen(false) })} isLoading={closeMutation.isPending} />
      <ConfirmDialog open={cancelConfirmOpen} onOpenChange={(o) => !o && setCancelConfirmOpen(false)} title="Cancel RFQ" description={`Cancel "${rfq.rfqNumber}"? This action cannot be undone.`} confirmLabel="Cancel RFQ" variant="destructive" onConfirm={() => cancelMutation.mutate(undefined, { onSuccess: () => setCancelConfirmOpen(false) })} isLoading={cancelMutation.isPending} />
      <ConfirmDialog open={awardConfirmOpen} onOpenChange={(o) => !o && setAwardConfirmOpen(false)} title="Award Quote" description="Award this quote? The vendor will be notified." confirmLabel="Award" onConfirm={() => awardMutation.mutate(awardQuoteId, { onSuccess: () => setAwardConfirmOpen(false) })} isLoading={awardMutation.isPending} />

      {/* ─── Add Quote Modal ──────────────────────────── */}
      <Dialog open={quoteModalOpen} onOpenChange={(o) => { if (!o) setQuoteModalOpen(false); }}>
        <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] overflow-y-auto">
          <div className="px-5 pt-5 pb-3">
            <DialogTitle className="text-sm font-semibold">Add Vendor Quote</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Enter a quote from a vendor for this RFQ.</p>
          </div>
          <div className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Vendor <span className="text-red-500">*</span></Label>
              <SearchableSelect
                options={vendorOptions}
                value={quoteForm.vendorId}
                onChange={(v) => setQuoteForm({ ...quoteForm, vendorId: v })}
                placeholder="Select vendor..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Lead Time (days)</Label>
                <Input type="number" min="0" value={quoteForm.leadTime} onChange={(e) => setQuoteForm({ ...quoteForm, leadTime: e.target.value })} placeholder="e.g. 14" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Valid Until</Label>
                <Input type="date" value={quoteForm.validUntil} onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea value={quoteForm.notes} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} placeholder="Optional notes..." rows={2} />
            </div>

            {/* Item Pricing */}
            <div className="space-y-2">
              <Label className="text-[13px]">Item Pricing</Label>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-[10px] uppercase tracking-wider">
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-center px-3 py-2 w-[60px]">Qty</th>
                      <th className="text-right px-3 py-2 w-[100px]">Unit Price</th>
                      <th className="text-right px-3 py-2 w-[90px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rfq.items || []).map((item: any, idx: number) => {
                      const quoteItem = quoteForm.items[idx];
                      const total = (quoteItem?.unitPrice || 0) * (item.quantity || 0);
                      return (
                        <tr key={item.id} className="border-t border-border/50">
                          <td className="px-3 py-2 text-sm">{item.description || '—'}</td>
                          <td className="px-3 py-2 text-center font-mono">{item.quantity}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-7 text-xs text-right"
                              value={quoteItem?.unitPrice || ''}
                              onChange={(e) => {
                                const newItems = [...quoteForm.items];
                                newItems[idx] = { ...newItems[idx], unitPrice: Number.parseFloat(e.target.value) || 0 };
                                setQuoteForm({ ...quoteForm, items: newItems });
                              }}
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-medium">{formatCurrency(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/30">
                      <td colSpan={3} className="px-3 py-2 text-right font-medium">Grand Total</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {formatCurrency(quoteForm.items.reduce((sum, qi, idx) => sum + (qi.unitPrice || 0) * ((rfq.items || [])[idx]?.quantity || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setQuoteModalOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90" onClick={submitQuote} disabled={!quoteForm.vendorId || addQuoteMutation.isPending}>
                {addQuoteMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save Quote
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Compare Table Component ──────────────────────────────
function CompareTable({ data, loading, formatCurrency }: Readonly<{ data: any; loading: boolean; formatCurrency: (n: number) => string }>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 border border-border rounded-xl">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !data.items || !data.quotes) {
    return (
      <div className="text-center py-8 border border-border rounded-xl">
        <p className="text-sm text-muted-foreground">No comparison data available</p>
      </div>
    );
  }

  const { items, quotes } = data;

  function getLowestVendorId(vendorPrices: any[]): string | null {
    let lowestId: string | null = null;
    let lowestPrice = Infinity;
    for (const vp of vendorPrices) {
      if (vp.unitPrice !== null && vp.unitPrice > 0 && vp.unitPrice < lowestPrice) {
        lowestPrice = vp.unitPrice;
        lowestId = vp.vendorId;
      }
    }
    return lowestId;
  }

  return (
    <div className="border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
            <th className="text-left px-3 py-2.5">Item</th>
            <th className="text-center px-3 py-2.5 w-[60px]">Qty</th>
            {quotes.map((q: any) => (
              <th key={q.quoteId} className="text-right px-3 py-2.5 min-w-[100px]">{q.vendorName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item: any) => {
            const lowestVendorId = getLowestVendorId(item.vendorPrices || []);
            return (
              <tr key={item.rfqItemId} className="border-t border-border/50">
                <td className="px-3 py-2.5 font-medium">{item.description}</td>
                <td className="px-3 py-2.5 text-center font-mono text-xs">{item.quantity}</td>
                {quotes.map((q: any) => {
                  const vp = (item.vendorPrices || []).find((v: any) => v.vendorId === q.vendorId);
                  const price = vp?.unitPrice;
                  const isLowest = q.vendorId === lowestVendorId && price > 0;
                  return (
                    <td key={q.quoteId} className={cn('px-3 py-2.5 text-right font-mono text-xs', isLowest && 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 font-semibold')}>
                      {price !== null && price > 0 ? formatCurrency(price) : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted/30 font-semibold">
            <td className="px-3 py-2.5" colSpan={2}>Total</td>
            {quotes.map((q: any) => (
              <td key={q.quoteId} className="px-3 py-2.5 text-right font-mono">{formatCurrency(q.totalAmount || 0)}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
