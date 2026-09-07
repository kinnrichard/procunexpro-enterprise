'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { SearchableSelect } from '@/components/ui/searchable-select'
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
  batchCode: z.string().optional().or(z.literal('')),
  itemCode: z.string().optional().or(z.literal('')),
  remarks: z.string().optional().or(z.literal('')),
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

export type ProductFormData = z.infer<typeof productSchema>

// Fallback used only if the tenant's inventory types haven't loaded/seeded yet.
const FALLBACK_INVENTORY_TYPES = [
  { key: 'product', label: 'Product (Finished Good)', hasComposition: true },
  { key: 'raw_material', label: 'Raw Material', hasComposition: false },
  { key: 'component', label: 'Component / Sub-Assembly', hasComposition: true },
  { key: 'consumable', label: 'Consumable / Supplies', hasComposition: false },
  { key: 'packaging', label: 'Packaging', hasComposition: false },
]

const UOM_OPTIONS = [
  'pcs', 'box', 'pack', 'set', 'kg', 'g', 'l', 'ml', 'm',
  'roll', 'bag', 'bottle', 'can', 'pair', 'ream', 'unit',
].map((code) => ({ value: code, label: code }))

type InvType = { key: string; label: string; hasComposition: boolean }
type DropdownItem = { id: string; name: string }

const defaultValues: ProductFormData = {
  inventoryType: 'product',
  name: '', manufacturerId: '', modelNumber: '', sku: '', barcode: '',
  batchCode: '', itemCode: '', remarks: '',
  categoryId: '', subCategoryId: '', originId: '',
  length: '', depth: '', height: '', weight: '',
  unit: 'pcs', minStock: 1, maxStock: 1, reorderQuantity: 1, shelfLifeDays: '', qcRequired: false,
  description: '',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: any | null
  onSaved?: () => void
}

export function ProductFormDialog({ open, onOpenChange, product, onSaved }: Readonly<Props>) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selectedCategoryId, setSelectedCategoryId] = useState('')

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

  const { data: manufacturersRes } = useQuery({
    queryKey: ['manufacturers-active'],
    queryFn: async () => (await api.get<{ data: DropdownItem[] }>('/manufacturers/active')).data,
  })
  const { data: originsRes } = useQuery({
    queryKey: ['origins-active'],
    queryFn: async () => (await api.get<{ data: DropdownItem[] }>('/origins/active')).data,
  })
  const { data: rootCategoriesRes } = useQuery({
    queryKey: ['categories-roots'],
    queryFn: async () => (await api.get<{ data: DropdownItem[] }>('/categories/roots')).data,
  })
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
  const stockUnitOptions = uomOptions.length > 0 ? uomOptions : UOM_OPTIONS
  const categoryOptions = asArray<DropdownItem>(rootCategoriesRes?.data).map((c) => ({ value: c.id, label: c.name }))
  const subCategoryOptions = asArray<DropdownItem>(subCategoriesRes?.data).map((c) => ({ value: c.id, label: c.name }))
  const inventoryTypesList = asArray<InvType>(typesRes?.data)
  const inventoryTypes: InvType[] = inventoryTypesList.length > 0 ? inventoryTypesList : FALLBACK_INVENTORY_TYPES
  const inventoryTypeOptions = inventoryTypes.map((t) => ({ value: t.key, label: t.label }))

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => api.post('/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      onSaved?.()
      onOpenChange(false)
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
      onSaved?.()
      onOpenChange(false)
      toast({ title: 'Item updated', description: 'Changes have been saved.' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update product. Please try again.', variant: 'destructive' })
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  // Populate on open (edit) or reset (create).
  useEffect(() => {
    if (!open) return
    if (product) {
      const catId = product.category?.id || ''
      setSelectedCategoryId(catId)
      reset({
        inventoryType: product.inventoryType || 'product',
        name: product.name,
        manufacturerId: product.manufacturer?.id || '',
        modelNumber: product.modelNumber,
        sku: product.sku,
        barcode: product.barcode || '',
        batchCode: product.batchCode || '',
        itemCode: product.itemCode || '',
        remarks: product.remarks || '',
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
    } else {
      setSelectedCategoryId('')
      reset(defaultValues)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product])

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
    if (product) {
      updateMutation.mutate({ id: product.id, data: cleaned })
    } else {
      createMutation.mutate(cleaned)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
          <DialogTitle>
            {product ? 'Edit Item' : 'Add New Item'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {product ? 'Update the product information below.' : 'Fill in the details to create a new product.'}
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
                <Label className="text-[13px]">Batch Code</Label>
                <Input {...register('batchCode')} placeholder="Optional" className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Item Code</Label>
                <Input {...register('itemCode')} placeholder="Optional" className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Remarks</Label>
                <Input {...register('remarks')} placeholder="Optional" className="h-9 rounded-lg" />
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
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="product-form"
            disabled={!isValid || isSubmitting}
            className="bg-gradient-primary text-white"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {product ? 'Save Changes' : 'Create Item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
