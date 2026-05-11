'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Truck, Pencil, Trash2, CheckCircle, Clock, Ban, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { DataTable, Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { StatusBadge } from '@/components/status-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// --- Schema ---

const vendorSchema = z.object({
  name: z.string().min(2, 'Vendor name is required'),
  code: z.string().min(1, 'Code is required'),
  contactPerson: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  website: z.string().optional().or(z.literal('')),
  taxId: z.string().optional().or(z.literal('')),
  paymentTerms: z.string().optional().or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
  bankAccount: z.string().optional().or(z.literal('')),
  bankRouting: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

type VendorFormData = z.infer<typeof vendorSchema>

type Vendor = {
  id: string
  name: string
  code: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  website: string | null
  taxId: string | null
  paymentTerms: string | null
  bankName: string | null
  bankAccount: string | null
  bankRouting: string | null
  notes: string | null
  status: string
  createdAt: string
}

type PaginatedResponse = { data: Vendor[]; total: number; page: number; limit: number }

const PAGE_SIZE = 10

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'SUSPENDED', label: 'Suspended' },
] as const

// --- Page ---

export default function VendorsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)

  // --- Form ---

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: '', code: '', contactPerson: '', email: '', phone: '',
      address: '', city: '', country: '', website: '', taxId: '',
      paymentTerms: '', bankName: '', bankAccount: '', bankRouting: '', notes: '',
    },
    mode: 'onChange',
  })

  // --- Query ---

  const { data: response, isLoading } = useQuery({
    queryKey: ['vendors', page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      return (await api.get<PaginatedResponse>(`/vendors?${params}`)).data
    },
  })

  const vendors = response?.data ?? []
  const total = response?.total ?? 0

  // --- Stats counts (derive from current page data + total) ---

  const approvedCount = vendors.filter((v) => v.status === 'APPROVED').length
  const pendingCount = vendors.filter((v) => v.status === 'PENDING').length
  const suspendedCount = vendors.filter((v) => v.status === 'SUSPENDED').length

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (data: VendorFormData) => api.post('/vendors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      closeModal()
      toast({ title: 'Vendor created', description: 'The vendor has been added successfully.' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create vendor. Please try again.', variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorFormData }) => api.put(`/vendors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      closeModal()
      toast({ title: 'Vendor updated', description: 'Changes have been saved.' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update vendor. Please try again.', variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      setDeleteTarget(null)
      toast({ title: 'Vendor deleted', description: 'The vendor has been removed.' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete vendor. Please try again.', variant: 'destructive' })
    },
  })

  // --- Helpers ---

  function openAdd() {
    reset({
      name: '', code: '', contactPerson: '', email: '', phone: '',
      address: '', city: '', country: '', website: '', taxId: '',
      paymentTerms: '', bankName: '', bankAccount: '', bankRouting: '', notes: '',
    })
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(vendor: Vendor) {
    reset({
      name: vendor.name,
      code: vendor.code,
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      city: vendor.city || '',
      country: vendor.country || '',
      website: vendor.website || '',
      taxId: vendor.taxId || '',
      paymentTerms: vendor.paymentTerms || '',
      bankName: vendor.bankName || '',
      bankAccount: vendor.bankAccount || '',
      bankRouting: vendor.bankRouting || '',
      notes: vendor.notes || '',
    })
    setEditing(vendor)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  function onSubmit(data: VendorFormData) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleStatusFilter(status: string) {
    setStatusFilter(status)
    setPage(1)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  // --- Columns ---

  const columns: Column<Vendor>[] = [
    {
      key: 'name',
      label: 'Vendor',
      sortable: true,
      render: (_value: any, row: Vendor) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] text-white text-xs font-bold">
            {getInitials(row.name)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{row.name}</p>
          </div>
        </div>
      ),
    },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'contactPerson', label: 'Contact Person', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone' },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (_value: any, row: Vendor) => (
        <button type="button" className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
          <button
            onClick={() => openEdit(row)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </button>
      ),
    },
  ]

  // --- Render ---

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <PageHeader title="Vendors" description="Manage and view all registered vendors">
        <Button onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          Add Vendor
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Vendors"
          value={total}
          icon={<Truck className="h-5 w-5" />}
        />
        <StatCard
          title="Approved"
          value={approvedCount}
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatCard
          title="Pending"
          value={pendingCount}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title="Suspended"
          value={suspendedCount}
          icon={<Ban className="h-5 w-5" />}
        />
      </div>

      {/* Data Table */}
      <DataTable<Vendor>
        columns={columns}
        data={vendors}
        total={total}
        page={page}
        limit={PAGE_SIZE}
        onPageChange={setPage}
        onSearch={handleSearchChange}
        searchPlaceholder="Search vendors by name, code, email..."
        onRowClick={openEdit}
        isLoading={isLoading}
        emptyMessage="No vendors found. Add your first vendor to get started."
        emptyIcon={<Truck className="h-12 w-12 text-muted-foreground/40 mb-3" />}
        toolbar={
          <div className="flex items-center gap-1.5">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.id}
                onClick={() => handleStatusFilter(chip.id)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                  statusFilter === chip.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-accent'
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle className="text-xl font-semibold">
              {editing ? 'Edit Vendor' : 'Add New Vendor'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              {editing ? 'Update the vendor information below.' : 'Fill in the details to create a new vendor.'}
            </DialogDescription>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <form id="vendor-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Row: Name, Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Name <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('name')}
                    placeholder="e.g., ABC Supplies Inc."
                    className={cn(errors.name && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Code <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('code')}
                    placeholder="e.g., VND-001"
                    className={cn(errors.code && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
                </div>
              </div>

              {/* Row: Contact Person, Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Contact Person</Label>
                  <Input {...register('contactPerson')} placeholder="Full name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Email</Label>
                  <Input
                    {...register('email')}
                    placeholder="vendor@email.com"
                    className={cn(errors.email && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
              </div>

              {/* Row: Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Phone</Label>
                  <Input {...register('phone')} placeholder="+1 234 567 8900" />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Address</p>
              </div>

              {/* Row: Address, City, Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Address</Label>
                  <Input {...register('address')} placeholder="Street address" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">City</Label>
                  <Input {...register('city')} placeholder="City" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Country</Label>
                  <Input {...register('country')} placeholder="Country" />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Business Details</p>
              </div>

              {/* Row: Website, Tax ID, Payment Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Website</Label>
                  <Input {...register('website')} placeholder="https://example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Tax ID</Label>
                  <Input {...register('taxId')} placeholder="Tax identification number" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Payment Terms</Label>
                  <Input {...register('paymentTerms')} placeholder="e.g., Net 30" />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Banking Information</p>
              </div>

              {/* Row: Bank Name, Bank Account, Bank Routing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Bank Name</Label>
                  <Input {...register('bankName')} placeholder="Bank name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Bank Account</Label>
                  <Input {...register('bankAccount')} placeholder="Account number" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Bank Routing</Label>
                  <Input {...register('bankRouting')} placeholder="Routing number" />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-sm">Notes</Label>
                <Textarea
                  {...register('notes')}
                  placeholder="Additional notes about this vendor..."
                  className="min-h-[80px]"
                />
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between">
            <button
              type="button"
              onClick={closeModal}
              className="text-sm font-medium text-muted-foreground hover:text-red-500 transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              form="vendor-form"
              disabled={!isValid || isSubmitting}
              className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90 rounded-lg"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Vendor'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Vendor"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
