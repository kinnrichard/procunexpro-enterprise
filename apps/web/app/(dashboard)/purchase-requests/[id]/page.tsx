'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, formatDateTime, getInitials, cn } from '@/lib/utils';
import { useCurrencyStore } from '@/lib/currency';
import { useTaxStore } from '@/lib/tax';
import { StatusBadge } from '@/components/status-badge';
import { DocumentsPanel } from '@/components/documents-panel';
import { CommentsPanel } from '@/components/comments-panel';
import { ActivityPanel } from '@/components/activity-panel';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ArrowLeft, Plus, Trash2, Loader2, Send, CheckCircle, XCircle, X, Filter,
  Clock, FileText, Link2, Ban, ChevronRight, Building2, Calendar, Pencil, Info, Package, FileSearch, ShoppingCart,
} from 'lucide-react';

type Vendor = { id: string; name: string };

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// ─── Status Timeline ──────────────────────────────────────
const statusOrder = ['DRAFT', 'MANAGER_APPROVAL', 'FINANCE_APPROVAL', 'PROCUREMENT', 'COMPLETED'];

const PROCUREMENT_SUB_STATUSES = [
  { value: 'READY_TO_START', label: 'Ready to Start' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_ON_VENDOR', label: 'Waiting on Vendor Quotation' },
  { value: 'WAITING_ON_REQUESTOR', label: 'Waiting on Requestor' },
  { value: 'COMPLETED', label: 'Completed' },
];

const STAGE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  MANAGER_APPROVAL: 'Manager Approval',
  FINANCE_APPROVAL: 'Finance Approval',
  PROCUREMENT: 'Procurement',
  COMPLETED: 'Completed',
};

type ApprovalStepData = { stepOrder: number; role: string; action?: string; comment?: string; actionAt?: string; user?: { id: string; firstName: string; lastName: string } | null };

function StatusTimeline({ status, rejectionNote, rejectedAtStage, procurementSubStatus, approvalSteps = [], createdAt, requestedBy }: Readonly<{
  status: string; rejectionNote?: string; rejectedAtStage?: string; procurementSubStatus?: string;
  approvalSteps?: ApprovalStepData[]; createdAt?: string;
  requestedBy?: { firstName: string; lastName: string } | null;
}>) {
  const isRejected = status === 'REJECTED';
  const isCancelled = status === 'CANCELLED';
  const currentIndex = isRejected
    ? statusOrder.indexOf(rejectedAtStage || 'MANAGER_APPROVAL')
    : statusOrder.indexOf(status);

  const rejectionStep = isRejected
    ? approvalSteps.find(s => s.action === 'REJECTED')
    : null;

  function getStepForStage(stageKey: string): ApprovalStepData | undefined {
    const stageIndex = statusOrder.indexOf(stageKey);
    return approvalSteps.find(s => s.stepOrder === stageIndex && s.action === 'APPROVED');
  }

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="flex items-center gap-0 mb-4">
        {statusOrder.map((stageKey, i) => {
          const isDone = currentIndex > i;
          const isCurrent = currentIndex === i;
          const isRejectedStage = isRejected && rejectedAtStage === stageKey;
          return (
            <div key={stageKey} className="flex items-center flex-1 last:flex-none">
              <div className={cn(
                'w-3 h-3 rounded-full border-2 shrink-0 transition-all',
                isDone && 'bg-emerald-500 border-emerald-500',
                isCurrent && !isRejectedStage && 'bg-primary border-primary ring-4 ring-primary/10',
                isRejectedStage && 'bg-red-500 border-red-500 ring-4 ring-red-500/10',
                !isDone && !isCurrent && !isRejectedStage && 'bg-background border-muted-foreground/30',
              )} />
              {i < statusOrder.length - 1 && (
                <div className={cn('h-0.5 flex-1 mx-1', isDone ? 'bg-emerald-500' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-5 gap-3">
        {statusOrder.map((stageKey, i) => {
          const isDone = currentIndex > i;
          const isCurrent = currentIndex === i;
          const isUpcoming = currentIndex < i;
          const isRejectedStage = isRejected && rejectedAtStage === stageKey;
          const isDraft = stageKey === 'DRAFT';

          const step = getStepForStage(stageKey);
          const approvedBy = step?.user;
          const approvedAt = step?.actionAt;

          return (
            <div
              key={stageKey}
              className={cn(
                'rounded-lg border p-3 transition-all',
                'bg-background',
                isRejectedStage ? 'border-red-300 dark:border-red-800' : isCurrent ? 'border-primary/40' : 'border-border',
                isUpcoming && !isRejected && 'opacity-35',
              )}
            >
              {/* Label + status indicator */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-foreground">{STAGE_LABELS[stageKey]}</p>
                {isDone && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                {isRejectedStage && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                {isCurrent && !isRejectedStage && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
              </div>

              {/* Content */}
              <div className="space-y-1 min-h-[32px]">
                {isDraft && requestedBy && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center text-white text-[8px] font-semibold shrink-0">
                        {getInitials(requestedBy.firstName, requestedBy.lastName)}
                      </div>
                      <span className="text-[11px] text-foreground truncate">{requestedBy.firstName} {requestedBy.lastName}</span>
                    </div>
                    {createdAt && <p className="text-[10px] text-muted-foreground">{formatDateTime(createdAt)}</p>}
                  </>
                )}

                {!isDraft && isDone && approvedBy && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center text-white text-[8px] font-semibold shrink-0">
                        {getInitials(approvedBy.firstName, approvedBy.lastName)}
                      </div>
                      <span className="text-[11px] text-foreground truncate">{approvedBy.firstName} {approvedBy.lastName}</span>
                    </div>
                    {approvedAt && <p className="text-[10px] text-muted-foreground">{formatDateTime(approvedAt)}</p>}
                  </>
                )}

                {!isDraft && isDone && !approvedBy && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Approved</p>
                )}

                {isRejectedStage && (
                  <>
                    {rejectionStep?.user && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-[8px] font-semibold shrink-0">
                          {getInitials(rejectionStep.user.firstName, rejectionStep.user.lastName)}
                        </div>
                        <span className="text-[11px] text-foreground truncate">{rejectionStep.user.firstName} {rejectionStep.user.lastName}</span>
                      </div>
                    )}
                    {rejectionStep?.actionAt && <p className="text-[10px] text-muted-foreground">{formatDateTime(rejectionStep.actionAt)}</p>}
                    {rejectionNote && <p className="text-[10px] text-red-500 mt-1 line-clamp-2">{rejectionNote}</p>}
                  </>
                )}

                {isCurrent && !isDraft && !isRejected && (
                  <p className="text-[10px] text-muted-foreground">Awaiting approval</p>
                )}

                {isUpcoming && !isRejected && (
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                )}

                {stageKey === 'PROCUREMENT' && (isCurrent || isDone) && procurementSubStatus && (
                  <div className="mt-1">
                    <StatusBadge status={procurementSubStatus} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isCancelled && (
        <div className="flex items-center gap-2 p-3 mt-3 rounded-lg border border-red-200 dark:border-red-800">
          <Ban className="h-4 w-4 text-red-500" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400">Cancelled</p>
        </div>
      )}
    </div>
  );
}

// ─── Inline Edit Cell ─────────────────────────────────────
function InlineEditCell({ value, onSave, type = 'number', prefix, suffix, align = 'right', disabled, integer, stepper, toast: toastFn }: Readonly<{
  value: number; onSave: (val: number) => void; type?: string; prefix?: string; suffix?: string; align?: 'left' | 'right' | 'center'; disabled?: boolean; integer?: boolean; stepper?: boolean; toast?: (opts: any) => void;
}>) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(String(value));

  const startEdit = (e: React.MouseEvent) => { e.stopPropagation(); setLocalVal(String(value)); setEditing(true); };
  const decrement = (e: React.MouseEvent) => { e.stopPropagation(); const n = Math.max(1, value - 1); if (n !== value) onSave(n); };
  const increment = (e: React.MouseEvent) => { e.stopPropagation(); onSave(value + 1); };
  let alignClass = '';
  if (align === 'right') alignClass = 'text-right';
  else if (align === 'center') alignClass = 'text-center';

  const clampInteger = (num: number): number => {
    const raw = num;
    const clamped = Math.min(Math.max(num > 0 ? Math.round(num) : 0, 0), 100);
    if (raw > 100 && toastFn) toastFn({ title: 'Invalid discount', description: 'Discount cannot exceed 100%.', variant: 'destructive' });
    else if (raw > 0 && raw < 1 && toastFn) toastFn({ title: 'Invalid discount', description: 'Discount must be at least 1%.', variant: 'destructive' });
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

  const stepperBtn = (label: string, onClick: (e: React.MouseEvent) => void, borderCls: string) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`w-6 shrink-0 flex items-center justify-center border ${borderCls} bg-muted hover:bg-accent transition-colors text-muted-foreground text-xs`}>{label}</button>
  );

  // Idle stepper
  if (!editing && stepper && !disabled) {
    return (
      <div className="flex items-stretch gap-0">
        {stepperBtn('−', decrement, 'border-border/60')}
        <button type="button" onClick={startEdit} className="flex-1 font-mono text-xs px-2 py-1.5 transition-colors border-y border-border/60 bg-background hover:border-primary/40 cursor-text text-center">{prefix}{value}{suffix}</button>
        {stepperBtn('+', increment, 'border-border/60')}
      </div>
    );
  }

  // Idle display
  if (!editing) {
    return (
      <button type="button" onClick={(e) => { if (!disabled) startEdit(e); }} className={cn('w-full font-mono text-xs px-2 py-1.5 transition-colors', disabled ? '' : 'border border-border/60 bg-background hover:border-primary/40 cursor-text rounded-none', alignClass)}>
        {prefix}{value}{suffix}
      </button>
    );
  }

  // Editing input
  const inputEl = (
    <input type={type} step="0.01" autoFocus value={localVal} onChange={(e) => setLocalVal(e.target.value)} onClick={(e) => e.stopPropagation()} onBlur={handleBlur} onKeyDown={handleKeyDown}
      className={cn('w-full font-mono text-xs px-1 py-0.5 border border-primary/50 bg-background outline-none focus:ring-1 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none', alignClass)} />
  );

  if (stepper) {
    const stepEdit = (delta: number) => () => { const n = Math.max(1, (Number.parseInt(localVal) || 1) + delta); setLocalVal(String(n)); onSave(n); setEditing(false); };
    return (
      <div className="flex items-stretch gap-0">
        {stepperBtn('−', stepEdit(-1), 'border-primary/50 border-r-0')}
        {inputEl}
        {stepperBtn('+', stepEdit(1), 'border-primary/50 border-l-0')}
      </div>
    );
  }

  return inputEl;
}

// ─── Helpers ──────────────────────────────────────────────
function matchesSearch(item: any, query: string): boolean {
  const q = query.toLowerCase();
  const name = (item.product?.name || item.description || '').toLowerCase();
  const sku = (item.product?.sku || '').toLowerCase();
  const vendor = (item.vendor?.name || '').toLowerCase();
  return name.includes(q) || sku.includes(q) || vendor.includes(q);
}

function matchesBoolFilter(value: boolean, filter: string): boolean {
  if (filter === 'yes') return value;
  if (filter === 'no') return !value;
  return true;
}

function filterLineItems(items: any[], filters: { vendorId: string; taxable: string; taxIncl: string; priceMin: string; priceMax: string; search: string }) {
  const minPrice = filters.priceMin ? Number.parseFloat(filters.priceMin) : null;
  const maxPrice = filters.priceMax ? Number.parseFloat(filters.priceMax) : null;
  return items.filter((item: any) => {
    if (filters.vendorId && item.vendor?.id !== filters.vendorId) return false;
    if (!matchesBoolFilter(item.taxable, filters.taxable)) return false;
    if (!matchesBoolFilter(item.taxIncluded, filters.taxIncl)) return false;
    if (minPrice !== null && (item.estimatedPrice || 0) < minPrice) return false;
    if (maxPrice !== null && (item.estimatedPrice || 0) > maxPrice) return false;
    if (filters.search && !matchesSearch(item, filters.search)) return false;
    return true;
  });
}

function calcLineAmount(item: any, taxRate: number) {
  const vp = getVendorPricing(item);
  const pkgQty = item.quantity || vp.opQty;
  const invQty = pkgQty * vp.pcsPerPack;
  const subtotal = invQty * (item.estimatedPrice || 0);
  const discounted = subtotal - (subtotal * (item.discount || 0) / 100);
  if (item.taxable && taxRate > 0 && !item.taxIncluded) {
    return discounted + (discounted * taxRate / 100);
  }
  return discounted;
}

function getFilteredProducts(products: any[], search: string) {
  if (!search) return products.slice(0, 10);
  const q = search.toLowerCase();
  return products
    .filter((p: any) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.manufacturer?.name?.toLowerCase().includes(q))
    .slice(0, 50);
}

function getVendorPricing(item: any) {
  if (item.vendor?.id && item.product?.pricings) {
    const pricing = item.product.pricings.find((p: any) => p.vendorId === item.vendor.id);
    if (pricing) return { opQty: pricing.originalPackagingQty || 1, pcsPerPack: pricing.pcsPerPack || 1, uom: pricing.originalPackagingUom || 'pcs' };
  }
  return { opQty: 1, pcsPerPack: 1, uom: 'pcs' };
}

// ─── Main Component ───────────────────────────────────────
// ─── RFQ Summary Modal ───────────────────────────────────
function RfqSummaryModal({ rfqId, prNumber, onClose }: Readonly<{ rfqId: string | null; prNumber?: string; onClose: () => void }>) {
  const formatCurrency = useCurrencyStore((s) => s.format);

  const { data: rfqRes, isLoading } = useQuery({
    queryKey: ['rfq-summary', rfqId],
    queryFn: () => api.get(`/rfq/${rfqId}`),
    enabled: !!rfqId,
  });

  const rfq = rfqRes?.data;

  return (
    <Dialog open={!!rfqId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {rfq && (
          <>
            <div className="px-5 pt-5 pb-3 border-b">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-sm font-semibold">{rfq.rfqNumber}</DialogTitle>
                <StatusBadge status={rfq.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{rfq.title}</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Vendor</p>
                  <p className="text-sm font-medium mt-0.5">{rfq.vendor?.name || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">PR Reference</p>
                  <p className="text-sm font-medium mt-0.5">{prNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Created</p>
                  <p className="text-sm mt-0.5">{rfq.createdAt ? formatDateTime(rfq.createdAt) : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Quotes</p>
                  <p className="text-sm mt-0.5">{rfq.quotes?.length || 0} received</p>
                </div>
              </div>

              {/* Items table */}
              {rfq.items?.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Items ({rfq.items.length})</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground">Qty</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rfq.items.map((item: any, idx: number) => (
                          <tr key={item.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium">{item.description}</td>
                            <td className="px-3 py-2 text-center font-mono">{item.quantity}</td>
                            <td className="px-3 py-2 text-center text-muted-foreground">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t flex justify-between">
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
              <a href={`/rfq/${rfq.id}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">View RFQ Details</Button>
              </a>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PurchaseRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formatCurrency = useCurrencyStore((s) => s.format);
  const currencySymbol = useCurrencyStore((s) => s.symbol);
  const prId = params.id as string;

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<any>(null);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [coaModalOpen, setCoaModalOpen] = useState(false);
  const [coaItemId, setCoaItemId] = useState('');
  const [coaFormData, setCoaFormData] = useState({ glAccountId: '', debitAmount: 0, creditAmount: 0, accountRemarks: '' });
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [createRfqConfirmOpen, setCreateRfqConfirmOpen] = useState(false);
  const [createPoConfirmOpen, setCreatePoConfirmOpen] = useState(false);
  const [rfqSummaryId, setRfqSummaryId] = useState<string | null>(null);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [editPrOpen, setEditPrOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editRequiredDate, setEditRequiredDate] = useState<Date | undefined>();
  const [editPurchaseTerms, setEditPurchaseTerms] = useState('');
  const [editDeliveryTerms, setEditDeliveryTerms] = useState('');
  const [editDeliveryType, setEditDeliveryType] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [quickPriceOpen, setQuickPriceOpen] = useState(false);
  const [quickPriceVendorId, setQuickPriceVendorId] = useState('');
  const [quickPriceType, setQuickPriceType] = useState('local');
  const [quickPriceUnitCost, setQuickPriceUnitCost] = useState('');
  const [quickPriceSellingPrice, setQuickPriceSellingPrice] = useState('');
  const [quickPriceOpQty, setQuickPriceOpQty] = useState('1');
  const [quickPricePcsPerPack, setQuickPricePcsPerPack] = useState('1');
  const [quickPriceUom, setQuickPriceUom] = useState('');
  const [quickPriceSaving, setQuickPriceSaving] = useState(false);
  const [quickPriceProduct, setQuickPriceProduct] = useState<any>(null);

  // Item form state
  const [itemProductId, setItemProductId] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState('');
  const [itemVendorId, setItemVendorId] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [itemDiscount, setItemDiscount] = useState(0);
  const [itemTaxable, setItemTaxable] = useState(false);
  const [itemTaxIncluded, setItemTaxIncluded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productPricings, setProductPricings] = useState<any[]>([]);

  // Multi-select add items
  const [addItemSearch, setAddItemSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Map<string, { product: any; pricings: any[]; selectedPricingVendorId: string }>>(new Map());
  const [addingItems, setAddingItems] = useState(false);

  // Multi-select delete items
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Line item search, filter & pagination
  const [itemSearch, setItemSearch] = useState('');
  const [itemVendorFilter, setItemVendorFilter] = useState('');
  const [itemTaxableFilter, setItemTaxableFilter] = useState('');
  const [itemTaxInclFilter, setItemTaxInclFilter] = useState('');
  const [itemPriceMin, setItemPriceMin] = useState('');
  const [itemPriceMax, setItemPriceMax] = useState('');
  const [itemPage, setItemPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const { data: prData, isLoading } = useQuery({
    queryKey: ['pr-detail', prId],
    queryFn: () => api.get(`/purchase-requests/${prId}`),
  });
  const pr = prData?.data;

  const taxRate = useTaxStore((s) => s.getDefaultRate)();

  // Only approved vendors may be selected on a PR (same rule as PO).
  const { data: vendorsRes } = useQuery({
    queryKey: ['vendors-approved'],
    queryFn: () => api.get('/vendors', { params: { limit: 1000, status: 'APPROVED' } }),
  });
  const vendors: Vendor[] = vendorsRes?.data?.data || [];

  const { data: deptData } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/departments', { params: { limit: 1000 } }),
  });
  const departments = (deptData?.data?.data || []).map((d: any) => ({ value: d.id, label: d.name }));

  const { data: ptData } = useQuery({ queryKey: ['purchase-terms-active'], queryFn: () => api.get('/purchase-terms/active') });
  const purchaseTermOptions = (ptData?.data?.data || []).map((t: any) => ({ value: t.name, label: t.name }));

  const { data: ddData } = useQuery({ queryKey: ['delivery-terms-active'], queryFn: () => api.get('/delivery-terms/active') });
  const deliveryTermOptions = (ddData?.data?.data || []).map((d: any) => ({ value: d.name, label: d.name }));

  const { data: dtData } = useQuery({ queryKey: ['delivery-types-active'], queryFn: () => api.get('/delivery-types/active') });
  const deliveryTypeOptions = (dtData?.data?.data || []).map((d: any) => ({ value: d.name, label: d.name }));

  const { data: currenciesRes } = useQuery({
    queryKey: ['currencies-active'],
    queryFn: () => api.get('/currencies/active'),
  });

  const { data: glAccountsRes } = useQuery({
    queryKey: ['gl-accounts-active'],
    queryFn: () => api.get('/gl-accounts/active'),
  });
  const glAccountOptions = (glAccountsRes?.data?.data || []).map((g: any) => ({ value: g.id, label: `${g.code} - ${g.title || g.name}` }));
  const defaultCurrency = (currenciesRes?.data?.data || []).find((c: any) => c.isDefault)?.code || 'USD';

  const { data: productsRes } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => api.get('/products', { params: { limit: 1000 } }),
  });
  const products: any[] = productsRes?.data?.data || [];

  const isDraft = pr?.status === 'DRAFT';

  const filteredItems = filterLineItems(pr?.items || [], {
    vendorId: itemVendorFilter, taxable: itemTaxableFilter, taxIncl: itemTaxInclFilter,
    priceMin: itemPriceMin, priceMax: itemPriceMax, search: itemSearch,
  });

  const itemTotalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice((itemPage - 1) * ITEMS_PER_PAGE, itemPage * ITEMS_PER_PAGE);

  const itemVendors = [...new Map((pr?.items || []).filter((i: any) => i.vendor).map((i: any) => [i.vendor.id, i.vendor])).values()] as { id: string; name: string }[];

  function inlineSave(itemId: string, field: string, value: number | string | null) {
    updateItemMutation.mutate({ itemId, data: { [field]: value } });
  }

  async function handleProductSelect(productId: string) {
    setItemProductId(productId);
    setItemPrice('');
    setItemVendorId('');
    setProductPricings([]);

    if (!productId) return;

    // Fetch pricings for selected product
    try {
      const { data } = await api.get(`/products/${productId}/pricings-summary`);
      setProductPricings(data.pricings || []);

      // Auto-fill from applied pricing only
      const applied = (data.pricings || []).find((p: any) => p.isApplied);
      if (applied) {
        setItemPrice(String(applied.unitCost));
        setItemVendorId(applied.vendorId);
      }
    } catch {
      // No pricing available
    }
  }

  function handleVendorSelect(vendorId: string) {
    setItemVendorId(vendorId);
    // Auto-fill price from this vendor's pricing
    const vendorPricing = productPricings.find((p: any) => p.vendorId === vendorId);
    if (vendorPricing) {
      setItemPrice(String(vendorPricing.unitCost));
    }
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pr-detail', prId] });
    queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
    queryClient.invalidateQueries({ queryKey: ['audit', 'PURCHASE_REQUEST', prId] });
  };

  // ─── Item Mutations ─────────────────────────────────────
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) => api.patch(`/purchase-requests/${prId}/items/${itemId}`, data),
    onSuccess: () => { invalidate(); closeItemForm(); toast({ title: 'Item updated' }); },
    onError: () => toast({ title: 'Failed to update item', variant: 'destructive' }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/purchase-requests/${prId}/items/${itemId}`),
    onSuccess: () => { invalidate(); toast({ title: 'Item removed' }); },
    onError: () => toast({ title: 'Failed to remove item', variant: 'destructive' }),
  });

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedItemIds).map((id) => api.delete(`/purchase-requests/${prId}/items/${id}`))
      );
      invalidate();
      toast({ title: `${selectedItemIds.size} item${selectedItemIds.size > 1 ? 's' : ''} removed` });
      setSelectedItemIds(new Set());
      setBulkDeleteConfirmOpen(false);
    } catch {
      toast({ title: 'Failed to remove some items', variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleItemSelect(itemId: string) {
    const next = new Set(selectedItemIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSelectedItemIds(next);
  }

  function toggleAllItems() {
    if (!pr?.items) return;
    if (selectedItemIds.size === pr.items.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(pr.items.map((i: any) => i.id)));
    }
  }

  // ─── Status Mutations ──────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: () => api.put(`/purchase-requests/${prId}/submit`),
    onSuccess: () => { invalidate(); toast({ title: 'Submitted for approval' }); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to submit', variant: 'destructive' }),
  });

  const approveMutation = useMutation({
    mutationFn: () => api.put(`/purchase-requests/${prId}/approve`),
    onSuccess: () => { invalidate(); toast({ title: 'Purchase request approved' }); },
    onError: () => toast({ title: 'Failed to approve', variant: 'destructive' }),
  });

  const createRfqMutation = useMutation({
    mutationFn: () => api.post('/rfq/from-purchase-request', { purchaseRequestId: prId }),
    onSuccess: (res) => {
      invalidate();
      const count = res.data?.created || 0;
      toast({ title: `${count} RFQ${count > 1 ? 's' : ''} created`, description: 'Sub-status updated to Waiting on Vendor Quotation' });
    },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to create RFQ', variant: 'destructive' }),
  });

  const createPoMutation = useMutation({
    mutationFn: () => api.post('/purchase-orders/from-pr-items', { itemIds: (pr?.items || []).map((i: any) => i.id) }),
    onSuccess: (res) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setCreatePoConfirmOpen(false);
      const pos = res.data?.purchaseOrders || [];
      const count = res.data?.created || 0;
      toast({ title: `${count} Purchase Order${count === 1 ? '' : 's'} created`, description: 'Grouped by vendor from this request.' });
      if (pos.length === 1) router.push(`/purchase-orders/${pos[0].id}`);
      else router.push('/purchase-orders');
    },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to create PO', variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (note: string) => api.put(`/purchase-requests/${prId}/reject`, { rejectionNote: note }),
    onSuccess: () => { invalidate(); setRejectConfirmOpen(false); setRejectionNote(''); toast({ title: 'Purchase request rejected' }); },
    onError: () => toast({ title: 'Failed to reject', variant: 'destructive' }),
  });

  // ─── Edit PR Details ──────────────────────────────────
  const updatePrMutation = useMutation({
    mutationFn: (data: any) => api.put(`/purchase-requests/${prId}`, data),
    onSuccess: () => { invalidate(); setEditPrOpen(false); toast({ title: 'Purchase request updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-active'],
    queryFn: () => api.get('/companies/active'),
  });
  const companies = (companiesData?.data?.data || []).map((c: any) => ({ value: c.id, label: c.name }));

  const [editCompanyId, setEditCompanyId] = useState('');

  function openEditPr() {
    if (!pr) return;
    setEditCompanyId(pr.companyId || '');
    setEditTitle(pr.title);
    setEditDescription(pr.description || '');
    setEditDepartmentId(pr.departmentId || '');
    setEditPriority(pr.priority);
    setEditRequiredDate(pr.requiredDate ? new Date(pr.requiredDate) : undefined);
    setEditPurchaseTerms(pr.purchaseTerms || '');
    setEditDeliveryTerms(pr.deliveryTerms || '');
    setEditDeliveryType(pr.deliveryType || '');
    setEditNotes(pr.notes || '');
    setEditPrOpen(true);
  }

  function handleEditPrSubmit(e: React.FormEvent) {
    e.preventDefault();
    updatePrMutation.mutate({
      companyId: editCompanyId || undefined,
      title: editTitle,
      description: editDescription || null,
      departmentId: editDepartmentId || null,
      priority: editPriority,
      requiredDate: editRequiredDate?.toISOString() || null,
      purchaseTerms: editPurchaseTerms || null,
      deliveryTerms: editDeliveryTerms || null,
      deliveryType: editDeliveryType || null,
      notes: editNotes || null,
    });
  }

  // ─── Item Form Helpers ─────────────────────────────────
  function openAddItem() {
    setEditItem(null);
    setAddItemSearch('');
    setSelectedProducts(new Map());
    setAddItemOpen(true);
  }

  async function openEditItem(item: any) {
    setEditItem(item);
    setItemProductId(item.productId || '');
    setItemQty(item.quantity);
    setItemPrice(item.estimatedPrice !== null && item.estimatedPrice !== undefined ? String(item.estimatedPrice) : '');
    setItemVendorId(item.vendorId || '');
    setItemNotes(item.notes || '');
    setItemDiscount(item.discount || 0);
    setItemTaxable(item.taxable || false);
    setItemTaxIncluded(item.taxIncluded || false);
    setProductPricings([]);
    setAddItemOpen(true);

    if (item.productId) {
      try {
        const { data } = await api.get(`/products/${item.productId}/pricings-summary`);
        setProductPricings(data.pricings || []);
      } catch {}
    }
  }

  function closeItemForm() { setAddItemOpen(false); setEditItem(null); setIsSubmitting(false); setProductPricings([]); setSelectedProducts(new Map()); }

  async function toggleProductSelect(product: any) {
    const next = new Map(selectedProducts);
    if (next.has(product.id)) {
      next.delete(product.id);
    } else {
      next.set(product.id, { product, pricings: [], selectedPricingVendorId: '' });
      // Fetch pricings
      try {
        const { data } = await api.get(`/products/${product.id}/pricings-summary`);
        const pricings = data.pricings || [];
        const applied = pricings.find((p: any) => p.isApplied);
        next.set(product.id, { product, pricings, selectedPricingVendorId: applied?.vendorId || '' });
      } catch {}
    }
    setSelectedProducts(next);
  }

  function setProductPricingVendor(productId: string, vendorId: string) {
    const next = new Map(selectedProducts);
    const entry = next.get(productId);
    if (entry) {
      next.set(productId, { ...entry, selectedPricingVendorId: vendorId });
    }
    setSelectedProducts(next);
  }

  async function handleAddSelectedItems() {
    setAddingItems(true);
    try {
      for (const [productId, entry] of selectedProducts) {
        const pricing = entry.pricings.find((p: any) => p.vendorId === entry.selectedPricingVendorId);
        await api.post(`/purchase-requests/${prId}/items`, {
          productId,
          quantity: 1,
          estimatedPrice: pricing?.unitCost ?? undefined,
          vendorId: entry.selectedPricingVendorId || null,
        });
      }
      invalidate();
      closeItemForm();
      toast({ title: `${selectedProducts.size} item${selectedProducts.size > 1 ? 's' : ''} added` });
    } catch {
      toast({ title: 'Error', description: 'Failed to add items.', variant: 'destructive' });
    } finally {
      setAddingItems(false);
    }
  }

  function handleEditItemSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    const data = {
      productId: itemProductId,
      quantity: itemQty,
      estimatedPrice: itemPrice ? Number.parseFloat(itemPrice) : undefined,
      vendorId: itemVendorId || null,
      notes: itemNotes || undefined,
      discount: itemDiscount,
      taxable: itemTaxable,
      taxIncluded: itemTaxIncluded,
    };
    updateItemMutation.mutate({ itemId: editItem.id, data }, { onSettled: () => setIsSubmitting(false) });
  }

  function openQuickPrice(product: any) {
    setQuickPriceProduct(product);
    setQuickPriceVendorId('');
    setQuickPriceType('local');
    setQuickPriceUnitCost('');
    setQuickPriceSellingPrice('');
    setQuickPriceOpQty('1');
    setQuickPricePcsPerPack('1');
    setQuickPriceUom('');
    setQuickPriceOpen(true);
  }

  async function handleQuickPriceSave() {
    if (!quickPriceProduct || !quickPriceVendorId || !quickPriceUnitCost) return;
    setQuickPriceSaving(true);
    try {
      await api.post(`/products/${quickPriceProduct.id}/pricings`, {
        vendorId: quickPriceVendorId,
        type: quickPriceType,
        originalPackagingQty: Number.parseInt(quickPriceOpQty) || 1,
        pcsPerPack: Number.parseInt(quickPricePcsPerPack) || 1,
        originalPackagingUom: quickPriceUom || 'pcs',
        unitCost: Number.parseFloat(quickPriceUnitCost),
        sellingPrice: quickPriceSellingPrice ? Number.parseFloat(quickPriceSellingPrice) : Number.parseFloat(quickPriceUnitCost),
        currency: defaultCurrency,
        minOrderQty: 1,
        effectiveDate: new Date().toISOString().split('T')[0],
      });
      toast({ title: 'Pricing added', description: `Pricing added for ${quickPriceProduct.name}` });
      setQuickPriceOpen(false);
      setQuickPriceProduct(null);
      // Refresh products list so _count updates
      queryClient.invalidateQueries({ queryKey: ['products-all'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to add pricing.', variant: 'destructive' });
    } finally {
      setQuickPriceSaving(false);
    }
  }

  // Filtered products for the picker
  const filteredProducts = getFilteredProducts(products, addItemSearch);

  const procurementSubStatusMutation = useMutation({
    mutationFn: (subStatus: string) => api.put(`/purchase-requests/${prId}/procurement-sub-status`, { subStatus }),
    onSuccess: () => { invalidate(); toast({ title: 'Sub-status updated' }); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to update sub-status', variant: 'destructive' }),
  });

  const totalAmount = pr?.items?.reduce((sum: number, item: any) => sum + calcLineAmount(item, taxRate), 0) || 0;

  if (isLoading) return <div className="flex items-center justify-center h-full py-20 text-muted-foreground">Loading…</div>;
  if (!pr) return <div className="flex items-center justify-center h-full py-20 text-muted-foreground">Purchase request not found</div>;

  const isApprovalStage = ['MANAGER_APPROVAL', 'FINANCE_APPROVAL', 'PROCUREMENT'].includes(pr?.status);
  // PROCUREMENT is NOT manually "approved" to COMPLETED — the PR auto-completes
  // once its items are converted to a PO. So no manual approve/complete button here.
  const canApproveStage = ['MANAGER_APPROVAL', 'FINANCE_APPROVAL'].includes(pr?.status);
  const approvalStageLabel: Record<string, string> = {
    MANAGER_APPROVAL: 'Manager Approve',
    FINANCE_APPROVAL: 'Finance Approve',
  };

  function renderHeaderActions() {
    return (
      <div className="flex items-center gap-2">
        {isDraft && (
          <Button variant="outline" size="sm" onClick={openEditPr}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        )}
        {isDraft && (
          <Button onClick={() => setSubmitConfirmOpen(true)} disabled={submitMutation.isPending || (pr.items?.length || 0) === 0} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Submit for Approval
          </Button>
        )}
        {isApprovalStage && (
          <>
            {canApproveStage && (
              <Button onClick={() => setApproveConfirmOpen(true)} disabled={approveMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="h-4 w-4 mr-2" /> {approvalStageLabel[pr.status] || 'Approve'}
              </Button>
            )}
            <Button variant="destructive" onClick={() => setRejectConfirmOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" /> Reject
            </Button>
          </>
        )}
      </div>
    );
  }

  // Header checkbox state
  const headerAllSelected = selectedItemIds.size > 0 && selectedItemIds.size === pr.items?.length;
  const headerSomeSelected = selectedItemIds.size > 0 && !headerAllSelected;
  const headerCheckboxClass = (() => {
    if (headerAllSelected) return 'bg-primary border-primary';
    if (headerSomeSelected) return 'border-primary bg-primary/20';
    return 'border-border';
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/purchase-requests')} className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight">{pr.requestNumber}</h1>
              <StatusBadge status={pr.status} />
              <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', priorityColors[pr.priority])}>{pr.priority}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{pr.title}</p>
          </div>
        </div>
        {renderHeaderActions()}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            Documents
          </TabsTrigger>
        </TabsList>

        {/* ─── Details Tab ──────────────────────────────── */}
        <TabsContent value="details" className="mt-5 space-y-6">
          <div className="flex items-center justify-between">
            <div />
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Amount</p>
              <p className="text-2xl font-bold font-mono text-primary">{formatCurrency(totalAmount)}</p>
            </div>
          </div>

          <StatusTimeline
            status={pr.status}
            rejectionNote={pr.rejectionNote}
            rejectedAtStage={pr.rejectedAtStage}
            procurementSubStatus={pr.procurementSubStatus}
            approvalSteps={pr.approvalSteps || []}
            createdAt={pr.createdAt}
            requestedBy={pr.requestedBy}
          />

          {pr.status === 'PROCUREMENT' && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Sub-status:</span>
                <Select value={pr.procurementSubStatus || ''} onValueChange={(v) => procurementSubStatusMutation.mutate(v)}>
                  <SelectTrigger className="h-7 w-[220px] border-border text-xs">
                    <SelectValue placeholder="Set sub-status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCUREMENT_SUB_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                {!(pr.rfqs?.length > 0) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCreateRfqConfirmOpen(true)}
                    disabled={createRfqMutation.isPending || (pr.items?.length || 0) === 0}
                  >
                    {createRfqMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5 mr-1.5" />}
                    Create RFQ
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setCreatePoConfirmOpen(true)}
                  disabled={createPoMutation.isPending || (pr.items?.length || 0) === 0}
                  className="bg-gradient-primary text-white"
                >
                  {createPoMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />}
                  Create PO
                </Button>
              </div>
            </div>
          )}

          {/* Linked RFQs */}
          {pr.rfqs?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">RFQ Created</p>
              <div className="flex flex-wrap gap-2">
                {pr.rfqs.map((rfq: any) => (
                  <button
                    key={rfq.id}
                    onClick={() => setRfqSummaryId(rfq.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-left"
                  >
                    <FileSearch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground">{rfq.rfqNumber}</p>
                        <StatusBadge status={rfq.status} />
                      </div>
                      {rfq.vendor && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          <span className="font-medium text-foreground">{rfq.vendor.name}</span>
                          {' · '}{pr.requestNumber}
                        </p>
                      )}
                      {!rfq.vendor && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          No vendor · {pr.requestNumber}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Requested By</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center text-white text-[10px] font-semibold">
                  {pr.requestedBy ? getInitials(pr.requestedBy.firstName, pr.requestedBy.lastName) : '?'}
                </div>
                <span className="text-sm font-medium">{pr.requestedBy ? `${pr.requestedBy.firstName} ${pr.requestedBy.lastName}` : '—'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Company</p>
              <p className="text-sm font-medium flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{pr.company?.name || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Department</p>
              <p className="text-sm font-medium flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{pr.department?.name || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Priority</p>
              <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', priorityColors[pr.priority])}>{pr.priority}</span>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Required Date</p>
              <p className="text-sm flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{pr.requiredDate ? formatDate(pr.requiredDate) : 'Not specified'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Created</p>
              <p className="text-sm">{pr.createdAt ? formatDateTime(pr.createdAt) : '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Purchase Terms</p>
              <p className="text-sm font-medium">{pr.purchaseTerms || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Delivery Terms</p>
              <p className="text-sm font-medium">{pr.deliveryTerms || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Type of Delivery</p>
              <p className="text-sm font-medium">{pr.deliveryType || '—'}</p>
            </div>
            {pr.approvedAt && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Approved At</p>
                <p className="text-sm">{formatDateTime(pr.approvedAt)}</p>
              </div>
            )}
          </div>

          {pr.description && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Purpose of Request</p>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">{pr.description}</p>
            </div>
          )}


          {pr.notes && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Notes</p>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">{pr.notes}</p>
            </div>
          )}

          {/* ─── Line Items (inside Details tab) ─────────── */}
          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Line Items</h2>
                {(() => {
                  const totalCount = pr.items?.length || 0;
                  const pluralSuffix = totalCount === 1 ? '' : 's';
                  const itemCountText = filteredItems.length === totalCount
                    ? `${totalCount} item${pluralSuffix}`
                    : `${filteredItems.length} of ${totalCount} item${pluralSuffix}`;
                  return <p className="text-xs text-muted-foreground mt-0.5">{itemCountText}</p>;
                })()}
              </div>
              <div className="flex items-center gap-2">
                {isDraft && selectedItemIds.size > 0 && (
                  <Button size="sm" variant="destructive" onClick={() => setBulkDeleteConfirmOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete {selectedItemIds.size}
                  </Button>
                )}
                {isDraft && (
                  <Button size="sm" onClick={openAddItem} className="bg-gradient-primary text-white">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Item
                  </Button>
                )}
              </div>
            </div>

            {(pr.items?.length || 0) > 0 && (() => {
              const activeItemFilterCount = [itemVendorFilter, itemTaxableFilter && itemTaxableFilter !== 'all' ? itemTaxableFilter : '', itemTaxInclFilter && itemTaxInclFilter !== 'all' ? itemTaxInclFilter : '', itemPriceMin, itemPriceMax].filter(Boolean).length;
              return (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search items..."
                    value={itemSearch}
                    onChange={(e) => { setItemSearch(e.target.value); setItemPage(1); }}
                    className="max-w-[220px] h-8 text-sm"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 relative">
                        <Filter className="h-3.5 w-3.5 mr-1.5" /> Filters
                        {activeItemFilterCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{activeItemFilterCount}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
                        <p className="text-sm font-semibold">Filters</p>
                        {activeItemFilterCount > 0 && (
                          <button onClick={() => { setItemVendorFilter(''); setItemTaxableFilter(''); setItemTaxInclFilter(''); setItemPriceMin(''); setItemPriceMax(''); setItemPage(1); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <X className="h-3 w-3" /> Clear all
                          </button>
                        )}
                      </div>
                      <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto">
                        {itemVendors.length > 0 && (
                          <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vendor</Label>
                            <SearchableSelect
                              options={[{ value: '', label: 'All Vendors' }, ...itemVendors.map(v => ({ value: v.id, label: v.name }))]}
                              value={itemVendorFilter}
                              onChange={setItemVendorFilter}
                              placeholder="All Vendors"
                            />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Taxable</Label>
                          <Select value={itemTaxableFilter || 'all'} onValueChange={(v) => setItemTaxableFilter(v === 'all' ? '' : v)}>
                            <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="yes">Taxable</SelectItem>
                              <SelectItem value="no">Not Taxable</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Tax Included</Label>
                          <Select value={itemTaxInclFilter || 'all'} onValueChange={(v) => setItemTaxInclFilter(v === 'all' ? '' : v)}>
                            <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="yes">Tax Included</SelectItem>
                              <SelectItem value="no">Tax Excluded</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Unit Price</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Input type="number" value={itemPriceMin} onChange={(e) => setItemPriceMin(e.target.value)} className="h-9 rounded-lg" placeholder="Min" />
                            <Input type="number" value={itemPriceMax} onChange={(e) => setItemPriceMax(e.target.value)} className="h-9 rounded-lg" placeholder="Max" />
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              );
            })()}

            {(() => {
              if (!pr.items || pr.items.length === 0) return (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                  <p className="text-sm text-muted-foreground mb-2">No line items yet</p>
                  {isDraft && <button onClick={openAddItem} className="text-sm text-primary font-medium hover:underline">+ Add first item</button>}
                </div>
              );
              if (filteredItems.length === 0) return (
                <div className="text-center py-8 border border-border rounded-xl">
                  <p className="text-sm text-muted-foreground">No items match your search.</p>
                </div>
              );
              return (
              <>
              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm min-w-[1510px]">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                      {isDraft && (
                        <th className="px-3 py-2.5 w-[36px]">
                          <button
                            onClick={toggleAllItems}
                            className={cn(
                              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                              headerCheckboxClass
                            )}
                          >
                            {headerAllSelected && <CheckCircle className="h-2.5 w-2.5 text-primary-foreground" />}
                            {headerSomeSelected && <div className="w-2 h-0.5 bg-primary rounded-full" />}
                          </button>
                        </th>
                      )}
                      <th className="text-left px-3 py-2.5 w-[40px]">#</th>
                      <th className="text-left px-3 py-2.5 w-[180px]">Name</th>
                      <th className="text-left px-3 py-2.5 w-[65px]">OP UOM</th>
                      <th className="text-center px-3 py-2.5 w-[60px]">OP Qty</th>
                      <th className="text-center px-3 py-2.5 w-[65px]">Pcs/Pack</th>
                      <th className="text-center px-3 py-2.5 w-[70px]">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-help">Inv Qty <Info className="h-3 w-3 text-muted-foreground" /></span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">OP Qty × Pcs/Pack</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </th>
                      <th className="text-left px-3 py-2.5 w-[130px]">Vendor</th>
                      <th className="text-right px-3 py-2.5 w-[90px]">Unit Price</th>
                      <th className="text-right px-3 py-2.5 w-[70px]">Discount</th>
                      <th className="text-center px-3 py-2.5 w-[55px]"><div className="flex items-center justify-center gap-1">Taxable <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent><p className="text-xs">Subject to tax calculation</p></TooltipContent></Tooltip></TooltipProvider></div></th>
                      <th className="text-center px-3 py-2.5 w-[55px]"><div className="flex items-center justify-center gap-1">Tax Incl <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent><p className="text-xs">Price already includes tax</p></TooltipContent></Tooltip></TooltipProvider></div></th>
                      <th className="text-right px-3 py-2.5 w-[80px]"><div className="flex items-center justify-end gap-1">Tax <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent><p className="text-xs">Default tax rate: {taxRate}%</p></TooltipContent></Tooltip></TooltipProvider></div></th>
                      <th className="text-right px-3 py-2.5 w-[90px]">Amount</th>
                      <th className="text-center px-3 py-2.5 w-[60px]">COA</th>
                      <th className="px-3 py-2.5 w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item: any) => {
                      const vp = getVendorPricing(item);
                      const pkgQty = item.quantity || vp.opQty;
                      const pcsPerPack = vp.pcsPerPack;
                      const invQty = pkgQty * pcsPerPack;
                      return (
                      <tr
                        key={item.id}
                        className={cn('border-t border-border/50 transition-colors', isDraft && 'hover:bg-accent/50 cursor-pointer')}
                        onClick={() => isDraft && openEditItem(item)}
                      >
                        {isDraft && (
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => toggleItemSelect(item.id)}
                              className={cn(
                                'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                                selectedItemIds.has(item.id) ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
                              )}
                            >
                              {selectedItemIds.has(item.id) && <CheckCircle className="h-2.5 w-2.5 text-primary-foreground" />}
                            </button>
                          </td>
                        )}
                        <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{item.itemNumber}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium">{item.product?.name || item.description || '—'}</p>
                          <p className="font-mono text-xs text-muted-foreground">{item.product?.sku || ''}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{vp.uom?.toUpperCase() || item.uom || '—'}</td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <InlineEditCell value={pkgQty} onSave={(v) => inlineSave(item.id, 'quantity', v)} align="center" disabled={!isDraft} stepper />
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{pcsPerPack || '—'}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs font-semibold">{invQty ? invQty.toLocaleString() : '—'}</td>
                        <td className="px-3 py-3">
                          {item.vendor ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center shrink-0">
                                <span className="text-white text-[8px] font-bold">{item.vendor.name.charAt(0)}</span>
                              </div>
                              <span className="text-xs">{item.vendor.name}</span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-[10px] text-muted-foreground">{currencySymbol}</span>
                            <InlineEditCell value={item.estimatedPrice || 0} onSave={(v) => inlineSave(item.id, 'estimatedPrice', v)} align="right" disabled={!isDraft} />
                          </div>
                        </td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <InlineEditCell value={item.discount || 0} onSave={(v) => inlineSave(item.id, 'discount', v)} suffix="%" align="right" disabled={!isDraft} integer toast={toast} />
                          {(item.discount || 0) > 0 && (() => {
                            const subtotal = (pkgQty * pcsPerPack) * (item.estimatedPrice || 0);
                            const discAmt = subtotal * (item.discount / 100);
                            return <p className="text-[10px] text-red-500 font-mono text-right mt-0.5">-{formatCurrency(discAmt)}</p>;
                          })()}
                        </td>
                        <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => isDraft && updateItemMutation.mutate({ itemId: item.id, data: { taxable: !item.taxable } })}
                            disabled={!isDraft}
                            className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors', isDraft && 'cursor-pointer hover:opacity-80', item.taxable ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground')}
                          >{item.taxable ? 'Yes' : 'No'}</button>
                        </td>
                        <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => isDraft && updateItemMutation.mutate({ itemId: item.id, data: { taxIncluded: !item.taxIncluded } })}
                            disabled={!isDraft}
                            className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors', isDraft && 'cursor-pointer hover:opacity-80', item.taxIncluded ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-muted text-muted-foreground')}
                          >{item.taxIncluded ? 'Yes' : 'No'}</button>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground">
                          {item.taxable ? `${taxRate}%` : '—'}
                          {item.taxable && taxRate > 0 && !item.taxIncluded && (() => {
                            const sub = (pkgQty * pcsPerPack) * (item.estimatedPrice || 0);
                            const disc = sub - (sub * (item.discount || 0) / 100);
                            return <p className="text-[10px] text-muted-foreground/70 mt-0.5">{formatCurrency(disc * taxRate / 100)}</p>;
                          })()}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium">{formatCurrency(calcLineAmount(item, taxRate))}</td>
                        <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => { setCoaItemId(item.id); setCoaFormData({ glAccountId: item.glAccountId || '', debitAmount: item.debitAmount || 0, creditAmount: item.creditAmount || 0, accountRemarks: item.accountRemarks || '' }); setCoaModalOpen(true); }}
                            className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer hover:opacity-80', item.glAccountId ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}
                          >
                            {item.glAccountId ? (glAccountOptions.find((g: any) => g.value === item.glAccountId)?.label?.split(' - ')[0] || 'Set') : 'Set'}
                          </button>
                        </td>
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            {item.notes ? (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors">
                                      <Info className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-[250px]">
                                    <p className="text-xs">{item.notes}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <div className="w-7" />
                            )}
                            {isDraft && (
                              <button onClick={() => setDeleteItemTarget(item)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
              {itemTotalPages > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {(itemPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(itemPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={itemPage <= 1} onClick={() => setItemPage(itemPage - 1)}>Prev</Button>
                    {Array.from({ length: itemTotalPages }, (_, i) => (
                      <Button key={i} variant={itemPage === i + 1 ? 'default' : 'outline'} size="sm" className="h-7 w-7 text-xs p-0" onClick={() => setItemPage(i + 1)}>{i + 1}</Button>
                    ))}
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={itemPage >= itemTotalPages} onClick={() => setItemPage(itemPage + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
            );
            })()}
          </div>


          {/* ─── Comments & Activity ─────────────────────── */}
          <Separator />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[500px]">
            <div className="flex flex-col gap-4 min-h-0">
              <h2 className="text-base font-semibold shrink-0">Comments</h2>
              <div className="flex-1 min-h-0">
                {pr.id && <CommentsPanel entityType="PURCHASE_REQUEST" entityId={pr.id} />}
              </div>
            </div>
            <div className="flex flex-col gap-4 min-h-0">
              <h2 className="text-base font-semibold shrink-0">Activity</h2>
              <div className="flex-1 min-h-0">
                {pr.id && <ActivityPanel entityType="PURCHASE_REQUEST" entityId={pr.id} />}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── Documents Tab ───────────────────────────── */}
        <TabsContent value="documents" className="mt-5">
          {pr.id && <DocumentsPanel entityType="PURCHASE_REQUEST" entityId={pr.id} />}
        </TabsContent>
      </Tabs>

      {/* ─── Add Items Modal (Multi-select) ────────────── */}
      {!editItem && (
        <Dialog open={addItemOpen} onOpenChange={(open) => !open && closeItemForm()}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
              <DialogTitle>Add Line Items</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Select products to add. Showing {addItemSearch ? 'search results' : 'recent products'}.</p>
            </DialogHeader>

            <div className="px-6 pt-4 pb-2">
              {/* Inventory type selector */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Type:</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">Product</span>
              </div>
              <Input
                value={addItemSearch}
                onChange={(e) => setAddItemSearch(e.target.value)}
                placeholder="Search by name, SKU, manufacturer..."
                className="h-9 rounded-lg"
              />
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto px-6 pb-2">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No products found.</p>
              ) : (
                <div className="space-y-1">
                  {filteredProducts.map((p: any) => {
                    const hasPricing = (p._count?.pricings || 0) > 0;
                    const isSelected = selectedProducts.has(p.id);
                    const entry = selectedProducts.get(p.id);
                    let productBtnClass = 'hover:bg-accent border border-transparent';
                    if (!hasPricing) productBtnClass = 'opacity-50 cursor-not-allowed border border-transparent';
                    else if (isSelected) productBtnClass = 'bg-primary/5 border border-primary/30';
                    let productCheckClass = 'border-border';
                    if (!hasPricing) productCheckClass = 'border-border bg-muted';
                    else if (isSelected) productCheckClass = 'bg-primary border-primary';
                    return (
                      <div key={p.id}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => hasPricing && toggleProductSelect(p)}
                            disabled={!hasPricing}
                            className={cn(
                              'flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                              productBtnClass
                            )}
                          >
                            <div className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                              productCheckClass
                            )}>
                              {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{p.name}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{p.sku}</span>
                                {!hasPricing && <span className="text-[9px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">No Pricing</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                <span>{p.manufacturer?.name || '—'}</span>
                                <span>·</span>
                                <span>{p.category?.name || '—'}</span>
                              </div>
                            </div>
                          </button>
                          {!hasPricing && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 text-xs h-7 px-2.5"
                              onClick={() => openQuickPrice(p)}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add Price
                            </Button>
                          )}
                        </div>

                        {/* Pricing selection — shown when selected */}
                        {isSelected && entry && entry.pricings.length > 0 && (
                          <div className="ml-8 mr-3 mb-2 mt-1 rounded-md border border-border/50 bg-muted/20 p-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Select vendor price</p>
                            <div className="space-y-1">
                              {entry.pricings.map((pr: any) => (
                                <button
                                  key={pr.id}
                                  type="button"
                                  onClick={() => setProductPricingVendor(p.id, pr.vendorId)}
                                  className={cn(
                                    'w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors text-left',
                                    entry.selectedPricingVendorId === pr.vendorId ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent'
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{pr.vendorName}</span>
                                    {pr.isApplied && <span className="text-[9px] font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-1 py-0.5 rounded-full">Applied</span>}
                                    <span className="text-muted-foreground capitalize">{pr.type}</span>
                                  </div>
                                  <span className="font-mono font-semibold">{pr.currency} {pr.unitCost.toFixed(2)}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {(() => {
                  if (selectedProducts.size === 0) return 'No products selected';
                  const productPlural = selectedProducts.size > 1 ? 's' : '';
                  return `${selectedProducts.size} product${productPlural} selected`;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={closeItemForm}>Cancel</Button>
                <Button onClick={handleAddSelectedItems} disabled={selectedProducts.size === 0 || addingItems} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                  {addingItems && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {(() => {
                    const countLabel = selectedProducts.size > 0 ? ` ${selectedProducts.size}` : '';
                    const itemPlural = selectedProducts.size === 1 ? '' : 's';
                    return `Add${countLabel} Item${itemPlural}`;
                  })()}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Quick Add Pricing Modal ─────────────────────── */}
      <Dialog open={quickPriceOpen} onOpenChange={(open) => { if (!open) { setQuickPriceOpen(false); setQuickPriceProduct(null); } }}>
        <DialogContent className="max-w-xl p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>Quick Add Pricing</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">{quickPriceProduct?.name}</p>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-[13px]">Vendor <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                  value={quickPriceVendorId}
                  onChange={setQuickPriceVendorId}
                  placeholder="Select vendor"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Type</Label>
                <Select value={quickPriceType} onValueChange={setQuickPriceType}>
                  <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="imported">Imported</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px]">OP Qty <span className="text-red-500">*</span></Label>
                <Input type="number" min="1" step="1" value={quickPriceOpQty} onChange={(e) => setQuickPriceOpQty(e.target.value)} placeholder="1" className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Pcs/Pack <span className="text-red-500">*</span></Label>
                <Input type="number" min="1" step="1" value={quickPricePcsPerPack} onChange={(e) => setQuickPricePcsPerPack(e.target.value)} placeholder="1" className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">UOM <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  options={[
                    'pcs', 'box', 'pack', 'set', 'kg', 'g', 'l', 'ml', 'm', 'roll', 'bag', 'bottle',
                    'can', 'pair', 'ream', 'unit', 'sheet', 'carton', 'drum', 'pallet', 'dozen', 'bundle', 'spool', 'tube',
                  ].map((c) => ({ value: c, label: c }))}
                  value={quickPriceUom}
                  onChange={setQuickPriceUom}
                  placeholder="Select UOM"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Unit Cost <span className="text-red-500">*</span></Label>
                <Input type="number" min="0" step="0.01" value={quickPriceUnitCost} onChange={(e) => setQuickPriceUnitCost(e.target.value)} placeholder="0.00" className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Selling Price</Label>
                <Input type="number" min="0" step="0.01" value={quickPriceSellingPrice} onChange={(e) => setQuickPriceSellingPrice(e.target.value)} placeholder="0.00" className="h-9 rounded-lg" />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => { setQuickPriceOpen(false); setQuickPriceProduct(null); }}>Cancel</Button>
            <Button
              onClick={handleQuickPriceSave}
              disabled={!quickPriceVendorId || !quickPriceUnitCost || quickPriceSaving}
              className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90"
            >
              {quickPriceSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Pricing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Item Modal ─────────────────────────────── */}
      {editItem && (
        <Dialog open={addItemOpen} onOpenChange={(open) => !open && closeItemForm()}>
          <DialogContent className="max-w-md p-0 gap-0">
            <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
              <DialogTitle>Edit Line Item</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{editItem?.product?.name || 'Update item details'}</p>
            </DialogHeader>
            <form id="edit-item-form" onSubmit={handleEditItemSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">OP Qty <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-0">
                    <button type="button" onClick={() => setItemQty(Math.max(1, itemQty - 1))} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-l-lg border border-r-0 border-border bg-muted hover:bg-accent transition-colors text-muted-foreground">−</button>
                    <Input type="number" min="1" value={itemQty} onChange={(e) => setItemQty(Math.max(1, Number.parseInt(e.target.value) || 1))} className="h-9 rounded-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" required />
                    <button type="button" onClick={() => setItemQty(itemQty + 1)} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-r-lg border border-l-0 border-border bg-muted hover:bg-accent transition-colors text-muted-foreground">+</button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Unit Price</Label>
                  <Input type="number" step="0.01" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="h-9 rounded-lg" />
                </div>
              </div>
              {productPricings.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Vendor Prices</p>
                  <div className="space-y-1.5">
                    {productPricings.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setItemVendorId(p.vendorId); setItemPrice(String(p.unitCost)); }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left',
                          itemVendorId === p.vendorId ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.vendorName}</span>
                          {p.isApplied && <span className="text-[9px] font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full">Applied</span>}
                        </div>
                        <span className="font-mono font-semibold">{p.currency} {p.unitCost.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Discount %</Label>
                  <Input type="number" step="1" min="0" max="100" value={itemDiscount} onChange={(e) => {
                    const val = Number.parseFloat(e.target.value) || 0;
                    if (val > 100) { toast({ title: 'Invalid discount', description: 'Discount cannot exceed 100%.', variant: 'destructive' }); setItemDiscount(100); }
                    else if (val > 0 && val < 1) { toast({ title: 'Invalid discount', description: 'Discount must be at least 1%.', variant: 'destructive' }); setItemDiscount(0); }
                    else setItemDiscount(Math.round(val));
                  }} className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] flex items-center gap-1">Taxable <span className="relative group"><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /><span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-foreground text-background text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Subject to tax calculation</span></span></Label>
                  <button type="button" onClick={() => setItemTaxable(!itemTaxable)} className={cn('h-9 w-full rounded-lg border text-xs font-medium transition-colors', itemTaxable ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400' : 'bg-background border-border text-muted-foreground hover:bg-accent')}>
                    {itemTaxable ? 'Yes' : 'No'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] flex items-center gap-1">Tax Included <span className="relative group"><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /><span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-foreground text-background text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Price already includes tax</span></span></Label>
                  <button type="button" onClick={() => setItemTaxIncluded(!itemTaxIncluded)} className={cn('h-9 w-full rounded-lg border text-xs font-medium transition-colors', itemTaxIncluded ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400' : 'bg-background border-border text-muted-foreground hover:bg-accent')}>
                    {itemTaxIncluded ? 'Yes' : 'No'}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Remarks</Label>
                <Textarea value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} className="rounded-lg" rows={2} placeholder="Optional remarks…" />
              </div>
            </form>
            <div className="px-6 py-4 border-t border-border flex justify-between">
              <Button type="button" variant="ghost" onClick={closeItemForm}>Cancel</Button>
              <Button type="submit" form="edit-item-form" disabled={isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update Item
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}


      {/* ─── Edit PR Details Modal ────────────────────── */}
      <Dialog open={editPrOpen} onOpenChange={(open) => !open && setEditPrOpen(false)}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>Edit Purchase Request</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Update the details of {pr?.requestNumber}</p>
          </DialogHeader>
          <form onSubmit={handleEditPrSubmit} className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Company <span className="text-red-500">*</span></Label>
              <SearchableSelect options={companies} value={editCompanyId} onChange={setEditCompanyId} placeholder="Select company" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Title <span className="text-red-500">*</span></Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-9 rounded-lg" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Priority</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Department</Label>
                <SearchableSelect options={departments} value={editDepartmentId} onChange={setEditDepartmentId} placeholder="Select department" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Required Date</Label>
                <DatePicker value={editRequiredDate} onChange={(d) => setEditRequiredDate(d || undefined)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Purpose of Request</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="rounded-lg" rows={2} placeholder="e.g., Quarterly restock, New project requirement..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Purchase Terms</Label>
                <SearchableSelect options={purchaseTermOptions} value={editPurchaseTerms} onChange={setEditPurchaseTerms} placeholder="Select terms" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Delivery Terms</Label>
                <SearchableSelect options={deliveryTermOptions} value={editDeliveryTerms} onChange={setEditDeliveryTerms} placeholder="Select delivery terms" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Type of Delivery</Label>
              <SearchableSelect options={deliveryTypeOptions} value={editDeliveryType} onChange={setEditDeliveryType} placeholder="Select type of delivery" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Internal Notes</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="rounded-lg" rows={2} />
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setEditPrOpen(false)}>Cancel</Button>
            <Button onClick={handleEditPrSubmit} disabled={!editTitle || updatePrMutation.isPending} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
              {updatePrMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Submit for Approval Confirm ────────────────── */}
      <ConfirmDialog
        open={submitConfirmOpen}
        onOpenChange={(open) => !open && setSubmitConfirmOpen(false)}
        title="Submit for Approval"
        description={`Submit "${pr?.requestNumber}" with ${pr?.items?.length || 0} item(s) for approval? This cannot be undone.`}
        confirmLabel="Submit"
        onConfirm={() => { submitMutation.mutate(undefined, { onSuccess: () => setSubmitConfirmOpen(false) }); }}
        isLoading={submitMutation.isPending}
      />

      {/* ─── Create RFQ Confirm ──────────────────────────── */}
      <ConfirmDialog
        open={createRfqConfirmOpen}
        onOpenChange={(open) => !open && setCreateRfqConfirmOpen(false)}
        title="Create RFQ"
        description={`Create Request for Quotation from "${pr?.requestNumber}"? One RFQ will be created per vendor.`}
        confirmLabel="Create RFQ"
        onConfirm={() => { createRfqMutation.mutate(undefined, { onSuccess: () => setCreateRfqConfirmOpen(false) }); }}
        isLoading={createRfqMutation.isPending}
      />

      {/* ─── Create PO Confirm ───────────────────────────── */}
      <ConfirmDialog
        open={createPoConfirmOpen}
        onOpenChange={(open) => !open && setCreatePoConfirmOpen(false)}
        title="Create Purchase Order"
        description={`Create purchase order(s) from "${pr?.requestNumber}"? One PO will be created per vendor. Items must have a vendor assigned.`}
        confirmLabel="Create PO"
        onConfirm={() => createPoMutation.mutate()}
        isLoading={createPoMutation.isPending}
      />

      {/* ─── Approve Confirm ─────────────────────────────── */}
      <ConfirmDialog
        open={approveConfirmOpen}
        onOpenChange={(open) => !open && setApproveConfirmOpen(false)}
        title="Approve Request"
        description={`Approve purchase request "${pr?.requestNumber}"?`}
        confirmLabel="Approve"
        onConfirm={() => { approveMutation.mutate(undefined, { onSuccess: () => setApproveConfirmOpen(false) }); }}
        isLoading={approveMutation.isPending}
      />

      {/* ─── Reject Confirm ─────────────────────────────── */}
      <Dialog open={rejectConfirmOpen} onOpenChange={(open) => { if (!open) { setRejectConfirmOpen(false); setRejectionNote(''); } }}>
        <DialogContent className="max-w-xs p-5">
          <DialogTitle className="text-sm font-semibold">Reject Request</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1.5">Reject purchase request &quot;{pr?.requestNumber}&quot;? This action cannot be undone.</p>
          <div className="mt-3 space-y-1.5">
            <Label className="text-sm">Reason <span className="text-red-500">*</span></Label>
            <Textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setRejectConfirmOpen(false); setRejectionNote(''); }} disabled={rejectMutation.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectionNote)}
              disabled={!rejectionNote.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Line Item Confirm ─────────────────── */}
      <ConfirmDialog
        open={!!deleteItemTarget}
        onOpenChange={(open) => !open && setDeleteItemTarget(null)}
        title="Remove Line Item"
        description={`Remove "${deleteItemTarget?.product?.name || deleteItemTarget?.description || 'this item'}" from the request?`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => { if (deleteItemTarget) deleteItemMutation.mutate(deleteItemTarget.id, { onSuccess: () => setDeleteItemTarget(null) }); }}
        isLoading={deleteItemMutation.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={(open) => !open && setBulkDeleteConfirmOpen(false)}
        title="Remove Selected Items"
        description={`Remove ${selectedItemIds.size} selected item${selectedItemIds.size > 1 ? 's' : ''} from the request?`}
        confirmLabel="Remove All"
        variant="destructive"
        onConfirm={handleBulkDelete}
        isLoading={bulkDeleting}
      />

      {/* ─── COA Assignment Modal ─────────────────────── */}
      <Dialog open={coaModalOpen} onOpenChange={(o) => { if (!o) setCoaModalOpen(false); }}>
        <DialogContent className="max-w-sm p-0 gap-0">
          <div className="px-5 pt-5 pb-3">
            <DialogTitle className="text-sm font-semibold">Assign Chart of Account</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Select an account and enter debit/credit amounts.</p>
          </div>
          <div className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Account</Label>
              <SearchableSelect
                options={[{ value: '', label: '— None —' }, ...glAccountOptions]}
                value={coaFormData.glAccountId}
                onChange={(v) => setCoaFormData({ ...coaFormData, glAccountId: v })}
                placeholder="Select account..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Debit Amount</Label>
                <Input type="number" min="0" step="0.01" value={coaFormData.debitAmount || ''} onChange={(e) => setCoaFormData({ ...coaFormData, debitAmount: Number.parseFloat(e.target.value) || 0 })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Credit Amount</Label>
                <Input type="number" min="0" step="0.01" value={coaFormData.creditAmount || ''} onChange={(e) => setCoaFormData({ ...coaFormData, creditAmount: Number.parseFloat(e.target.value) || 0 })} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Remarks</Label>
              <Input value={coaFormData.accountRemarks} onChange={(e) => setCoaFormData({ ...coaFormData, accountRemarks: e.target.value })} placeholder="Optional remarks..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setCoaModalOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90" onClick={() => {
                updateItemMutation.mutate({ itemId: coaItemId, data: { glAccountId: coaFormData.glAccountId || null, debitAmount: coaFormData.debitAmount, creditAmount: coaFormData.creditAmount, accountRemarks: coaFormData.accountRemarks || null } }, { onSuccess: () => setCoaModalOpen(false) });
              }} disabled={updateItemMutation.isPending}>
                {updateItemMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── RFQ Summary Modal ─────────────────────────── */}
      <RfqSummaryModal rfqId={rfqSummaryId} prNumber={pr?.requestNumber} onClose={() => setRfqSummaryId(null)} />
    </div>
  );
}
