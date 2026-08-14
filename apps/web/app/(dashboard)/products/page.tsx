'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Package, Pencil, Ban, RotateCcw, AlertTriangle, Layers, Loader2, Plus, Printer } from 'lucide-react'
import { LabelSheet, LabelItem } from '@/components/label-sheet'
import api from '@/lib/api'
import { usePermissions } from '@/lib/permissions'
import { DataTable, Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { StatusBadge } from '@/components/status-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProductCompositionDialog } from '@/components/product-composition-dialog'
import { FilterPopover, FilterField } from '@/components/filter-popover'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// --- Schema ---

const productSchema = z.object({
  inventoryType: z.string().default('product'),
  name: z.string().min(2, 'Name is required'),
  manufacturerId: z.string().min(1, 'Manufacturer is required'),
  modelNumber: z.string().min(1, 'Model number is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional().or(z.literal('')),
  categoryId: z.string().min(1, 'Category is required'),
  subCategoryId: z.string().min(1, 'Sub category is required'),
  originId: z.string().min(1, 'Origin is required'),

  // Specs (optional)
  length: z.coerce.number().min(0).optional().or(z.literal('')),
  depth: z.coerce.number().min(0).optional().or(z.literal('')),
  height: z.coerce.number().min(0).optional().or(z.literal('')),
  weight: z.coerce.number().min(0).optional().or(z.literal('')),

  // Stock levels (fractional allowed for weight/volume based items)
  unit: z.string().default('pcs'),
  minStock: z.coerce.number().min(0).default(1),
  maxStock: z.coerce.number().min(0).default(1),
  reorderQuantity: z.coerce.number().min(0).default(1),
  shelfLifeDays: z.coerce.number().int().min(0).optional().or(z.literal('')),
  qcRequired: z.boolean().optional().default(false),

  // Description
  description: z.string().optional().or(z.literal('')),

})

type ProductFormData = z.infer<typeof productSchema>

// Fallback used only if the tenant's inventory types haven't loaded/seeded yet.
const FALLBACK_INVENTORY_TYPES = [
  { key: 'product', label: 'Product (Finished Good)', hasComposition: true },
  { key: 'raw_material', label: 'Raw Material', hasComposition: false },
  { key: 'component', label: 'Component / Sub-Assembly', hasComposition: true },
  { key: 'consumable', label: 'Consumable / Supplies', hasComposition: false },
  { key: 'packaging', label: 'Packaging', hasComposition: false },
]

// Badge colors keyed by type key; custom types get a neutral default.
const INVENTORY_TYPE_COLORS: Record<string, string> = {
  product: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  raw_material: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  component: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  consumable: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  packaging: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}
const DEFAULT_TYPE_COLOR = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

type InvType = { key: string; label: string; hasComposition: boolean }

type Product = {
  id: string
  inventoryType: string
  name: string
  modelNumber: string
  sku: string
  barcode: string | null
  description: string | null
  manufacturer: { id: string; name: string }
  origin: { id: string; name: string }
  length: number | null
  depth: number | null
  height: number | null
  weight: number | null
  unit: string
  minStock: number
  maxStock: number
  reorderQuantity: number
  shelfLifeDays: number | null
  qcRequired: boolean
  currentStock: number
  reorderPoint: number
  costPrice: number
  sellingPrice: number | null
  isActive: boolean
  category: { id: string; name: string }
  subCategory: { id: string; name: string } | null
  vendor: { id: string; name: string } | null
  warehouse: { id: string; name: string } | null
  location: { id: string; name: string } | null
  createdAt: string
}

type PaginatedResponse = { data: Product[]; total: number; page: number; limit: number }
type DropdownItem = { id: string; name: string }

const PAGE_SIZE = 10

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'INACTIVE', label: 'Inactive' },
  { id: 'low-stock', label: 'Low Stock' },
] as const

const UOM_OPTIONS = [
  'pcs', 'box', 'pack', 'set', 'kg', 'g', 'l', 'ml', 'm',
  'roll', 'bag', 'bottle', 'can', 'pair', 'ream', 'unit',
].map((code) => ({ value: code, label: code }))

// --- Page ---

export default function ProductsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { can } = usePermissions()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Product | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [printItems, setPrintItems] = useState<LabelItem[]>([])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handlePrintLabels() {
    const rows = selectedIds.size ? products.filter((p) => selectedIds.has(p.id)) : products
    if (rows.length === 0) return
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    setPrintItems(rows.map((p) => ({ id: p.id, name: p.name, code: p.sku, url: `${origin}/products/${p.sku}`, sub: p.sku })))
  }
  const [compositionTarget, setCompositionTarget] = useState<Product | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')

  // Advanced filters
  const [filterInventoryType, setFilterInventoryType] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterManufacturerId, setFilterManufacturerId] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState<Date | undefined>()
  const [filterCreatedTo, setFilterCreatedTo] = useState<Date | undefined>()
  const activeFilterCount = [filterInventoryType, filterCategoryId, filterManufacturerId, filterCreatedFrom, filterCreatedTo].filter(Boolean).length
  const toDateStr = (d?: Date) => (d ? d.toISOString().split('T')[0] : '')
  function clearFilters() {
    setFilterInventoryType('')
    setFilterCategoryId('')
    setFilterManufacturerId('')
    setFilterCreatedFrom(undefined)
    setFilterCreatedTo(undefined)
    setPage(1)
  }

  // --- Form ---

  const defaultValues: ProductFormData = {
    inventoryType: 'product',
    name: '', manufacturerId: '', modelNumber: '', sku: '', barcode: '',
    categoryId: '', subCategoryId: '', originId: '',
    length: '', depth: '', height: '', weight: '',
    unit: 'pcs', minStock: 1, maxStock: 1, reorderQuantity: 1, shelfLifeDays: '', qcRequired: false,
    description: '',
  }

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isValid },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues,
    mode: 'onChange',
  })

  // --- Queries ---

  const { data: response, isLoading } = useQuery({
    queryKey: ['products', page, search, statusFilter, filterInventoryType, filterCategoryId, filterManufacturerId, filterCreatedFrom, filterCreatedTo],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      if (statusFilter === 'ACTIVE' || statusFilter === 'INACTIVE') {
        params.set('status', statusFilter)
      }
      if (filterInventoryType) params.set('inventoryType', filterInventoryType)
      if (filterCategoryId) params.set('categoryId', filterCategoryId)
      if (filterManufacturerId) params.set('manufacturerId', filterManufacturerId)
      if (filterCreatedFrom) params.set('createdDateFrom', toDateStr(filterCreatedFrom))
      if (filterCreatedTo) params.set('createdDateTo', toDateStr(filterCreatedTo))
      return (await api.get<PaginatedResponse>(`/products?${params}`)).data
    },
  })

  const products = response?.data ?? []
  const total = response?.total ?? 0

  // Manufacturers
  const { data: manufacturersRes } = useQuery({
    queryKey: ['manufacturers-active'],
    queryFn: async () => (await api.get<{ data: DropdownItem[] }>('/manufacturers/active')).data,
  })

  // Origins
  const { data: originsRes } = useQuery({
    queryKey: ['origins-active'],
    queryFn: async () => (await api.get<{ data: DropdownItem[] }>('/origins/active')).data,
  })

  // Root categories (no parent)
  const { data: rootCategoriesRes } = useQuery({
    queryKey: ['categories-roots'],
    queryFn: async () => (await api.get<{ data: DropdownItem[] }>('/categories/roots')).data,
  })

  // Subcategories based on selected category
  const { data: subCategoriesRes } = useQuery({
    queryKey: ['subcategories', selectedCategoryId],
    queryFn: async () => {
      if (!selectedCategoryId) return { data: [] }
      return (await api.get<{ data: DropdownItem[] }>(`/categories/${selectedCategoryId}/subcategories`)).data
    },
    enabled: !!selectedCategoryId,
  })

  const { data: typesRes } = useQuery({
    queryKey: ['inventory-types-active'],
    queryFn: async () => (await api.get<{ data: InvType[] }>('/inventory-types/active')).data,
  })

  const { data: uomRes } = useQuery({
    queryKey: ['uom-active'],
    queryFn: async () => (await api.get<{ data: { code: string; name: string }[] }>('/units-of-measure/active')).data,
  })

  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  const manufacturerOptions = asArray<DropdownItem>(manufacturersRes?.data).map((m) => ({ value: m.id, label: m.name }))
  const originOptions = asArray<DropdownItem>(originsRes?.data).map((o) => ({ value: o.id, label: o.name }))
  const uomOptions = asArray<{ code: string; name: string }>(uomRes?.data).map((u) => ({ value: u.code, label: u.code }))
  // Prefer configured Units of Measure; fall back to the standard list so the picker is never empty
  const stockUnitOptions = uomOptions.length > 0 ? uomOptions : UOM_OPTIONS
  const categoryOptions = asArray<DropdownItem>(rootCategoriesRes?.data).map((c) => ({ value: c.id, label: c.name }))
  const subCategoryOptions = asArray<DropdownItem>(subCategoriesRes?.data).map((c) => ({ value: c.id, label: c.name }))

  // Configurable inventory types (falls back to the built-in list until loaded)
  const inventoryTypesList = asArray<InvType>(typesRes?.data)
  const inventoryTypes: InvType[] = inventoryTypesList.length > 0 ? inventoryTypesList : FALLBACK_INVENTORY_TYPES
  const inventoryTypeOptions = inventoryTypes.map((t) => ({ value: t.key, label: t.label }))
  const typeByKey: Record<string, InvType> = Object.fromEntries(inventoryTypes.map((t) => [t.key, t]))
  const canCompose = (key: string) => typeByKey[key]?.hasComposition ?? false
  const typeLabel = (key: string) => typeByKey[key]?.label ?? key

  // --- Stats ---

  const lowStockCount = products.filter((p) => p.isActive && p.currentStock <= p.reorderPoint).length
  const categoryCount = new Set(products.filter((p) => p.category).map((p) => p.category.id)).size

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => api.post('/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      closeModal()
      toast({ title: 'Item created', description: 'The item has been added successfully.' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create product. Please try again.', variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductFormData }) => api.put(`/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      closeModal()
      toast({ title: 'Item updated', description: 'Changes have been saved.' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update product. Please try again.', variant: 'destructive' })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/products/${id}`, { isActive }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setToggleTarget(null)
      toast({ title: vars.isActive ? 'Item activated' : 'Item deactivated' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update item. Please try again.', variant: 'destructive' })
    },
  })

  // --- Helpers ---

  function openAdd() {
    reset(defaultValues)
    setSelectedCategoryId('')
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(product: Product) {
    const catId = product.category?.id || ''
    setSelectedCategoryId(catId)
    reset({
      inventoryType: product.inventoryType || 'product',
      name: product.name,
      manufacturerId: product.manufacturer?.id || '',
      modelNumber: product.modelNumber,
      sku: product.sku,
      barcode: product.barcode || '',
      categoryId: catId,
      subCategoryId: product.subCategory?.id || '',
      originId: product.origin?.id || '',
      length: product.length ?? '',
      depth: product.depth ?? '',
      height: product.height ?? '',
      weight: product.weight ?? '',
      unit: product.unit || 'pcs',
      minStock: product.minStock,
      maxStock: product.maxStock,
      reorderQuantity: product.reorderQuantity,
      shelfLifeDays: product.shelfLifeDays ?? '',
      qcRequired: product.qcRequired ?? false,
      description: product.description || '',
    })
    setEditing(product)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setSelectedCategoryId('')
  }

  function onSubmit(data: ProductFormData) {
    const cleaned = {
      ...data,
      length: data.length === '' ? undefined : data.length,
      depth: data.depth === '' ? undefined : data.depth,
      height: data.height === '' ? undefined : data.height,
      weight: data.weight === '' ? undefined : data.weight,
      shelfLifeDays: data.shelfLifeDays === '' ? undefined : data.shelfLifeDays,
      description: data.description || undefined,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: cleaned })
    } else {
      createMutation.mutate(cleaned)
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

  const columns: Column<Product>[] = [
    {
      key: 'select',
      label: '',
      className: 'w-[36px]',
      render: (_v: any, row: Product) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleSelect(row.id)}
          className="h-4 w-4 rounded border-input accent-primary cursor-pointer align-middle"
        />
      ),
    },
    {
      key: 'name',
      label: 'Item',
      sortable: true,
      render: (_value: any, row: Product) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] text-white">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{row.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{row.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'inventoryType',
      label: 'Type',
      sortable: true,
      render: (value: any) => {
        const key = value as string
        return (
          <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', INVENTORY_TYPE_COLORS[key] || DEFAULT_TYPE_COLOR)}>
            {typeLabel(key)}
          </span>
        )
      },
    },
    {
      key: 'manufacturer.name',
      label: 'Manufacturer',
      sortable: true,
      render: (value: any) => value || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'modelNumber',
      label: 'Model #',
      sortable: true,
      render: (value: any) => <span className="font-mono text-sm">{value}</span>,
    },
    {
      key: 'category.name',
      label: 'Category',
      sortable: true,
      render: (value: any, row: Product) => (
        <div>
          <p>{value || '-'}</p>
          {row.subCategory && (
            <p className="text-xs text-muted-foreground">{row.subCategory.name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'origin.name',
      label: 'Origin',
      sortable: true,
      render: (value: any) => value || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'currentStock',
      label: 'Stock',
      sortable: true,
      render: (_value: any, row: Product) => {
        const isLow = row.currentStock <= row.reorderPoint
        return (
          <div className="flex items-center gap-1.5">
            <span className={cn('font-mono text-sm font-semibold', isLow ? 'text-red-600' : 'text-foreground')}>
              {row.currentStock}
            </span>
            <span className="text-xs text-muted-foreground">{row.unit}</span>
            {isLow && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          </div>
        )
      },
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (_value: any, row: Product) => (
        <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (_value: any, row: Product) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {can('products', 'edit') && canCompose(row.inventoryType) && (
            <button
              onClick={() => setCompositionTarget(row)}
              title="Composition"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
          )}
          {can('products', 'edit') && (
            <button
              onClick={() => openEdit(row)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {can('products', 'edit') && (
            row.isActive ? (
              <button
                onClick={() => setToggleTarget(row)}
                title="Deactivate"
                className="p-1.5 rounded-md text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
              >
                <Ban className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setToggleTarget(row)}
                title="Activate"
                className="p-1.5 rounded-md text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </div>
      ),
    },
  ]

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Items" description="Manage your items catalog and inventory">
        {can('products', 'create') && (
          <Button onClick={openAdd} className="bg-gradient-primary text-white hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" /> New Item
          </Button>
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Items"
          value={total}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          title="Low Stock"
          value={lowStockCount}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          title="Categories"
          value={categoryCount}
          icon={<Layers className="h-5 w-5" />}
        />
      </div>

      {/* Data Table */}
      <DataTable<Product>
        columns={columns}
        data={products}
        total={total}
        page={page}
        limit={PAGE_SIZE}
        onPageChange={(p) => { setPage(p); setSelectedIds(new Set()); }}
        onSearch={handleSearchChange}
        searchPlaceholder="Search by name, SKU, manufacturer, model..."
        onRowClick={(row: any) => router.push(`/products/${row.sku}`)}
        isLoading={isLoading}
        emptyMessage="No items found. Add your first item to get started."
        emptyIcon={<Package className="h-12 w-12 text-muted-foreground/40 mb-3" />}
        toolbar={
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrintLabels} className="h-9" title="Print labels for selected items (or all on this page)">
              <Printer className="h-4 w-4 mr-1.5" /> Print labels{selectedIds.size ? ` (${selectedIds.size})` : ''}
            </Button>
            <FilterPopover activeCount={activeFilterCount} onClear={clearFilters}>
              <FilterField label="Inventory Type">
                <Select value={filterInventoryType || 'ALL'} onValueChange={(v) => { setFilterInventoryType(v === 'ALL' ? '' : v); setPage(1) }}>
                  <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All types</SelectItem>
                    {inventoryTypeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Category">
                <SearchableSelect options={categoryOptions} value={filterCategoryId} onChange={(v) => { setFilterCategoryId(v); setPage(1) }} placeholder="All categories" />
              </FilterField>
              <FilterField label="Manufacturer">
                <SearchableSelect options={manufacturerOptions} value={filterManufacturerId} onChange={(v) => { setFilterManufacturerId(v); setPage(1) }} placeholder="All manufacturers" />
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
              {editing ? 'Edit Item' : 'Add New Item'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              {editing ? 'Update the product information below.' : 'Fill in the details to create a new product.'}
            </DialogDescription>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <form id="product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Inventory Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Inventory Type</Label>
                  <Controller
                    control={control}
                    name="inventoryType"
                    render={({ field }) => (
                      <SearchableSelect
                        options={inventoryTypeOptions}
                        value={field.value || 'product'}
                        onChange={(val) => field.onChange(val)}
                        placeholder="Select type"
                      />
                    )}
                  />
                </div>
              </div>

              {/* Row: Name, Manufacturer, Model Number, SKU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Name <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('name')}
                    placeholder="e.g., Latex Gloves"
                    className={cn('h-9 rounded-lg', errors.name && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Manufacturer <span className="text-red-500">*</span></Label>
                  <Controller
                    control={control}
                    name="manufacturerId"
                    render={({ field }) => (
                      <SearchableSelect
                        options={manufacturerOptions}
                        value={field.value || ''}
                        onChange={(val) => field.onChange(val)}
                        placeholder="Select manufacturer"
                      />
                    )}
                  />
                  {errors.manufacturerId && <p className="text-xs text-red-500">{errors.manufacturerId.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Model Number <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('modelNumber')}
                    placeholder="e.g., MDL-2024"
                    className={cn('h-9 rounded-lg', errors.modelNumber && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.modelNumber && <p className="text-xs text-red-500">{errors.modelNumber.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">SKU <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('sku')}
                    placeholder="e.g., PRD-001"
                    className={cn('h-9 rounded-lg', errors.sku && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  {errors.sku && <p className="text-xs text-red-500">{errors.sku.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Barcode</Label>
                  <Input {...register('barcode')} placeholder="UPC / EAN / any code (optional)" className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Origin <span className="text-red-500">*</span></Label>
                  <Controller
                    control={control}
                    name="originId"
                    render={({ field }) => (
                      <SearchableSelect
                        options={originOptions}
                        value={field.value || ''}
                        onChange={(val) => field.onChange(val)}
                        placeholder="Select origin"
                      />
                    )}
                  />
                  {errors.originId && <p className="text-xs text-red-500">{errors.originId.message}</p>}
                </div>
              </div>

              {/* Row: Category, Sub Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Category <span className="text-red-500">*</span></Label>
                  <Controller
                    control={control}
                    name="categoryId"
                    render={({ field }) => (
                      <SearchableSelect
                        options={categoryOptions}
                        value={field.value || ''}
                        onChange={(val) => {
                          field.onChange(val)
                          setSelectedCategoryId(val)
                          setValue('subCategoryId', '')
                        }}
                        placeholder="Select category"
                      />
                    )}
                  />
                  {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Sub Category <span className="text-red-500">*</span></Label>
                  <Controller
                    control={control}
                    name="subCategoryId"
                    render={({ field }) => (
                      <SearchableSelect
                        options={subCategoryOptions}
                        value={field.value || ''}
                        onChange={(val) => field.onChange(val)}
                        placeholder={selectedCategoryId ? 'Select sub category' : 'Select a category first'}
                        disabled={!selectedCategoryId}
                      />
                    )}
                  />
                  {errors.subCategoryId && <p className="text-xs text-red-500">{errors.subCategoryId.message}</p>}
                </div>
              </div>

              {/* Specs Section */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Specifications (Optional)</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Length</Label>
                  <Input type="number" step="0.01" {...register('length')} placeholder="0" className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Depth</Label>
                  <Input type="number" step="0.01" {...register('depth')} placeholder="0" className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Height</Label>
                  <Input type="number" step="0.01" {...register('height')} placeholder="0" className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Weight</Label>
                  <Input type="number" step="0.01" {...register('weight')} placeholder="0" className="h-9 rounded-lg" />
                </div>
              </div>

              {/* Stock Levels Section */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Stock Levels</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Stock Unit</Label>
                  <Controller
                    control={control}
                    name="unit"
                    render={({ field }) => (
                      <SearchableSelect
                        options={stockUnitOptions}
                        value={field.value || 'pcs'}
                        onChange={(val) => field.onChange(val)}
                        placeholder="Select unit"
                      />
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Min Stock</Label>
                  <Input type="number" step="any" {...register('minStock')} placeholder="1" className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Max Stock</Label>
                  <Input type="number" step="any" {...register('maxStock')} placeholder="1" className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Reorder Qty</Label>
                  <Input type="number" step="any" {...register('reorderQuantity')} placeholder="1" className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Shelf Life (days)</Label>
                  <Input type="number" {...register('shelfLifeDays')} placeholder="e.g., 730" className="h-9 rounded-lg" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...register('qcRequired')} className="h-4 w-4 rounded border-input" />
                <span>Requires QC inspection</span>
                <span className="text-xs text-muted-foreground">— received/produced lots start as Pending QC and can&apos;t be consumed until passed</span>
              </label>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-[13px]">Description</Label>
                <Textarea
                  {...register('description')}
                  placeholder="Additional notes about this product..."
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
              form="product-form"
              disabled={!isValid || isSubmitting}
              className="bg-gradient-primary text-white"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ProductCompositionDialog
        productId={compositionTarget?.id ?? null}
        productName={compositionTarget?.name}
        open={!!compositionTarget}
        onOpenChange={(open) => !open && setCompositionTarget(null)}
      />

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={toggleTarget?.isActive ? 'Deactivate Item' : 'Activate Item'}
        description={
          toggleTarget?.isActive
            ? `Mark "${toggleTarget?.name}" as inactive? It will be hidden from active lists and selection pickers, but its records are kept. You can reactivate it anytime.`
            : `Reactivate "${toggleTarget?.name}"? It will appear in active lists and pickers again.`
        }
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        variant={toggleTarget?.isActive ? 'destructive' : 'default'}
        onConfirm={() => toggleTarget && toggleActiveMutation.mutate({ id: toggleTarget.id, isActive: !toggleTarget.isActive })}
        isLoading={toggleActiveMutation.isPending}
      />

      <LabelSheet items={printItems} onDone={() => setPrintItems([])} />
    </div>
  )
}
