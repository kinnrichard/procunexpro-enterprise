'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, formatDateTime, getInitials } from '@/lib/utils';
import { useCurrencyStore } from '@/lib/currency';
import { useTaxStore } from '@/lib/tax';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { DocumentsPanel } from '@/components/documents-panel';
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
import {
  ArrowLeft, Plus, Trash2, Loader2, Send, CheckCircle, XCircle, Users,
  Clock, FileText, Link2, Ban, ChevronRight, Building2, Calendar, Pencil, Info,
} from 'lucide-react';

type Vendor = { id: string; name: string };

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// ─── Status Timeline ──────────────────────────────────────
const statusOrder = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CONVERTED'];
const statusSteps = [
  { key: 'DRAFT', label: 'Draft', icon: FileText },
  { key: 'PENDING_APPROVAL', label: 'Pending', icon: Clock },
  { key: 'APPROVED', label: 'Approved', icon: CheckCircle },
  { key: 'CONVERTED', label: 'Converted to PO', icon: Link2 },
];

function StatusTimeline({ status, rejectionNote }: { status: string; rejectionNote?: string }) {
  const isRejected = status === 'REJECTED';
  const isCancelled = status === 'CANCELLED';
  const currentIndex = statusOrder.indexOf(status);

  if (isRejected || isCancelled) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
        <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
          {isRejected ? <XCircle className="h-5 w-5 text-red-600" /> : <Ban className="h-5 w-5 text-red-600" />}
        </div>
        <div>
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{isRejected ? 'Rejected' : 'Cancelled'}</p>
          {rejectionNote && <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">{rejectionNote}</p>}
        </div>
      </div>
    );
  }

  const stepColors: Record<string, { completed: string; arrow: string }> = {
    DRAFT: { completed: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300', arrow: 'text-gray-400' },
    PENDING_APPROVAL: { completed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', arrow: 'text-amber-400' },
    APPROVED: { completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', arrow: 'text-emerald-400' },
    CONVERTED: { completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', arrow: 'text-blue-400' },
  };

  return (
    <div className="flex items-center gap-1">
      {statusSteps.map((step, i) => {
        const isCompleted = currentIndex >= i;
        const Icon = step.icon;
        const colors = stepColors[step.key];
        return (
          <div key={step.key} className="flex items-center">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors',
              isCompleted ? colors.completed : 'bg-muted text-muted-foreground'
            )}>
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < statusSteps.length - 1 && (
              <ChevronRight className={cn('h-4 w-4 mx-0.5 shrink-0', isCompleted ? colors.arrow : 'text-muted-foreground/30')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Inline Edit Cell ─────────────────────────────────────
function InlineEditCell({ value, onSave, type = 'number', prefix, suffix, align = 'right', disabled }: {
  value: number; onSave: (val: number) => void; type?: string; prefix?: string; suffix?: string; align?: 'left' | 'right' | 'center'; disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(String(value));

  if (disabled || !editing) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!disabled) { setLocalVal(String(value)); setEditing(true); } }}
        className={cn(
          'w-full font-mono text-xs px-2 py-1.5 rounded-md transition-colors',
          disabled ? '' : 'border border-border/60 bg-background hover:border-primary/40 cursor-text',
          align === 'right' && 'text-right',
          align === 'center' && 'text-center',
        )}
      >
        {prefix}{value}{suffix}
      </button>
    );
  }

  return (
    <input
      type={type}
      step="0.01"
      autoFocus
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => {
        const num = parseFloat(localVal) || 0;
        if (num !== value) onSave(num);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.currentTarget.blur(); }
        if (e.key === 'Escape') { setLocalVal(String(value)); setEditing(false); }
      }}
      className={cn(
        'w-full font-mono text-xs px-1 py-0.5 rounded border border-primary/50 bg-background outline-none focus:ring-1 focus:ring-primary/30',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
      )}
    />
  );
}

// ─── Main Component ───────────────────────────────────────
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
  const [editPrOpen, setEditPrOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editRequiredDate, setEditRequiredDate] = useState<Date | undefined>();
  const [editNotes, setEditNotes] = useState('');
  const [quickPriceOpen, setQuickPriceOpen] = useState(false);
  const [quickPriceVendorId, setQuickPriceVendorId] = useState('');
  const [quickPriceType, setQuickPriceType] = useState('local');
  const [quickPriceUnitCost, setQuickPriceUnitCost] = useState('');
  const [quickPriceSellingPrice, setQuickPriceSellingPrice] = useState('');
  const [quickPriceSaving, setQuickPriceSaving] = useState(false);

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
  const [pricingsLoading, setPricingsLoading] = useState(false);

  // Multi-select add items
  const [addItemSearch, setAddItemSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Map<string, { product: any; pricings: any[]; selectedPricingVendorId: string }>>(new Map());
  const [addingItems, setAddingItems] = useState(false);

  const { data: prData, isLoading } = useQuery({
    queryKey: ['pr-detail', prId],
    queryFn: () => api.get(`/purchase-requests/${prId}`),
  });
  const pr = prData?.data;

  const taxRate = useTaxStore((s) => s.getDefaultRate)();

  const { data: vendorsRes } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: () => api.get('/vendors', { params: { limit: 1000 } }),
  });
  const vendors: Vendor[] = vendorsRes?.data?.data || [];

  const { data: deptData } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/departments', { params: { limit: 1000 } }),
  });
  const departments = (deptData?.data?.data || []).map((d: any) => ({ value: d.id, label: d.name }));

  const { data: currenciesRes } = useQuery({
    queryKey: ['currencies-active'],
    queryFn: () => api.get('/currencies/active'),
  });
  const defaultCurrency = (currenciesRes?.data?.data || []).find((c: any) => c.isDefault)?.code || 'USD';

  const { data: productsRes } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => api.get('/products', { params: { limit: 1000 } }),
  });
  const products: any[] = productsRes?.data?.data || [];

  const isDraft = pr?.status === 'DRAFT';

  function calcLineAmount(item: any) {
    const pkgQty = item.quantity || item.product?.originalPackagingQty || 0;
    const pcsPerPack = item.product?.pcsPerPack || 0;
    const invQty = pkgQty * pcsPerPack;
    const subtotal = invQty * (item.estimatedPrice || 0);
    const discounted = subtotal - (subtotal * (item.discount || 0) / 100);
    if (item.taxable && taxRate > 0) {
      if (item.taxIncluded) {
        return discounted; // tax already in price
      }
      return discounted + (discounted * taxRate / 100);
    }
    return discounted;
  }

  function inlineSave(itemId: string, field: string, value: number) {
    updateItemMutation.mutate({ itemId, data: { [field]: value } });
  }

  async function handleProductSelect(productId: string) {
    setItemProductId(productId);
    setItemPrice('');
    setItemVendorId('');
    setProductPricings([]);

    if (!productId) return;

    // Fetch pricings for selected product
    setPricingsLoading(true);
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
    } finally {
      setPricingsLoading(false);
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
  };

  // ─── Item Mutations ─────────────────────────────────────
  const addItemMutation = useMutation({
    mutationFn: (data: any) => api.post(`/purchase-requests/${prId}/items`, data),
    onSuccess: () => { invalidate(); closeItemForm(); toast({ title: 'Item added' }); },
    onError: () => toast({ title: 'Failed to add item', variant: 'destructive' }),
  });

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

  const applyVendorMutation = useMutation({
    mutationFn: (vendorId: string) => api.post(`/purchase-requests/${prId}/items/apply-vendor`, { vendorId }),
    onSuccess: () => { invalidate(); setApplyVendorOpen(false); setApplyVendorId(''); toast({ title: 'Vendor applied to all items' }); },
    onError: () => toast({ title: 'Failed to apply vendor', variant: 'destructive' }),
  });

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

  const rejectMutation = useMutation({
    mutationFn: (note: string) => api.put(`/purchase-requests/${prId}/reject`, { rejectionNote: note }),
    onSuccess: () => { invalidate(); setRejectOpen(false); setRejectionNote(''); toast({ title: 'Purchase request rejected' }); },
    onError: () => toast({ title: 'Failed to reject', variant: 'destructive' }),
  });

  // ─── Edit PR Details ──────────────────────────────────
  const updatePrMutation = useMutation({
    mutationFn: (data: any) => api.put(`/purchase-requests/${prId}`, data),
    onSuccess: () => { invalidate(); setEditPrOpen(false); toast({ title: 'Purchase request updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants-all'],
    queryFn: () => api.get('/tenants', { params: { limit: 1000 } }),
  });
  const companies = (tenantsData?.data?.data || []).map((t: any) => ({ value: t.id, label: t.companyName }));

  const [editCompanyId, setEditCompanyId] = useState('');

  function openEditPr() {
    if (!pr) return;
    setEditCompanyId(pr.tenantId || '');
    setEditTitle(pr.title);
    setEditDescription(pr.description || '');
    setEditDepartmentId(pr.departmentId || '');
    setEditPriority(pr.priority);
    setEditRequiredDate(pr.requiredDate ? new Date(pr.requiredDate) : undefined);
    setEditNotes(pr.notes || '');
    setEditPrOpen(true);
  }

  function handleEditPrSubmit(e: React.FormEvent) {
    e.preventDefault();
    updatePrMutation.mutate({
      tenantId: editCompanyId || undefined,
      title: editTitle,
      description: editDescription || null,
      departmentId: editDepartmentId || null,
      priority: editPriority,
      requiredDate: editRequiredDate?.toISOString() || null,
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
    setItemPrice(item.estimatedPrice != null ? String(item.estimatedPrice) : '');
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
      estimatedPrice: itemPrice ? parseFloat(itemPrice) : undefined,
      vendorId: itemVendorId || null,
      notes: itemNotes || undefined,
      discount: itemDiscount,
      taxable: itemTaxable,
      taxIncluded: itemTaxIncluded,
    };
    updateItemMutation.mutate({ itemId: editItem.id, data }, { onSettled: () => setIsSubmitting(false) });
  }

  // Filtered products for the picker
  const existingProductIds = new Set((pr?.items || []).map((i: any) => i.productId).filter(Boolean));
  const filteredProducts = products
    .filter((p: any) => !existingProductIds.has(p.id))
    .filter((p: any) => {
      if (!addItemSearch) return true;
      const q = addItemSearch.toLowerCase();
      return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.manufacturer?.name?.toLowerCase().includes(q);
    })
    .slice(0, addItemSearch ? 50 : 10);

  const totalAmount = pr?.items?.reduce((sum: number, item: any) => sum + calcLineAmount(item), 0) || 0;

  if (isLoading) return <div className="flex items-center justify-center h-full py-20 text-muted-foreground">Loading…</div>;
  if (!pr) return <div className="flex items-center justify-center h-full py-20 text-muted-foreground">Purchase request not found</div>;

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
        <div className="flex items-center gap-2">
          {(isDraft || pr.status === 'PENDING_APPROVAL') && (
            <Button variant="outline" size="sm" onClick={openEditPr}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
          {isDraft && (
            <Button onClick={() => setSubmitConfirmOpen(true)} disabled={submitMutation.isPending || (pr.items?.length || 0) === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit for Approval
            </Button>
          )}
          {pr.status === 'PENDING_APPROVAL' && (
            <>
              <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="h-4 w-4 mr-2" /> Approve
              </Button>
              <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
            </>
          )}
        </div>
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
          <StatusTimeline status={pr.status} rejectionNote={pr.rejectionNote} />

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
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Department</p>
              <p className="text-sm font-medium flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{pr.department?.name || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Priority</p>
              <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', priorityColors[pr.priority])}>{pr.priority}</span>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Amount</p>
              <p className="text-sm font-bold text-primary">{formatCurrency(pr.totalAmount || 0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Required Date</p>
              <p className="text-sm flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{pr.requiredDate ? formatDate(pr.requiredDate) : 'Not specified'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Created</p>
              <p className="text-sm">{pr.createdAt ? formatDateTime(pr.createdAt) : '—'}</p>
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
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Description</p>
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
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pr.items?.length || 0} item{(pr.items?.length || 0) !== 1 && 's'}
                  {totalAmount > 0 && <> · Est. total: <span className="font-mono font-semibold">{formatCurrency(totalAmount)}</span></>}
                </p>
              </div>
              {isDraft && (
                <Button size="sm" onClick={openAddItem} className="bg-gradient-primary text-white">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Item
                </Button>
              )}
            </div>

            {(!pr.items || pr.items.length === 0) ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                <p className="text-sm text-muted-foreground mb-2">No line items yet</p>
                {isDraft && <button onClick={openAddItem} className="text-sm text-primary font-medium hover:underline">+ Add first item</button>}
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm min-w-[1250px]">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                      <th className="text-left px-3 py-2.5 w-[40px]">#</th>
                      <th className="text-left px-3 py-2.5 w-[180px]">Name</th>
                      <th className="text-left px-3 py-2.5 w-[65px]">OP UOM</th>
                      <th className="text-center px-3 py-2.5 w-[60px]">OP Qty</th>
                      <th className="text-center px-3 py-2.5 w-[65px]">Pcs/Pack</th>
                      <th className="text-center px-3 py-2.5 w-[70px]">Inv Qty</th>
                      <th className="text-left px-3 py-2.5 w-[130px]">Vendor</th>
                      <th className="text-right px-3 py-2.5 w-[90px]">Unit Price</th>
                      <th className="text-right px-3 py-2.5 w-[70px]">Discount</th>
                      <th className="text-center px-3 py-2.5 w-[55px]"><div className="flex items-center justify-center gap-1">Taxable <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent><p className="text-xs">Subject to tax calculation</p></TooltipContent></Tooltip></TooltipProvider></div></th>
                      <th className="text-center px-3 py-2.5 w-[55px]"><div className="flex items-center justify-center gap-1">Tax Incl <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent><p className="text-xs">Price already includes tax</p></TooltipContent></Tooltip></TooltipProvider></div></th>
                      <th className="text-right px-3 py-2.5 w-[65px]"><div className="flex items-center justify-end gap-1">Tax % <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent><p className="text-xs">Default tax rate: {taxRate}%</p></TooltipContent></Tooltip></TooltipProvider></div></th>
                      <th className="text-right px-3 py-2.5 w-[90px]">Amount</th>
                      {isDraft && <th className="px-3 py-2.5 w-[40px]"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pr.items.map((item: any) => {
                      const pkgQty = item.quantity || item.product?.originalPackagingQty || 0;
                      const pcsPerPack = item.product?.pcsPerPack || 0;
                      const invQty = pkgQty * pcsPerPack;
                      return (
                      <tr
                        key={item.id}
                        className={cn('border-t border-border/50 transition-colors', isDraft && 'hover:bg-accent/50 cursor-pointer')}
                        onClick={() => isDraft && openEditItem(item)}
                      >
                        <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{item.itemNumber}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium">{item.product?.name || item.description || '—'}</p>
                          <p className="font-mono text-xs text-muted-foreground">{item.product?.sku || ''}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{item.product?.originalPackagingUom || item.uom || '—'}</td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <InlineEditCell value={pkgQty} onSave={(v) => inlineSave(item.id, 'quantity', v)} align="center" disabled={!isDraft} />
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{pcsPerPack || '—'}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs font-semibold">{invQty || '—'}</td>
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
                          <InlineEditCell value={item.discount || 0} onSave={(v) => inlineSave(item.id, 'discount', v)} suffix="%" align="right" disabled={!isDraft} />
                        </td>
                        <td className="px-3 py-3 text-center">{item.taxable ? <span className="text-green-600 text-xs font-semibold">Yes</span> : <span className="text-muted-foreground text-xs">No</span>}</td>
                        <td className="px-3 py-3 text-center">{item.taxIncluded ? <span className="text-blue-600 text-xs font-semibold">Yes</span> : <span className="text-muted-foreground text-xs">No</span>}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground">{item.taxable ? `${taxRate}%` : '—'}</td>
                        <td className="px-3 py-3 text-right font-mono font-medium">{formatCurrency(calcLineAmount(item))}</td>
                        {isDraft && (
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setDeleteItemTarget(item)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                    })}
                  </tbody>
                  {totalAmount > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td colSpan={12} className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Total</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-primary">{formatCurrency(totalAmount)}</td>
                        {isDraft && <td></td>}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
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
                    const isSelected = selectedProducts.has(p.id);
                    const entry = selectedProducts.get(p.id);
                    return (
                      <div key={p.id}>
                        <button
                          type="button"
                          onClick={() => toggleProductSelect(p)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                            isSelected ? 'bg-primary/5 border border-primary/30' : 'hover:bg-accent border border-transparent'
                          )}
                        >
                          <div className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                            isSelected ? 'bg-primary border-primary' : 'border-border'
                          )}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{p.name}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{p.sku}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <span>{p.manufacturer?.name || '—'}</span>
                              <span>·</span>
                              <span>{p.category?.name || '—'}</span>
                            </div>
                          </div>
                        </button>

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
                        {isSelected && entry && entry.pricings.length === 0 && (
                          <p className="ml-8 mr-3 mb-2 mt-1 text-[11px] text-muted-foreground">No pricing configured.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedProducts.size > 0 ? `${selectedProducts.size} product${selectedProducts.size > 1 ? 's' : ''} selected` : 'No products selected'}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={closeItemForm}>Cancel</Button>
                <Button onClick={handleAddSelectedItems} disabled={selectedProducts.size === 0 || addingItems} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                  {addingItems && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add {selectedProducts.size > 0 ? selectedProducts.size : ''} Item{selectedProducts.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
                  <Label className="text-[13px]">Quantity <span className="text-red-500">*</span></Label>
                  <Input type="number" min="1" value={itemQty} onChange={(e) => setItemQty(parseInt(e.target.value) || 1)} className="h-9 rounded-lg" required />
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
                  <Input type="number" step="0.01" min="0" max="100" value={itemDiscount} onChange={(e) => setItemDiscount(parseFloat(e.target.value) || 0)} className="h-9 rounded-lg" />
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
                <Input value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} className="h-9 rounded-lg" placeholder="Optional remarks…" />
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


      {/* ─── Reject Modal ──────────────────────────────── */}
      <Dialog open={rejectOpen} onOpenChange={(open) => !open && setRejectOpen(false)}>
        <DialogContent className="max-w-md p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-red-50 dark:bg-red-900/10 border-b rounded-t-2xl">
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5" /> Reject Purchase Request
            </DialogTitle>
            <p className="text-sm text-red-600/70 dark:text-red-400/70 mt-1">{pr.requestNumber} — {pr.title}</p>
          </DialogHeader>
          <div className="px-6 py-5 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Reason for rejection</Label>
              <Textarea value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} placeholder="Explain why this request is being rejected..." rows={3} className="rounded-lg" />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate(rejectionNote)} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Label className="text-[13px]">Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="rounded-lg" rows={2} />
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
    </div>
  );
}
