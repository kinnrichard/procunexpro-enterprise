'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { downloadCsv } from '@/lib/export';
import { formatCurrency, formatDate, getInitials, cn } from '@/lib/utils';
import { useCurrencyStore } from '@/lib/currency';
import { useTaxStore } from '@/lib/tax';
import { usePermissions } from '@/lib/permissions';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/components/ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Plus, Send, XCircle, Package,
  Clock, CheckCheck, FileX, Download, Filter, X,
} from 'lucide-react';

// ─── Schema (details only, no items) ─────────────────────────
const prSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().min(1, 'Purpose of request is required'),
  companyId: z.string().min(1, 'Company is required'),
  departmentId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  requiredDate: z.date({ required_error: 'Required date is required' }),
  purchaseTerms: z.string().min(1, 'Purchase terms is required'),
  deliveryTerms: z.string().min(1, 'Delivery terms is required'),
  deliveryType: z.string().min(1, 'Type of delivery is required'),
  notes: z.string().optional(),
});

type PRFormData = z.infer<typeof prSchema>;

// ─── Helpers ───────────────────────────────────────────────
function getVendorPricing(item: any) {
  if (item.vendor?.id && item.product?.pricings) {
    const pricing = item.product.pricings.find((p: any) => p.vendorId === item.vendor.id);
    if (pricing) return { opQty: pricing.originalPackagingQty || 1, pcsPerPack: pricing.pcsPerPack || 1 };
  }
  return { opQty: 1, pcsPerPack: 1 };
}

// ─── All Line Items Tab ─────────────────────────────────────
function AllLineItems() {
  const router = useRouter();
  const formatCurrency = useCurrencyStore((s) => s.format);
  const [liPage, setLiPage] = useState(1);
  const [liSearch, setLiSearch] = useState('');

  const { data: liResponse, isLoading: liLoading } = useQuery({
    queryKey: ['pr-all-items', liPage, liSearch],
    queryFn: () => api.get('/purchase-requests/items/all', { params: { page: liPage, limit: 20, search: liSearch || undefined } }),
  });

  const liItems = liResponse?.data?.data || [];
  const liTotal = liResponse?.data?.total || 0;

  const liColumns = [
    {
      key: 'requestNumber', label: 'Request #', sortable: true,
      render: (_: any, row: any) => (
        <button className="font-medium text-primary hover:underline" onClick={(e) => { e.stopPropagation(); router.push(`/purchase-requests/${row.purchaseRequest?.id}`); }}>
          {row.purchaseRequest?.requestNumber || '—'}
        </button>
      ),
    },
    {
      key: 'prTitle', label: 'PR Title', sortable: true,
      render: (_: any, row: any) => <span className="text-sm truncate max-w-[150px] block">{row.purchaseRequest?.title || '—'}</span>,
    },
    {
      key: 'company', label: 'Company',
      render: (_: any, row: any) => row.purchaseRequest?.company?.name || <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'product', label: 'Product', sortable: true,
      render: (_: any, row: any) => (
        <div>
          <p className="font-medium text-sm">{row.product?.name || row.description || '—'}</p>
          {row.product?.sku && <p className="font-mono text-xs text-muted-foreground">{row.product.sku}</p>}
        </div>
      ),
    },
    {
      key: 'vendor', label: 'Vendor',
      render: (_: any, row: any) => row.vendor?.name || <span className="text-muted-foreground text-xs">—</span>,
    },
    { key: 'quantity', label: 'OP Qty', sortable: true, className: 'text-center',
      render: (v: number) => <span className="font-mono text-sm">{v}</span>,
    },
    {
      key: 'invQty', label: 'Inv Qty', className: 'text-center',
      render: (_: any, row: any) => {
        const vp = getVendorPricing(row);
        const invQty = (row.quantity || vp.opQty) * vp.pcsPerPack;
        return <span className="font-mono text-sm font-semibold">{invQty.toLocaleString()}</span>;
      },
    },
    { key: 'estimatedPrice', label: 'Unit Price', sortable: true, className: 'text-right',
      render: (v: number) => <span className="font-mono text-sm">{formatCurrency(v || 0)}</span>,
    },
    { key: 'discount', label: 'Discount', className: 'text-right',
      render: (v: number) => v ? <span className="font-mono text-sm">{v}%</span> : <span className="text-muted-foreground text-xs">—</span>,
    },
    { key: 'totalPrice', label: 'Amount', sortable: true, className: 'text-right',
      render: (v: number) => <span className="font-mono font-medium">{formatCurrency(v || 0)}</span>,
    },
    {
      key: 'status', label: 'PR Status',
      render: (_: any, row: any) => <StatusBadge status={row.purchaseRequest?.status || ''} />,
    },
  ];

  return (
    <DataTable
      columns={liColumns}
      data={liItems}
      total={liTotal}
      page={liPage}
      limit={20}
      onPageChange={setLiPage}
      onSearch={setLiSearch}
      searchPlaceholder="Search by product, SKU, or request #..."
      isLoading={liLoading}
      emptyMessage="No line items found"
      onRowClick={(row: any) => router.push(`/purchase-requests/${row.purchaseRequest?.id}`)}
    />
  );
}

// ─── Constants ─────────────────────────────────────────────
const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// ─── Main Component ────────────────────────────────────────
export default function PurchaseRequestsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectionNote, setRejectionNote] = useState('');

  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterRequiredFrom, setFilterRequiredFrom] = useState<Date | undefined>();
  const [filterRequiredTo, setFilterRequiredTo] = useState<Date | undefined>();
  const [filterCreatedFrom, setFilterCreatedFrom] = useState<Date | undefined>();
  const [filterCreatedTo, setFilterCreatedTo] = useState<Date | undefined>();
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');

  const activeFilterCount = [filterCompanyId, filterDepartmentId, filterPriority, filterRequiredFrom, filterRequiredTo, filterCreatedFrom, filterCreatedTo, filterAmountMin, filterAmountMax].filter(Boolean).length;

  const toDateStr = (d?: Date) => d ? d.toISOString().split('T')[0] : '';

  function clearFilters() {
    setFilterCompanyId(''); setFilterDepartmentId(''); setFilterPriority('');
    setFilterRequiredFrom(undefined); setFilterRequiredTo(undefined);
    setFilterCreatedFrom(undefined); setFilterCreatedTo(undefined);
    setFilterAmountMin(''); setFilterAmountMax('');
    setPage(1);
  }

  // ─── Queries ────────────────────────────────────────────
  const { data: response, isLoading } = useQuery({
    queryKey: ['purchase-requests', page, search, statusFilter, filterCompanyId, filterDepartmentId, filterPriority, filterRequiredFrom, filterRequiredTo, filterCreatedFrom, filterCreatedTo, filterAmountMin, filterAmountMax],
    queryFn: () => api.get('/purchase-requests', { params: {
      page, limit: 10, search,
      ...(statusFilter && { status: statusFilter }),
      ...(filterCompanyId && { companyId: filterCompanyId }),
      ...(filterDepartmentId && { departmentId: filterDepartmentId }),
      ...(filterPriority && { priority: filterPriority }),
      ...(filterRequiredFrom && { requiredDateFrom: toDateStr(filterRequiredFrom) }),
      ...(filterRequiredTo && { requiredDateTo: toDateStr(filterRequiredTo) }),
      ...(filterCreatedFrom && { createdDateFrom: toDateStr(filterCreatedFrom) }),
      ...(filterCreatedTo && { createdDateTo: toDateStr(filterCreatedTo) }),
      ...(filterAmountMin && { amountMin: filterAmountMin }),
      ...(filterAmountMax && { amountMax: filterAmountMax }),
    } }),
  });

  const { data: deptData } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/departments', { params: { limit: 1000 } }),
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-active'],
    queryFn: () => api.get('/companies/active'),
  });
  const companies = (companiesData?.data?.data || []).map((c: any) => ({ value: c.id, label: c.name }));

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;

  const stats = useMemo(() => ({
    total,
    pending: items.filter((i: any) => i.status === 'PENDING_APPROVAL').length,
    procurement: items.filter((i: any) => i.status === 'PROCUREMENT').length,
    completed: items.filter((i: any) => i.status === 'COMPLETED').length,
  }), [items, total]);

  const departments = (deptData?.data?.data || []).map((d: any) => ({ value: d.id, label: d.name }));

  const { data: purchaseTermsData } = useQuery({
    queryKey: ['purchase-terms-active'],
    queryFn: () => api.get('/purchase-terms/active'),
  });
  const purchaseTermOptions = (purchaseTermsData?.data?.data || []).map((t: any) => ({ value: t.name, label: t.name }));

  const { data: deliveryTermsData } = useQuery({
    queryKey: ['delivery-terms-active'],
    queryFn: () => api.get('/delivery-terms/active'),
  });
  const deliveryTermOptions = (deliveryTermsData?.data?.data || []).map((d: any) => ({ value: d.name, label: d.name }));

  const { data: deliveryTypesData } = useQuery({
    queryKey: ['delivery-types-active'],
    queryFn: () => api.get('/delivery-types/active'),
  });
  const deliveryTypeOptions = (deliveryTypesData?.data?.data || []).map((d: any) => ({ value: d.name, label: d.name }));

  // ─── Form ───────────────────────────────────────────────
  const form = useForm<PRFormData>({
    resolver: zodResolver(prSchema),
    mode: 'onChange',
    defaultValues: { title: '', description: '', companyId: '', departmentId: '', priority: 'MEDIUM', requiredDate: undefined, purchaseTerms: '', deliveryTerms: '', deliveryType: '', notes: '' },
  });

  // ─── Mutations ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/purchase-requests', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      setModalOpen(false);
      toast({ title: 'Purchase request created', description: 'Add line items now.' });
      router.push(`/purchase-requests/${res.data.id}`);
    },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to create', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/purchase-requests/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }); setModalOpen(false); toast({ title: 'Purchase request updated' }); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to update', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchase-requests/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }); setDeleteTarget(null); toast({ title: 'Purchase request deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.put(`/purchase-requests/${id}/submit`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }); toast({ title: 'Submitted for approval' }); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to submit', variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, rejectionNote }: { id: string; rejectionNote: string }) => api.put(`/purchase-requests/${id}/reject`, { rejectionNote }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }); setRejectTarget(null); setRejectionNote(''); toast({ title: 'Purchase request rejected' }); },
    onError: () => toast({ title: 'Failed to reject', variant: 'destructive' }),
  });

  // ─── Handlers ───────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    form.reset({ title: '', description: '', companyId: '', departmentId: '', priority: 'MEDIUM', requiredDate: undefined as any, purchaseTerms: '', deliveryTerms: '', deliveryType: '', notes: '' });
    setModalOpen(true);
  };


  const onSubmit = (data: PRFormData) => {
    const payload = {
      ...data,
      requiredDate: data.requiredDate?.toISOString(),
    };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const handleExport = async () => {
    try {
      await downloadCsv('/purchase-requests', `purchase-requests-${new Date().toISOString().split('T')[0]}.csv`);
      toast({ title: 'Exported' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const taxRate = useTaxStore((s) => s.getDefaultRate)();

  function calcPrTotal(row: any) {
    if (!row.items?.length) return 0;
    return row.items.reduce((sum: number, item: any) => {
      const vp = getVendorPricing(item);
      const pkgQty = item.quantity || vp.opQty;
      const invQty = pkgQty * vp.pcsPerPack;
      const subtotal = invQty * (item.estimatedPrice || 0);
      const discounted = subtotal - (subtotal * (item.discount || 0) / 100);
      if (item.taxable && taxRate > 0 && !item.taxIncluded) {
        return sum + discounted + (discounted * taxRate / 100);
      }
      return sum + discounted;
    }, 0);
  }

  // ─── Table Columns ──────────────────────────────────────
  const columns = [
    {
      key: 'requestNumber', label: 'Request #', sortable: true,
      render: (v: string) => <span className="font-medium text-primary">{v}</span>,
    },
    { key: 'title', label: 'Title', sortable: true, className: 'max-w-[180px] truncate' },
    {
      key: 'company', label: 'Company', sortable: true, sortKey: 'company.name',
      render: (_: any, row: any) => row.company?.name || <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'department', label: 'Department', sortable: true, sortKey: 'department.name',
      render: (_: any, row: any) => row.department?.name || <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'priority', label: 'Priority', sortable: true,
      render: (v: string) => <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', priorityColors[v])}>{v}</span>,
    },
    {
      key: 'requestedBy', label: 'Requested By', sortable: true, sortKey: 'requestedBy.firstName',
      render: (_: any, row: any) => row.requestedBy ? (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center text-white text-[9px] font-semibold shrink-0">
            {getInitials(row.requestedBy.firstName, row.requestedBy.lastName)}
          </div>
          <span className="text-sm">{row.requestedBy.firstName} {row.requestedBy.lastName}</span>
        </div>
      ) : '—',
    },
    { key: 'requiredDate', label: 'Required Date', sortable: true, render: (v: string) => v ? formatDate(v) : <span className="text-muted-foreground text-xs">—</span> },
    { key: 'createdAt', label: 'Date Created', sortable: true, render: (v: string) => formatDate(v) },
    {
      key: 'totalAmount', label: 'Total Amount', sortable: true, className: 'text-right',
      sortKey: (row: any) => calcPrTotal(row),
      render: (_: any, row: any) => <span className="font-mono font-medium">{formatCurrency(calcPrTotal(row))}</span>,
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (_: any, row: any) => (
        <div className="flex flex-col gap-0.5">
          <StatusBadge status={row.status} />
          {row.status === 'PROCUREMENT' && row.procurementSubStatus && (
            <StatusBadge status={row.procurementSubStatus} />
          )}
        </div>
      ),
    },
    {
      key: 'actions', label: '',
      render: (_: any, row: any) => (
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          {row.status === 'DRAFT' && can('purchase-requests', 'edit') && (
            <button onClick={() => submitMutation.mutate(row.id)} className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600" title="Submit for Approval"><Send className="h-3.5 w-3.5" /></button>
          )}
        </div>
      ),
    },
  ];

  const statusFilters = ['', 'DRAFT', 'PENDING_APPROVAL', 'PROCUREMENT', 'COMPLETED', 'REJECTED', 'CANCELLED'];
  const statusLabels: Record<string, string> = { '': 'All', DRAFT: 'Draft', PENDING_APPROVAL: 'Pending Approval', PROCUREMENT: 'Procurement', COMPLETED: 'Completed', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Requests" description="Manage purchase requests and approvals">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          {can('purchase-requests', 'create') && (
            <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" /> New Request
            </Button>
          )}
        </div>
      </PageHeader>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger value="requests" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            Requests
          </TabsTrigger>
          <TabsTrigger value="line-items" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            Line Items
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-5 space-y-6">

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Requests" value={stats.total} icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Pending Approval" value={stats.pending} icon={<Clock className="h-5 w-5" />} />
        <StatCard title="In Procurement" value={stats.procurement} icon={<Package className="h-5 w-5" />} />
        <StatCard title="Completed" value={stats.completed} icon={<CheckCheck className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={page}
        limit={10}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search by request # or title..."
        isLoading={isLoading}
        emptyMessage="No purchase requests found"
        onRowClick={(row: any) => router.push(`/purchase-requests/${row.id}`)}
        toolbar={
          <div className="flex items-center gap-3 flex-wrap">
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Filter className="h-3.5 w-3.5 mr-1.5" /> Filters
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[340px] p-0" align="start">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
                  <p className="text-sm font-semibold">Filters</p>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <X className="h-3 w-3" /> Clear all
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Company</Label>
                    <SearchableSelect options={companies} value={filterCompanyId} onChange={(v) => { setFilterCompanyId(v); setPage(1); }} placeholder="All companies" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Department</Label>
                    <SearchableSelect options={departments} value={filterDepartmentId} onChange={(v) => { setFilterDepartmentId(v); setPage(1); }} placeholder="All departments" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Priority</Label>
                    <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v === 'ALL' ? '' : v); setPage(1); }}>
                      <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="All priorities" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All priorities</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Required Date</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <DatePicker value={filterRequiredFrom} onChange={(d) => { setFilterRequiredFrom(d); setPage(1); }} placeholder="From" className="h-9 rounded-lg text-xs" />
                      <DatePicker value={filterRequiredTo} onChange={(d) => { setFilterRequiredTo(d); setPage(1); }} placeholder="To" className="h-9 rounded-lg text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Date Created</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <DatePicker value={filterCreatedFrom} onChange={(d) => { setFilterCreatedFrom(d); setPage(1); }} placeholder="From" className="h-9 rounded-lg text-xs" />
                      <DatePicker value={filterCreatedTo} onChange={(d) => { setFilterCreatedTo(d); setPage(1); }} placeholder="To" className="h-9 rounded-lg text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Amount</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" value={filterAmountMin} onChange={(e) => { setFilterAmountMin(e.target.value); setPage(1); }} className="h-9 rounded-lg" placeholder="Min" />
                      <Input type="number" value={filterAmountMax} onChange={(e) => { setFilterAmountMax(e.target.value); setPage(1); }} className="h-9 rounded-lg" placeholder="Max" />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1.5 flex-wrap">
              {statusFilters.map(s => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                  )}
                >
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>
        }
      />

        </TabsContent>

        <TabsContent value="line-items" className="mt-5">
          <AllLineItems />
        </TabsContent>
      </Tabs>

      {/* ─── Create/Edit Modal (Details only, no items) ──── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Purchase Request' : 'New Purchase Request'}</DialogTitle>
            {!editing && <p className="text-sm text-muted-foreground mt-1">Fill in the details. You can add line items after creation.</p>}
          </DialogHeader>
          <form id="pr-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Company <span className="text-red-500">*</span></Label>
              <Controller control={form.control} name="companyId" render={({ field }) => (
                <SearchableSelect options={companies} value={field.value || ''} onChange={field.onChange} placeholder="Select company" />
              )} />
              {form.formState.errors.companyId && <p className="text-xs text-red-500">{form.formState.errors.companyId.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Title <span className="text-red-500">*</span></Label>
                <Input {...form.register('title')} className={cn('h-9 rounded-lg', form.formState.errors.title && 'border-red-300')} placeholder="e.g. Q2 Office Supplies" />
                {form.formState.errors.title && <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Priority</Label>
                <Controller control={form.control} name="priority" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Department</Label>
                <Controller control={form.control} name="departmentId" render={({ field }) => (
                  <SearchableSelect options={departments} value={field.value || ''} onChange={field.onChange} placeholder="Select department" />
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Required Date <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="requiredDate" render={({ field }) => (
                  <DatePicker value={field.value || undefined} onChange={(d) => field.onChange(d)} />
                )} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Purpose of Request <span className="text-red-500">*</span></Label>
              <Textarea {...form.register('description')} className="rounded-lg" rows={2} placeholder="e.g., Quarterly restock, New project requirement..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Purchase Terms <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="purchaseTerms" render={({ field }) => (
                  <SearchableSelect options={purchaseTermOptions} value={field.value || ''} onChange={field.onChange} placeholder="Select terms" />
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Delivery Terms <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="deliveryTerms" render={({ field }) => (
                  <SearchableSelect options={deliveryTermOptions} value={field.value || ''} onChange={field.onChange} placeholder="Select delivery terms" />
                )} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Type of Delivery <span className="text-red-500">*</span></Label>
              <Controller control={form.control} name="deliveryType" render={({ field }) => (
                <SearchableSelect options={deliveryTypeOptions} value={field.value || ''} onChange={field.onChange} placeholder="Select type of delivery" />
              )} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Internal Notes</Label>
              <Textarea {...form.register('notes')} className="rounded-lg" rows={2} placeholder="Optional internal notes..." />
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="pr-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMutation.isPending || updateMutation.isPending}>
              {(() => {
                if (createMutation.isPending || updateMutation.isPending) return 'Saving...';
                return editing ? 'Update Request' : 'Create Request';
              })()}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Purchase Request"
        description={`Are you sure you want to delete ${deleteTarget?.requestNumber}? This action cannot be undone.`}
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />

      {/* ─── Reject Modal ────────────────────────────────── */}
      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent className="max-w-md p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-red-50 dark:bg-red-900/10 border-b rounded-t-2xl">
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5" /> Reject Purchase Request
            </DialogTitle>
            <p className="text-sm text-red-600/70 dark:text-red-400/70 mt-1">{rejectTarget?.requestNumber} — {rejectTarget?.title}</p>
          </DialogHeader>
          <div className="px-6 py-5 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Reason for rejection</Label>
              <Textarea
                value={rejectionNote}
                onChange={e => setRejectionNote(e.target.value)}
                placeholder="Explain why this request is being rejected..."
                rows={3}
                className="rounded-lg"
              />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, rejectionNote })} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
