'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, Pencil, Trash2, CheckCircle, Clock, Ban, Plus } from 'lucide-react'
import api from '@/lib/api'
import { DataTable, Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { StatusBadge } from '@/components/status-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FilterPopover, FilterField } from '@/components/filter-popover'
import { VendorFormDialog } from '@/components/vendor-form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/lib/permissions'

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
  const router = useRouter()
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

  const approvedCount = vendors.filter((v) => v.status === 'APPROVED').length
  const pendingCount = vendors.filter((v) => v.status === 'PENDING').length
  const suspendedCount = vendors.filter((v) => v.status === 'SUSPENDED').length

  // --- Mutations ---

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
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(vendor: Vendor) {
    setEditing(vendor)
    setModalOpen(true)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleStatusFilter(status: string) {
    setStatusFilter(status)
    setPage(1)
  }

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
        <StatCard title="Total Vendors" value={total} icon={<Truck className="h-5 w-5" />} />
        <StatCard title="Approved" value={approvedCount} icon={<CheckCircle className="h-5 w-5" />} />
        <StatCard title="Pending" value={pendingCount} icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Suspended" value={suspendedCount} icon={<Ban className="h-5 w-5" />} />
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
        onRowClick={(row) => router.push(`/vendors/${row.id}`)}
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
      <VendorFormDialog open={modalOpen} onOpenChange={setModalOpen} vendor={editing} />

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
