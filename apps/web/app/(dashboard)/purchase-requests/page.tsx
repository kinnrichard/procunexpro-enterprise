'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { downloadCsv } from '@/lib/export';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
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
import {
  FileText, Plus, Pencil, Trash2, Send, CheckCircle, XCircle,
  Clock, CheckCheck, FileX, Eye, Download,
} from 'lucide-react';

// ─── Schema (details only, no items) ─────────────────────────
const prSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional(),
  companyId: z.string().min(1, 'Company is required'),
  departmentId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  requiredDate: z.date().optional().nullable(),
  notes: z.string().optional(),
});

type PRFormData = z.infer<typeof prSchema>;

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
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectionNote, setRejectionNote] = useState('');

  // ─── Queries ────────────────────────────────────────────
  const { data: response, isLoading } = useQuery({
    queryKey: ['purchase-requests', page, search, statusFilter],
    queryFn: () => api.get('/purchase-requests', { params: { page, limit: 10, search, ...(statusFilter && { status: statusFilter }) } }),
  });

  const { data: deptData } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/departments', { params: { limit: 1000 } }),
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants-all'],
    queryFn: () => api.get('/tenants', { params: { limit: 1000 } }),
  });
  const companies = (tenantsData?.data?.data || []).map((t: any) => ({ value: t.id, label: t.companyName }));

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;

  const stats = useMemo(() => ({
    total,
    pending: items.filter((i: any) => i.status === 'PENDING_APPROVAL').length,
    approved: items.filter((i: any) => i.status === 'APPROVED').length,
    rejected: items.filter((i: any) => i.status === 'REJECTED').length,
  }), [items, total]);

  const departments = (deptData?.data?.data || []).map((d: any) => ({ value: d.id, label: d.name }));

  // ─── Form ───────────────────────────────────────────────
  const form = useForm<PRFormData>({
    resolver: zodResolver(prSchema),
    mode: 'onChange',
    defaultValues: { title: '', description: '', companyId: '', departmentId: '', priority: 'MEDIUM', requiredDate: null, notes: '' },
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

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.put(`/purchase-requests/${id}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }); toast({ title: 'Purchase request approved' }); },
    onError: (err: any) => toast({ title: err.response?.data?.message || 'Failed to approve', variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, rejectionNote }: { id: string; rejectionNote: string }) => api.put(`/purchase-requests/${id}/reject`, { rejectionNote }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-requests'] }); setRejectTarget(null); setRejectionNote(''); toast({ title: 'Purchase request rejected' }); },
    onError: () => toast({ title: 'Failed to reject', variant: 'destructive' }),
  });

  // ─── Handlers ───────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    form.reset({ title: '', description: '', companyId: '', departmentId: '', priority: 'MEDIUM', requiredDate: null, notes: '' });
    setModalOpen(true);
  };

  const openEdit = (pr: any) => {
    setEditing(pr);
    form.reset({
      title: pr.title,
      description: pr.description || '',
      companyId: pr.tenantId || '',
      departmentId: pr.departmentId || '',
      priority: pr.priority,
      requiredDate: pr.requiredDate ? new Date(pr.requiredDate) : null,
      notes: pr.notes || '',
    });
    setModalOpen(true);
  };

  const onSubmit = (data: PRFormData) => {
    const { companyId, ...rest } = data;
    const payload = {
      ...rest,
      tenantId: companyId,
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

  // ─── Table Columns ──────────────────────────────────────
  const columns = [
    {
      key: 'requestNumber', label: 'Request #', sortable: true,
      render: (v: string) => <span className="font-medium text-primary">{v}</span>,
    },
    { key: 'title', label: 'Title', sortable: true, className: 'max-w-[180px] truncate' },
    {
      key: 'department', label: 'Department',
      render: (_: any, row: any) => row.department?.name || <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'requestedBy', label: 'Requested By',
      render: (_: any, row: any) => row.requestedBy ? (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center text-white text-[9px] font-semibold shrink-0">
            {getInitials(row.requestedBy.firstName, row.requestedBy.lastName)}
          </div>
          <span className="text-sm">{row.requestedBy.firstName} {row.requestedBy.lastName}</span>
        </div>
      ) : '—',
    },
    {
      key: 'priority', label: 'Priority',
      render: (v: string) => <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', priorityColors[v])}>{v}</span>,
    },
    {
      key: 'totalAmount', label: 'Amount', sortable: true,
      render: (v: number) => <span className="font-medium">{formatCurrency(v)}</span>,
    },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'createdAt', label: 'Date', sortable: true, render: (v: string) => formatDate(v) },
    {
      key: 'actions', label: '',
      render: (_: any, row: any) => (
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => router.push(`/purchase-requests/${row.id}`)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="View Details"><Eye className="h-3.5 w-3.5" /></button>
          {row.status === 'DRAFT' && (
            <>
              <button onClick={() => submitMutation.mutate(row.id)} className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600" title="Submit for Approval"><Send className="h-3.5 w-3.5" /></button>
              <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
          {row.status === 'PENDING_APPROVAL' && (
            <>
              <button onClick={() => approveMutation.mutate(row.id)} className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600" title="Approve"><CheckCircle className="h-3.5 w-3.5" /></button>
              <button onClick={() => setRejectTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Reject"><XCircle className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      ),
    },
  ];

  const statusFilters = ['', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED'];
  const statusLabels: Record<string, string> = { '': 'All', DRAFT: 'Draft', PENDING_APPROVAL: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', CONVERTED: 'Converted', CANCELLED: 'Cancelled' };

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Requests" description="Manage purchase requests and approvals">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" /> New Request
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Requests" value={stats.total} icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Pending Approval" value={stats.pending} icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Approved" value={stats.approved} icon={<CheckCheck className="h-5 w-5" />} />
        <StatCard title="Rejected" value={stats.rejected} icon={<FileX className="h-5 w-5" />} />
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
        }
      />

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
                <Label className="text-[13px]">Required Date</Label>
                <Controller control={form.control} name="requiredDate" render={({ field }) => (
                  <DatePicker value={field.value || undefined} onChange={(d) => field.onChange(d)} />
                )} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Description</Label>
              <Textarea {...form.register('description')} className="rounded-lg" rows={2} placeholder="Describe the purpose of this request..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Internal Notes</Label>
              <Textarea {...form.register('notes')} className="rounded-lg" rows={2} placeholder="Optional internal notes..." />
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="pr-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : editing ? 'Update Request' : 'Create Request'}
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
