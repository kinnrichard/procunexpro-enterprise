'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Truck, Pencil, Trash2, CheckCircle, Clock, Ban, Loader2, Plus } from 'lucide-react'
import api from '@/lib/api'
import { DataTable, Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { StatusBadge } from '@/components/status-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FilterPopover, FilterField } from '@/components/filter-popover'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/lib/permissions'

// --- Schema ---

const WEBSITE_REGEX = /^https?:\/\/.+/i

const vendorSchema = z.object({
  name: z.string().min(2, 'Vendor name is required'),
  code: z.string().optional().or(z.literal('')),
  contactPerson: z.string().min(1, 'Contact person is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  province: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  website: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || WEBSITE_REGEX.test(v), 'Enter a valid URL starting with http:// or https://'),
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
  province: string | null
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
  const { can } = usePermissions()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)

  // --- Advanced filters ---

  const [filterCountry, setFilterCountry] = useState('')
  const [filterPaymentTerms, setFilterPaymentTerms] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState<Date | undefined>()
  const [filterCreatedTo, setFilterCreatedTo] = useState<Date | undefined>()
  const activeFilterCount = [filterCountry, filterPaymentTerms, filterCreatedFrom, filterCreatedTo].filter(Boolean).length
  const toDateStr = (d?: Date) => (d ? d.toISOString().split('T')[0] : '')
  function clearFilters() {
    setFilterCountry('')
    setFilterPaymentTerms('')
    setFilterCreatedFrom(undefined)
    setFilterCreatedTo(undefined)
    setPage(1)
  }

  // --- Form ---

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: '', code: '', contactPerson: '', email: '', phone: '',
      address: '', city: '', province: '', country: '', website: '', taxId: '',
      paymentTerms: '', bankName: '', bankAccount: '', bankRouting: '', notes: '',
    },
    mode: 'onChange',
  })

  // --- Location cascade (country → province → city) + payment terms ---

  const watchedCountry = watch('country')
  const watchedProvince = watch('province')
  const watchedCity = watch('city')
  const watchedPaymentTerms = watch('paymentTerms')

  const { data: countriesData } = useQuery({
    queryKey: ['locations-countries'],
    queryFn: async () => (await api.get('/locations/countries')).data.data as { name: string; code: string }[],
    staleTime: Infinity,
  })
  const countries = countriesData ?? []
  const countryCode = countries.find((c) => c.name === watchedCountry)?.code

  const { data: provincesData } = useQuery({
    queryKey: ['locations-provinces', countryCode],
    queryFn: async () => (await api.get(`/locations/provinces?countryCode=${countryCode}`)).data.data as { name: string; code: string }[],
    enabled: !!countryCode,
    staleTime: Infinity,
  })
  const provinces = provincesData ?? []
  const provinceCode = provinces.find((p) => p.name === watchedProvince)?.code

  const { data: citiesData } = useQuery({
    queryKey: ['locations-cities', countryCode, provinceCode],
    queryFn: async () => (await api.get(`/locations/cities?countryCode=${countryCode}&provinceCode=${provinceCode}`)).data.data as { name: string; code: string }[],
    enabled: !!countryCode && !!provinceCode,
    staleTime: Infinity,
  })
  const cities = citiesData ?? []

  const { data: paymentTermsData } = useQuery({
    queryKey: ['purchase-terms-active'],
    queryFn: async () => (await api.get('/purchase-terms/active')).data.data as { name: string }[],
    staleTime: 60_000,
  })

  const countryOptions = countries.map((c) => ({ value: c.name, label: c.name }))
  const provinceOptions = provinces.map((p) => ({ value: p.name, label: p.name }))
  const cityOptions = cities.map((c) => ({ value: c.name, label: c.name }))
  const paymentTermsOptions = (paymentTermsData ?? []).map((t) => ({ value: t.name, label: t.name }))

  function handleCountryChange(v: string) {
    setValue('country', v, { shouldValidate: true, shouldDirty: true })
    setValue('province', '', { shouldDirty: true })
    setValue('city', '', { shouldDirty: true })
  }
  function handleProvinceChange(v: string) {
    setValue('province', v, { shouldDirty: true })
    setValue('city', '', { shouldDirty: true })
  }

  // --- Query ---

  const { data: response, isLoading } = useQuery({
    queryKey: ['vendors', page, search, statusFilter, filterCountry, filterPaymentTerms, filterCreatedFrom, filterCreatedTo],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (filterCountry) params.set('country', filterCountry)
      if (filterPaymentTerms) params.set('paymentTerms', filterPaymentTerms)
      if (filterCreatedFrom) params.set('createdDateFrom', toDateStr(filterCreatedFrom))
      if (filterCreatedTo) params.set('createdDateTo', toDateStr(filterCreatedTo))
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
      address: '', city: '', province: '', country: '', website: '', taxId: '',
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
      province: vendor.province || '',
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
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {can('vendors', 'edit') && (
            <button
              onClick={() => openEdit(row)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {can('vendors', 'delete') && (
            <button
              onClick={() => setDeleteTarget(row)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ]

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Vendors" description="Manage and view all registered vendors">
        {can('vendors', 'create') && (
          <Button onClick={openAdd} className="bg-gradient-primary text-white hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" /> New Vendor
          </Button>
        )}
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
          <div className="flex items-center gap-3 flex-wrap">
            <FilterPopover activeCount={activeFilterCount} onClear={clearFilters}>
              <FilterField label="Country">
                <Input
                  value={filterCountry}
                  onChange={(e) => { setFilterCountry(e.target.value); setPage(1) }}
                  className="h-9 rounded-lg"
                  placeholder="e.g. Philippines"
                />
              </FilterField>
              <FilterField label="Payment Terms">
                <Input
                  value={filterPaymentTerms}
                  onChange={(e) => { setFilterPaymentTerms(e.target.value); setPage(1) }}
                  className="h-9 rounded-lg"
                  placeholder="e.g. Net 30"
                />
              </FilterField>
              <FilterField label="Date Created">
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker value={filterCreatedFrom} onChange={(d) => { setFilterCreatedFrom(d); setPage(1) }} placeholder="From" className="text-xs" />
                  <DatePicker value={filterCreatedTo} onChange={(d) => { setFilterCreatedTo(d); setPage(1) }} placeholder="To" className="text-xs" />
                </div>
              </FilterField>
            </FilterPopover>
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => handleStatusFilter(chip.id)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    statusFilter === chip.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>
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
                  <Label className="text-[13px]">Name <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('name')}
                    placeholder="e.g., ABC Supplies Inc."
                    className={cn('h-9 rounded-lg', errors.name && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Code</Label>
                  <Input
                    {...register('code')}
                    disabled
                    placeholder="Auto-generated on save"
                    className="h-9 rounded-lg bg-muted/50 text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    {editing ? 'System code (cannot be changed).' : 'Assigned automatically when you save.'}
                  </p>
                </div>
              </div>

              {/* Row: Contact Person, Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Contact Person <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('contactPerson')}
                    placeholder="Full name"
                    className={cn('h-9 rounded-lg', errors.contactPerson && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.contactPerson && <p className="text-xs text-red-500">{errors.contactPerson.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Email</Label>
                  <Input
                    {...register('email')}
                    placeholder="vendor@email.com"
                    className={cn('h-9 rounded-lg', errors.email && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
              </div>

              {/* Row: Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Phone <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('phone')}
                    placeholder="+63 900 000 0000"
                    className={cn('h-9 rounded-lg', errors.phone && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Address</p>
              </div>

              {/* Row: Address */}
              <div className="space-y-1.5">
                <Label className="text-[13px]">Address</Label>
                <Input {...register('address')} placeholder="Street address" className="h-9 rounded-lg" />
              </div>

              {/* Row: Country, Province */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Country</Label>
                  <SearchableSelect
                    options={countryOptions}
                    value={watchedCountry}
                    onChange={handleCountryChange}
                    placeholder="Select country"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Province / State</Label>
                  <SearchableSelect
                    options={provinceOptions}
                    value={watchedProvince}
                    onChange={handleProvinceChange}
                    placeholder={watchedCountry ? 'Select province' : 'Select a country first'}
                    disabled={!countryCode}
                  />
                </div>
              </div>

              {/* Row: City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">City</Label>
                  <SearchableSelect
                    options={cityOptions}
                    value={watchedCity}
                    onChange={(v) => setValue('city', v, { shouldDirty: true })}
                    placeholder={watchedProvince ? 'Select city' : 'Select a province first'}
                    disabled={!provinceCode}
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Business Details</p>
              </div>

              {/* Row: Website, Tax ID, Payment Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Website</Label>
                  <Input
                    {...register('website')}
                    placeholder="https://example.com"
                    className={cn('h-9 rounded-lg', errors.website && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.website && <p className="text-xs text-red-500">{errors.website.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Tax ID</Label>
                  <Input {...register('taxId')} placeholder="Tax identification number" className="h-9 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Payment Terms</Label>
                  <SearchableSelect
                    options={paymentTermsOptions}
                    value={watchedPaymentTerms}
                    onChange={(v) => setValue('paymentTerms', v, { shouldDirty: true })}
                    placeholder={paymentTermsOptions.length ? 'Select payment terms' : 'Configure in Settings › Payment Terms'}
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Banking Information</p>
              </div>

              {/* Row: Bank Name, Bank Account, Bank Routing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Bank Name</Label>
                  <Input {...register('bankName')} placeholder="Bank name" className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Bank Account</Label>
                  <Input {...register('bankAccount')} placeholder="Account number" className="h-9 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Bank Routing</Label>
                  <Input {...register('bankRouting')} placeholder="Routing number" className="h-9 rounded-lg" />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-[13px]">Notes</Label>
                <Textarea
                  {...register('notes')}
                  placeholder="Additional notes about this vendor..."
                  className="rounded-lg min-h-[80px]"
                />
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="vendor-form"
              disabled={!isValid || isSubmitting}
              className="bg-gradient-primary text-white"
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
