'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/auth'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { useCurrencyStore } from '@/lib/currency'
import { useTaxStore } from '@/lib/tax'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'

import {
  Building2, Palette, Bell, Shield, Factory, Globe, Network, Users, Coins, Star, Percent, FileText, Truck,
  Plus, Pencil, Trash2, Loader2, ChevronRight, FolderTree,
} from 'lucide-react'

// ============================================================
// Shared Helpers
// ============================================================

function buildHierarchicalPayload(formData: { name: string; code: string; description: string; parentId: string; [key: string]: any }) {
  return { ...formData, parentId: formData.parentId || null, description: formData.description || null }
}

function makeHierarchicalSubmitHandler(
  formData: { name: string; code: string; description: string; parentId: string; [key: string]: any },
  editing: { id: string } | null,
  createMutation: { mutate: (payload: any) => void },
  updateMutation: { mutate: (args: { id: string; data: any }) => void },
) {
  return (e: React.FormEvent) => {
    e.preventDefault()
    const payload = buildHierarchicalPayload(formData)
    if (editing) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }
}

// ============================================================
// Categories Config
// ============================================================

type Category = {
  id: string
  name: string
  code: string
  description: string | null
  parentId: string | null
  isActive: boolean
  parent: { id: string; name: string } | null
  _count: { children: number; products: number }
}

function CategoriesConfig() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: '', code: '', description: '', parentId: '' })
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const { data: response, isLoading } = useQuery({
    queryKey: ['categories-config', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (search) params.set('search', search)
      return (await api.get<{ data: Category[] }>(`/categories?${params}`)).data
    },
  })

  const allCategories = response?.data ?? []
  const rootCategories = allCategories.filter((c) => !c.parentId)
  const getChildren = (parentId: string) => allCategories.filter((c) => c.parentId === parentId)

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/categories', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories-config'] }); closeModal(); toast({ title: 'Category created' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to create category.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/categories/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories-config'] }); closeModal(); toast({ title: 'Category updated' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to update category.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories-config'] }); setDeleteTarget(null); toast({ title: 'Category deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete. It may have products or subcategories.', variant: 'destructive' }),
  })

  function openAdd(parentId?: string) {
    setFormData({ name: '', code: '', description: '', parentId: parentId || '' })
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(cat: Category) {
    setFormData({ name: cat.name, code: cat.code, description: cat.description || '', parentId: cat.parentId || '' })
    setEditing(cat)
    setModalOpen(true)
  }

  function closeModal() { setModalOpen(false); setEditing(null) }

  const handleSubmit = makeHierarchicalSubmitHandler(formData, editing, createMutation, updateMutation)

  function toggleExpand(id: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function renderCategoryContent() {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )
    }
    if (rootCategories.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No categories found. Add your first category.</div>
    }
    return (
      <div className="divide-y divide-border/30">
        {rootCategories.map((cat) => renderCategory(cat))}
      </div>
    )
  }

  function renderCategory(cat: Category, depth: number = 0) {
    const children = getChildren(cat.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedCategories.has(cat.id)

    return (
      <div key={cat.id}>
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 hover:bg-accent/50 rounded-lg group transition-colors',
            depth > 0 && 'ml-6 border-l-2 border-border/50'
          )}
        >
          {hasChildren ? (
            <button onClick={() => toggleExpand(cat.id)} className="p-0.5 text-muted-foreground hover:text-foreground">
              <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{cat.name}</span>
              <span className="text-xs font-mono text-muted-foreground">{cat.code}</span>
              {!cat.isActive && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>}
            </div>
            {cat.description && <p className="text-xs text-muted-foreground truncate">{cat.description}</p>}
          </div>

          <div className="flex items-center gap-2">
            {hasChildren && (
              <span className="text-xs text-muted-foreground">{children.length} sub</span>
            )}
            <span className="text-xs text-muted-foreground">{cat._count.products} products</span>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {!cat.parentId && (
              <button onClick={() => openAdd(cat.id)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent" title="Add subcategory">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={() => openEdit(cat)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDeleteTarget(cat)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {isExpanded && children.map((child) => renderCategory(child, depth + 1))}
      </div>
    )
  }

  let categoryModalTitle: string
  let categoryModalDesc: string
  if (editing) {
    categoryModalTitle = 'Edit Category'
    categoryModalDesc = 'Update category details.'
  } else if (formData.parentId) {
    categoryModalTitle = 'Add Subcategory'
    categoryModalDesc = 'Create a new subcategory.'
  } else {
    categoryModalTitle = 'Add Category'
    categoryModalDesc = 'Create a new root category.'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Button size="sm" onClick={() => openAdd()} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
      </div>

      <Card>
        <CardContent className="p-2">
          {renderCategoryContent()}
        </CardContent>
      </Card>

      {/* Category Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogTitle>{categoryModalTitle}</DialogTitle>
          <DialogDescription>{categoryModalDesc}</DialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Name <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Code <span className="text-red-500">*</span></Label>
              <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required placeholder="e.g., ELEC" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!formData.name || !formData.code || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Category"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// ============================================================
// Simple Config Table (Manufacturers / Origins)
// ============================================================

type ConfigItem = {
  id: string
  name: string
  code?: string | null
  isActive: boolean
  _count?: { products?: number }
}

const CONFIG_PAGE_SIZE = 10;

function SimpleConfigTable({ endpoint, label, hasCode }: Readonly<{ endpoint: string; label: string; hasCode?: boolean }>) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ConfigItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConfigItem | null>(null)
  const [formData, setFormData] = useState({ name: '', code: '' })

  const { data: response, isLoading } = useQuery({
    queryKey: [endpoint, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (search) params.set('search', search)
      return (await api.get<{ data: ConfigItem[] }>(`/${endpoint}?${params}`)).data
    },
  })

  const allItems = response?.data ?? []
  const totalPages = Math.ceil(allItems.length / CONFIG_PAGE_SIZE);
  const items = allItems.slice((page - 1) * CONFIG_PAGE_SIZE, page * CONFIG_PAGE_SIZE);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/${endpoint}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [endpoint] }); closeModal(); toast({ title: `${label} created` }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || `Failed to create ${label.toLowerCase()}.`, variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/${endpoint}/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [endpoint] }); closeModal(); toast({ title: `${label} updated` }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || `Failed to update ${label.toLowerCase()}.`, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/${endpoint}/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [endpoint] }); setDeleteTarget(null); toast({ title: `${label} deleted` }) },
    onError: () => toast({ title: 'Error', description: `Failed to delete. It may have linked products.`, variant: 'destructive' }),
  })

  function openAdd() { setFormData({ name: '', code: '' }); setEditing(null); setModalOpen(true) }
  function openEdit(item: ConfigItem) { setFormData({ name: item.name, code: item.code || '' }); setEditing(item); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = { name: formData.name }
    if (hasCode) payload.code = formData.code || null
    if (editing) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function renderSimpleContent() {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )
    }
    if (items.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No {label.toLowerCase()}s found.</div>
    }
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
            {hasCode && <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Code</th>}
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Products</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="w-[80px] px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-2.5 font-medium">{item.name}</td>
              {hasCode && <td className="px-4 py-2.5 font-mono text-muted-foreground">{item.code || '-'}</td>}
              <td className="px-4 py-2.5 text-center text-muted-foreground">{item._count?.products ?? '—'}</td>
              <td className="px-4 py-2.5 text-center">
                <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">
                  {item.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-0.5 justify-end">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder={`Search ${label.toLowerCase()}s...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add {label}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {renderSimpleContent()}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{allItems.length} {label.toLowerCase()}{allItems.length === 1 ? '' : 's'}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{editing ? `Edit ${label}` : `Add ${label}`}</DialogTitle>
          <DialogDescription>{editing ? `Update ${label.toLowerCase()} details.` : `Create a new ${label.toLowerCase()}.`}</DialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Name <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            {hasCode && (
              <div className="space-y-1.5">
                <Label className="text-sm">Code</Label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g., US" />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!formData.name || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${label}`}
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// ============================================================
// Company Config (Multi-Company CRUD)
// ============================================================

function CompanyConfig() {
  return (
    <SimpleConfigTable
      endpoint="companies"
      label="Company"
    />
  )
}

// ============================================================
// Departments Config
// ============================================================

type Department = {
  id: string
  name: string
  code: string
  description: string | null
  parentId: string | null
  isActive: boolean
  parent: { id: string; name: string } | null
  _count: { children: number; users: number }
}

function DepartmentsConfig() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)
  const [formData, setFormData] = useState({ name: '', code: '', description: '', parentId: '', isActive: true })

  const { data: response, isLoading } = useQuery({
    queryKey: ['departments-config', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (search) params.set('search', search)
      return (await api.get<{ data: Department[] }>(`/departments?${params}`)).data
    },
  })

  const allDepts = response?.data ?? []
  const deptOptions = allDepts
    .filter((d) => d.id !== editing?.id)
    .map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/departments', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments-config'] }); closeModal(); toast({ title: 'Department created' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to create department.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/departments/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments-config'] }); closeModal(); toast({ title: 'Department updated' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to update department.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments-config'] }); setDeleteTarget(null); toast({ title: 'Department deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete. It may have users.', variant: 'destructive' }),
  })

  function openAdd() { setFormData({ name: '', code: '', description: '', parentId: '', isActive: true }); setEditing(null); setModalOpen(true) }
  function openEdit(dept: Department) {
    setFormData({ name: dept.name, code: dept.code, description: dept.description || '', parentId: dept.parentId || '', isActive: dept.isActive })
    setEditing(dept); setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditing(null) }

  const handleSubmit = makeHierarchicalSubmitHandler(formData, editing, createMutation, updateMutation)

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function renderDeptsContent() {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      )
    }
    if (allDepts.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No departments found.</div>
    }
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Department</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Code</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Parent</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Users</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="w-[80px] px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {allDepts.map((dept) => (
            <tr key={dept.id} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-2.5">
                <div>
                  <p className="font-medium">{dept.name}</p>
                  {dept.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{dept.description}</p>}
                </div>
              </td>
              <td className="px-4 py-2.5 font-mono text-muted-foreground">{dept.code}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{dept.parent?.name || '-'}</td>
              <td className="px-4 py-2.5 text-center">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {dept._count.users}
                </span>
              </td>
              <td className="px-4 py-2.5 text-center">
                <Badge variant={dept.isActive ? 'default' : 'secondary'} className="text-[10px]">
                  {dept.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-0.5 justify-end">
                  <button onClick={() => openEdit(dept)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(dept)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search departments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Department
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {renderDeptsContent()}
        </CardContent>
      </Card>

      {/* Department Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editing ? 'Edit Department' : 'Add Department'}</DialogTitle>
          <DialogDescription>{editing ? 'Update department details.' : 'Create a new department.'}</DialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Name <span className="text-red-500">*</span></Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Code <span className="text-red-500">*</span></Label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required placeholder="e.g., ENG" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Parent Department</Label>
              <SearchableSelect
                options={deptOptions}
                value={formData.parentId}
                onChange={(val) => setFormData({ ...formData, parentId: val })}
                placeholder="None (top level)"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formData.isActive} onCheckedChange={(val) => setFormData({ ...formData, isActive: val })} />
              <Label className="text-sm">Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!formData.name || !formData.code || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Department"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// ============================================================
// Currencies Config
// ============================================================

type CurrencyItem = {
  id: string
  name: string
  code: string
  symbol: string | null
  isDefault: boolean
  isActive: boolean
}

function CurrenciesConfig() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const reloadCurrency = useCurrencyStore((s) => s.reload)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CurrencyItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CurrencyItem | null>(null)
  const [formData, setFormData] = useState({ name: '', code: '', symbol: '', isDefault: false })

  const { data: response, isLoading } = useQuery({
    queryKey: ['currencies', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (search) params.set('search', search)
      return (await api.get<{ data: CurrencyItem[] }>(`/currencies?${params}`)).data
    },
  })

  const items = response?.data ?? []

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/currencies', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['currencies'] }); reloadCurrency(); closeModal(); toast({ title: 'Currency created' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to create currency.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/currencies/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['currencies'] }); reloadCurrency(); closeModal(); toast({ title: 'Currency updated' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to update currency.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/currencies/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['currencies'] }); reloadCurrency(); setDeleteTarget(null); toast({ title: 'Currency deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete currency.', variant: 'destructive' }),
  })

  function openAdd() { setFormData({ name: '', code: '', symbol: '', isDefault: false }); setEditing(null); setModalOpen(true) }
  function openEdit(item: CurrencyItem) { setFormData({ name: item.name, code: item.code, symbol: item.symbol || '', isDefault: item.isDefault }); setEditing(item); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { name: formData.name, code: formData.code.toUpperCase(), symbol: formData.symbol || null, isDefault: formData.isDefault }
    if (editing) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function renderCurrenciesContent() {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      )
    }
    if (items.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No currencies found. Add your first currency.</div>
    }
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Code</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Symbol</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Default</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="w-[80px] px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-2.5 font-medium">{item.name}</td>
              <td className="px-4 py-2.5 font-mono">{item.code}</td>
              <td className="px-4 py-2.5">{item.symbol || '-'}</td>
              <td className="px-4 py-2.5 text-center">
                {item.isDefault && <Star className="h-4 w-4 text-amber-500 mx-auto fill-amber-500" />}
              </td>
              <td className="px-4 py-2.5 text-center">
                <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">
                  {item.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-0.5 justify-end">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search currencies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Currency
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {renderCurrenciesContent()}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{editing ? 'Edit Currency' : 'Add Currency'}</DialogTitle>
          <DialogDescription>{editing ? 'Update currency details.' : 'Add a new currency.'}</DialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Name <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., US Dollar" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Code <span className="text-red-500">*</span></Label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required placeholder="e.g., USD" maxLength={3} className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Symbol</Label>
                <Input value={formData.symbol} onChange={(e) => setFormData({ ...formData, symbol: e.target.value })} placeholder="e.g., $" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formData.isDefault} onCheckedChange={(val) => setFormData({ ...formData, isDefault: val })} />
              <Label className="text-sm">Set as default currency</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!formData.name || !formData.code || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Currency"
        description={`Delete "${deleteTarget?.name} (${deleteTarget?.code})"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// ============================================================
// Taxes Config
// ============================================================

type TaxItem = {
  id: string
  name: string
  rate: number
  isDefault: boolean
  isActive: boolean
}

function TaxesConfig() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const reloadTax = useTaxStore((s) => s.reload)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaxItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TaxItem | null>(null)
  const [formData, setFormData] = useState({ name: '', rate: '', isDefault: false })

  const { data: response, isLoading } = useQuery({
    queryKey: ['taxes', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (search) params.set('search', search)
      return (await api.get<{ data: TaxItem[] }>(`/taxes?${params}`)).data
    },
  })

  const items = response?.data ?? []

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/taxes', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['taxes'] }); reloadTax(); closeModal(); toast({ title: 'Tax created' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to create tax.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/taxes/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['taxes'] }); reloadTax(); closeModal(); toast({ title: 'Tax updated' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to update tax.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/taxes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['taxes'] }); reloadTax(); setDeleteTarget(null); toast({ title: 'Tax deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete tax.', variant: 'destructive' }),
  })

  function openAdd() { setFormData({ name: '', rate: '', isDefault: false }); setEditing(null); setModalOpen(true) }
  function openEdit(item: TaxItem) { setFormData({ name: item.name, rate: String(item.rate), isDefault: item.isDefault }); setEditing(item); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { name: formData.name, rate: Number.parseFloat(formData.rate) || 0, isDefault: formData.isDefault }
    if (editing) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function renderTaxesContent() {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      )
    }
    if (items.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No taxes configured. Add your first tax rate.</div>
    }
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Rate</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Default</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="w-[80px] px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-2.5 font-medium">{item.name}</td>
              <td className="px-4 py-2.5 text-right font-mono">{item.rate}%</td>
              <td className="px-4 py-2.5 text-center">
                {item.isDefault && <Star className="h-4 w-4 text-amber-500 mx-auto fill-amber-500" />}
              </td>
              <td className="px-4 py-2.5 text-center">
                <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">{item.isActive ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-0.5 justify-end">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search taxes..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9" />
        <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Tax
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {renderTaxesContent()}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{editing ? 'Edit Tax' : 'Add Tax'}</DialogTitle>
          <DialogDescription>{editing ? 'Update tax details.' : 'Add a new tax rate.'}</DialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Name <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., VAT, GST, Sales Tax" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Rate (%) <span className="text-red-500">*</span></Label>
              <Input type="number" step="0.01" min="0" max="100" value={formData.rate} onChange={(e) => setFormData({ ...formData, rate: e.target.value })} placeholder="e.g., 12" required />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formData.isDefault} onCheckedChange={(val) => setFormData({ ...formData, isDefault: val })} />
              <Label className="text-sm">Set as default tax</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!formData.name || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Tax"
        description={`Delete "${deleteTarget?.name} (${deleteTarget?.rate}%)"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// ============================================================
// Config Table with Description (Purchase Terms / Delivery Terms)
// ============================================================

type ConfigWithDescItem = { id: string; name: string; description: string | null; isDefault: boolean; isActive: boolean }

function ConfigTableWithDesc({ endpoint, label, showDefault = true }: Readonly<{ endpoint: string; label: string; showDefault?: boolean }>) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ConfigWithDescItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConfigWithDescItem | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '', isDefault: false })

  const { data: response, isLoading } = useQuery({
    queryKey: [endpoint, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (search) params.set('search', search)
      return (await api.get<{ data: ConfigWithDescItem[] }>(`/${endpoint}?${params}`)).data
    },
  })
  const allItems = response?.data ?? []
  const totalPages = Math.ceil(allItems.length / CONFIG_PAGE_SIZE);
  const items = allItems.slice((page - 1) * CONFIG_PAGE_SIZE, page * CONFIG_PAGE_SIZE);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/${endpoint}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [endpoint] }); closeModal(); toast({ title: `${label} created` }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || `Failed to create.`, variant: 'destructive' }),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/${endpoint}/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [endpoint] }); closeModal(); toast({ title: `${label} updated` }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || `Failed to update.`, variant: 'destructive' }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/${endpoint}/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [endpoint] }); setDeleteTarget(null); toast({ title: `${label} deleted` }) },
    onError: () => toast({ title: 'Error', description: `Failed to delete.`, variant: 'destructive' }),
  })

  function openAdd() { setFormData({ name: '', description: '', isDefault: false }); setEditing(null); setModalOpen(true) }
  function openEdit(item: ConfigWithDescItem) { setFormData({ name: item.name, description: item.description || '', isDefault: item.isDefault }); setEditing(item); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null) }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { name: formData.name, description: formData.description || null, isDefault: formData.isDefault }
    if (editing) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function renderConfigWithDescContent() {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      )
    }
    if (items.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No {label.toLowerCase()}s found.</div>
    }
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Description</th>
            {showDefault && <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Default</th>}
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="w-[80px] px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-2.5 font-medium">{item.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[300px] truncate">{item.description || '—'}</td>
              {showDefault && <td className="px-4 py-2.5 text-center">{item.isDefault && <Star className="h-4 w-4 text-amber-500 mx-auto fill-amber-500" />}</td>}
              <td className="px-4 py-2.5 text-center"><Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">{item.isActive ? 'Active' : 'Inactive'}</Badge></td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-0.5 justify-end">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder={`Search ${label.toLowerCase()}s...`} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9" />
        <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add {label}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {renderConfigWithDescContent()}
        </CardContent>
      </Card>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{allItems.length} {label.toLowerCase()}{allItems.length === 1 ? '' : 's'}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{editing ? `Edit ${label}` : `Add ${label}`}</DialogTitle>
          <DialogDescription>{editing ? `Update details.` : `Add a new ${label.toLowerCase()}.`}</DialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Name <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder={`e.g., ${label} name`} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Optional description..." />
            </div>
            {showDefault && (
              <div className="flex items-center gap-3">
                <Switch checked={formData.isDefault} onCheckedChange={(val) => setFormData({ ...formData, isDefault: val })} />
                <Label className="text-sm">Set as default</Label>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!formData.name || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title={`Delete ${label}`} description={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" variant="destructive" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} isLoading={deleteMutation.isPending} />
    </div>
  )
}

// ============================================================
// Chart of Accounts Config
// ============================================================

const COA_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const
type CoaType = (typeof COA_TYPES)[number]

type GlAccount = {
  id: string
  code: string
  title: string
  name: string
  accountType: string
  type: string
  classification: string
  category: string
  subCategory: string | null
  isActive: boolean
}

type CoaClassification = {
  id: string
  name: string
  accountType: string
  isActive: boolean
}

type CoaCategory = {
  id: string
  name: string
  classificationId: string
  classification: { id: string; name: string; accountType: string }
  isActive: boolean
}

type CoaSubCategory = {
  id: string
  name: string
  categoryId: string
  category: { id: string; name: string; classification: { id: string; name: string; accountType: string } }
  isActive: boolean
}

// ── CoA: Classifications sub-section ────────────────────────

function CoaClassificationsSection() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CoaClassification | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CoaClassification | null>(null)
  const [formData, setFormData] = useState({ accountType: '' as CoaType | '', name: '' })

  const { data: response, isLoading } = useQuery({
    queryKey: ['coa-classifications', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (search) params.set('search', search)
      return (await api.get<{ data: CoaClassification[] }>(`/coa/classifications?${params}`)).data
    },
  })

  const allItems = response?.data ?? []
  const filtered = search ? allItems.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())) : allItems
  const totalPages = Math.ceil(filtered.length / CONFIG_PAGE_SIZE)
  const items = filtered.slice((page - 1) * CONFIG_PAGE_SIZE, page * CONFIG_PAGE_SIZE)

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/coa/classifications', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coa-classifications'] }); closeModal(); toast({ title: 'Classification created' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to create classification.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/coa/classifications/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coa-classifications'] }); closeModal(); toast({ title: 'Classification updated' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to update classification.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coa/classifications/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coa-classifications'] }); setDeleteTarget(null); toast({ title: 'Classification deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete. It may have linked categories.', variant: 'destructive' }),
  })

  function openAdd() { setFormData({ accountType: '', name: '' }); setEditing(null); setModalOpen(true) }
  function openEdit(item: CoaClassification) { setFormData({ accountType: item.accountType as CoaType, name: item.name }); setEditing(item); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { accountType: formData.accountType, name: formData.name }
    if (editing) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const selectClass = 'w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'

  function renderContent() {
    if (isLoading) {
      return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
    }
    if (items.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No classifications found.</div>
    }
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Account Type</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="w-[80px] px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-2.5 font-medium">{item.name}</td>
              <td className="px-4 py-2.5">
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">{item.accountType}</span>
              </td>
              <td className="px-4 py-2.5 text-center">
                <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">{item.isActive ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-0.5 justify-end">
                  <button type="button" onClick={() => openEdit(item)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setDeleteTarget(item)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search classifications..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="max-w-xs h-9" />
        <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Classification
        </Button>
      </div>
      <Card><CardContent className="p-0">{renderContent()}</CardContent></Card>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filtered.length} classification{filtered.length === 1 ? '' : 's'}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{editing ? 'Edit Classification' : 'Add Classification'}</DialogTitle>
          <DialogDescription>{editing ? 'Update classification details.' : 'Create a new COA classification.'}</DialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Account Type <span className="text-red-500">*</span></Label>
              <select value={formData.accountType} onChange={(e) => setFormData({ ...formData, accountType: e.target.value as CoaType })} required className={selectClass}>
                <option value="">Select type...</option>
                {COA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Name <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., Current Assets" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!formData.accountType || !formData.name || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Delete Classification" description={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" variant="destructive" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} isLoading={deleteMutation.isPending} />
    </div>
  )
}

// ── CoA: Categories sub-section ──────────────────────────────

function CoaCategoriesSection() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CoaCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CoaCategory | null>(null)
  const [formData, setFormData] = useState({ classificationId: '', name: '' })

  const { data: response, isLoading } = useQuery({
    queryKey: ['coa-categories'],
    queryFn: async () => (await api.get<{ data: CoaCategory[] }>('/coa/categories?limit=1000')).data,
  })

  const { data: classRes } = useQuery({
    queryKey: ['coa-classifications'],
    queryFn: async () => (await api.get<{ data: CoaClassification[] }>('/coa/classifications?limit=1000')).data,
  })

  const allItems = response?.data ?? []
  const classOptions = (classRes?.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.accountType})` }))
  const filtered = search ? allItems.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.classification.name.toLowerCase().includes(search.toLowerCase())) : allItems
  const totalPages = Math.ceil(filtered.length / CONFIG_PAGE_SIZE)
  const items = filtered.slice((page - 1) * CONFIG_PAGE_SIZE, page * CONFIG_PAGE_SIZE)

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/coa/categories', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coa-categories'] }); closeModal(); toast({ title: 'Category created' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to create category.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/coa/categories/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coa-categories'] }); closeModal(); toast({ title: 'Category updated' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to update category.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coa/categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coa-categories'] }); setDeleteTarget(null); toast({ title: 'Category deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete. It may have linked sub-categories.', variant: 'destructive' }),
  })

  function openAdd() { setFormData({ classificationId: '', name: '' }); setEditing(null); setModalOpen(true) }
  function openEdit(item: CoaCategory) { setFormData({ classificationId: item.classificationId, name: item.name }); setEditing(item); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { classificationId: formData.classificationId, name: formData.name }
    if (editing) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function renderContent() {
    if (isLoading) {
      return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
    }
    if (items.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No categories found.</div>
    }
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Classification</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="w-[80px] px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-2.5 font-medium">{item.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.classification.name}</td>
              <td className="px-4 py-2.5">
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">{item.classification.accountType}</span>
              </td>
              <td className="px-4 py-2.5 text-center">
                <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">{item.isActive ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-0.5 justify-end">
                  <button type="button" onClick={() => openEdit(item)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setDeleteTarget(item)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search categories..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="max-w-xs h-9" />
        <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
      </div>
      <Card><CardContent className="p-0">{renderContent()}</CardContent></Card>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filtered.length} categor{filtered.length === 1 ? 'y' : 'ies'}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>{editing ? 'Update category details.' : 'Create a new COA category.'}</DialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Classification <span className="text-red-500">*</span></Label>
              <SearchableSelect options={classOptions} value={formData.classificationId} onChange={(val) => setFormData({ ...formData, classificationId: val })} placeholder="Select classification..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Name <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., Cash & Cash Equivalents" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!formData.classificationId || !formData.name || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Delete Category" description={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" variant="destructive" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} isLoading={deleteMutation.isPending} />
    </div>
  )
}

// ── CoA: Sub-Categories sub-section ─────────────────────────

function CoaSubCategoriesSection() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CoaSubCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CoaSubCategory | null>(null)
  const [formData, setFormData] = useState({ categoryId: '', name: '' })

  const { data: response, isLoading } = useQuery({
    queryKey: ['coa-sub-categories'],
    queryFn: async () => (await api.get<{ data: CoaSubCategory[] }>('/coa/sub-categories?limit=1000')).data,
  })

  const { data: catRes } = useQuery({
    queryKey: ['coa-categories'],
    queryFn: async () => (await api.get<{ data: CoaCategory[] }>('/coa/categories?limit=1000')).data,
  })

  const allItems = response?.data ?? []
  const catOptions = (catRes?.data ?? []).map((c) => ({ value: c.id, label: `${c.name} — ${c.classification.name}` }))
  const filtered = search
    ? allItems.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.name.toLowerCase().includes(search.toLowerCase()))
    : allItems
  const totalPages = Math.ceil(filtered.length / CONFIG_PAGE_SIZE)
  const items = filtered.slice((page - 1) * CONFIG_PAGE_SIZE, page * CONFIG_PAGE_SIZE)

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/coa/sub-categories', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coa-sub-categories'] }); closeModal(); toast({ title: 'Sub-category created' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to create sub-category.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/coa/sub-categories/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coa-sub-categories'] }); closeModal(); toast({ title: 'Sub-category updated' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to update sub-category.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coa/sub-categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coa-sub-categories'] }); setDeleteTarget(null); toast({ title: 'Sub-category deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete sub-category.', variant: 'destructive' }),
  })

  function openAdd() { setFormData({ categoryId: '', name: '' }); setEditing(null); setModalOpen(true) }
  function openEdit(item: CoaSubCategory) { setFormData({ categoryId: item.categoryId, name: item.name }); setEditing(item); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { categoryId: formData.categoryId, name: formData.name }
    if (editing) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function renderContent() {
    if (isLoading) {
      return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
    }
    if (items.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No sub-categories found.</div>
    }
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Category</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Classification</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="w-[80px] px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-2.5 font-medium">{item.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.category.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.category.classification.name}</td>
              <td className="px-4 py-2.5 text-center">
                <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-[10px]">{item.isActive ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-0.5 justify-end">
                  <button type="button" onClick={() => openEdit(item)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setDeleteTarget(item)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search sub-categories..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="max-w-xs h-9" />
        <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Sub Category
        </Button>
      </div>
      <Card><CardContent className="p-0">{renderContent()}</CardContent></Card>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filtered.length} sub-categor{filtered.length === 1 ? 'y' : 'ies'}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{editing ? 'Edit Sub Category' : 'Add Sub Category'}</DialogTitle>
          <DialogDescription>{editing ? 'Update sub-category details.' : 'Create a new COA sub-category.'}</DialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Category <span className="text-red-500">*</span></Label>
              <SearchableSelect options={catOptions} value={formData.categoryId} onChange={(val) => setFormData({ ...formData, categoryId: val })} placeholder="Select category..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Name <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., Petty Cash" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!formData.categoryId || !formData.name || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Delete Sub Category" description={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" variant="destructive" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} isLoading={deleteMutation.isPending} />
    </div>
  )
}

// ── CoA: Accounts sub-section ────────────────────────────────

type CoaSubTab = 'accounts' | 'classifications' | 'categories' | 'sub-categories'

const COA_SUB_TABS: { key: CoaSubTab; label: string }[] = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'classifications', label: 'Classifications' },
  { key: 'categories', label: 'Categories' },
  { key: 'sub-categories', label: 'Sub Categories' },
]

function CoaAccountsSection() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [coaPage, setCoaPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<GlAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GlAccount | null>(null)
  const [formData, setFormData] = useState({
    type: '' as CoaType | '',
    classificationId: '',
    categoryId: '',
    subCategoryId: '',
    name: '',
    code: '',
  })

  const { data: response, isLoading } = useQuery({
    queryKey: ['gl-accounts-config', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (search) params.set('search', search)
      return (await api.get<{ data: GlAccount[] }>(`/gl-accounts?${params}`)).data
    },
  })

  // Cascading: fetch classifications filtered by type
  const { data: classRes } = useQuery({
    queryKey: ['coa-classifications-for-account', formData.type],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (formData.type) params.set('accountType', formData.type)
      return (await api.get<{ data: CoaClassification[] }>(`/coa/classifications?${params}`)).data
    },
    enabled: !!formData.type,
  })

  // Cascading: fetch categories filtered by classificationId
  const { data: catRes } = useQuery({
    queryKey: ['coa-categories-for-account', formData.classificationId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (formData.classificationId) params.set('classificationId', formData.classificationId)
      return (await api.get<{ data: CoaCategory[] }>(`/coa/categories?${params}`)).data
    },
    enabled: !!formData.classificationId,
  })

  // Cascading: fetch sub-categories filtered by categoryId
  const { data: subCatRes } = useQuery({
    queryKey: ['coa-sub-categories-for-account', formData.categoryId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' })
      if (formData.categoryId) params.set('categoryId', formData.categoryId)
      return (await api.get<{ data: CoaSubCategory[] }>(`/coa/sub-categories?${params}`)).data
    },
    enabled: !!formData.categoryId,
  })

  const classOptions = (classRes?.data ?? []).map((c) => ({ value: c.id, label: c.name }))
  const catOptions = (catRes?.data ?? []).map((c) => ({ value: c.id, label: c.name }))
  const subCatOptions = (subCatRes?.data ?? []).map((s) => ({ value: s.id, label: s.name }))

  const allAccounts = response?.data ?? []
  const allFiltered = typeFilter ? allAccounts.filter((a) => (a.accountType || a.type) === typeFilter) : allAccounts
  const coaTotalPages = Math.ceil(allFiltered.length / CONFIG_PAGE_SIZE)
  const filtered = allFiltered.slice((coaPage - 1) * CONFIG_PAGE_SIZE, coaPage * CONFIG_PAGE_SIZE)

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/gl-accounts', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gl-accounts-config'] }); closeModal(); toast({ title: 'Account created' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to create account.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/gl-accounts/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gl-accounts-config'] }); closeModal(); toast({ title: 'Account updated' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to update account.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/gl-accounts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gl-accounts-config'] }); setDeleteTarget(null); toast({ title: 'Account deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete account.', variant: 'destructive' }),
  })

  function openAdd() {
    setFormData({ type: '', classificationId: '', categoryId: '', subCategoryId: '', name: '', code: '' })
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(account: GlAccount) {
    setFormData({
      type: (account.type || account.accountType) as CoaType,
      classificationId: account.classification,
      categoryId: account.category,
      subCategoryId: account.subCategory || '',
      name: account.title || account.name,
      code: account.code,
    })
    setEditing(account)
    setModalOpen(true)
  }

  function closeModal() { setModalOpen(false); setEditing(null) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      accountType: formData.type,
      classificationId: formData.classificationId || null,
      categoryId: formData.categoryId || null,
      subCategoryId: formData.subCategoryId || null,
      title: formData.name,
      code: formData.code,
    }
    if (editing) updateMutation.mutate({ id: editing.id, data: payload })
    else createMutation.mutate(payload)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const canSubmit = !!formData.type && !!formData.classificationId && !!formData.categoryId && !!formData.name && !!formData.code
  const selectClass = 'w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'

  function renderCoaContent() {
    if (isLoading) {
      return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
    }
    if (filtered.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No accounts found.</div>
    }
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Code</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Classification</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Category</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Sub Category</th>
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="w-[80px] px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filtered.map((account) => (
            <tr key={account.id} className="hover:bg-accent/30 transition-colors">
              <td className="px-4 py-2.5 font-mono text-muted-foreground">{account.code}</td>
              <td className="px-4 py-2.5 font-medium">{account.title || account.name}</td>
              <td className="px-4 py-2.5">
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">{account.accountType || account.type}</span>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{account.classification}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{account.category}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{account.subCategory || '—'}</td>
              <td className="px-4 py-2.5 text-center">
                <Badge variant={account.isActive ? 'default' : 'secondary'} className="text-[10px]">{account.isActive ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-0.5 justify-end">
                  <button type="button" onClick={() => openEdit(account)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setDeleteTarget(account)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="Search accounts..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">All Types</option>
          {COA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Account
        </Button>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">{renderCoaContent()}</CardContent></Card>
      {coaTotalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{allFiltered.length} account{allFiltered.length === 1 ? '' : 's'}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={coaPage <= 1} onClick={() => setCoaPage(coaPage - 1)}>Prev</Button>
            <span className="text-xs text-muted-foreground px-2">{coaPage} / {coaTotalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={coaPage >= coaTotalPages} onClick={() => setCoaPage(coaPage + 1)}>Next</Button>
          </div>
        </div>
      )}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editing ? 'Edit Account' : 'Add Account'}</DialogTitle>
          <DialogDescription>{editing ? 'Update GL account details.' : 'Create a new GL account.'}</DialogDescription>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Account Type <span className="text-red-500">*</span></Label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as CoaType, classificationId: '', categoryId: '', subCategoryId: '' })} required className={selectClass}>
                <option value="">Select type...</option>
                {COA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {formData.type && (
              <div className="space-y-1.5">
                <Label className="text-sm">Classification <span className="text-red-500">*</span></Label>
                <SearchableSelect options={classOptions} value={formData.classificationId} onChange={(val) => setFormData({ ...formData, classificationId: val, categoryId: '', subCategoryId: '' })} placeholder="Select classification..." />
              </div>
            )}
            {formData.classificationId && (
              <div className="space-y-1.5">
                <Label className="text-sm">Category <span className="text-red-500">*</span></Label>
                <SearchableSelect options={catOptions} value={formData.categoryId} onChange={(val) => setFormData({ ...formData, categoryId: val, subCategoryId: '' })} placeholder="Select category..." />
              </div>
            )}
            {formData.categoryId && (
              <div className="space-y-1.5">
                <Label className="text-sm">Sub Category</Label>
                <SearchableSelect options={subCatOptions} value={formData.subCategoryId} onChange={(val) => setFormData({ ...formData, subCategoryId: val })} placeholder="None" />
              </div>
            )}
            {formData.categoryId && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm">Account Title <span className="text-red-500">*</span></Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., Cash on Hand" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Account Code <span className="text-red-500">*</span></Label>
                  <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required placeholder="e.g., 1010" />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Account"
        description={`Delete "${deleteTarget?.name} (${deleteTarget?.code})"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// ── ChartOfAccountsConfig: outer wrapper with sub-tabs ───────

function ChartOfAccountsConfig() {
  const [activeSubTab, setActiveSubTab] = useState<CoaSubTab>('accounts')

  return (
    <div className="space-y-5">
      {/* Sub-tab pill selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {COA_SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubTab(tab.key)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              activeSubTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'accounts' && <CoaAccountsSection />}
      {activeSubTab === 'classifications' && <CoaClassificationsSection />}
      {activeSubTab === 'categories' && <CoaCategoriesSection />}
      {activeSubTab === 'sub-categories' && <CoaSubCategoriesSection />}
    </div>
  )
}

// ============================================================
// Settings Page
// ============================================================

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { theme } = useTheme()

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage application preferences and configuration" />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 overflow-x-auto overflow-y-hidden whitespace-nowrap">
          <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">General</TabsTrigger>
          <TabsTrigger value="company" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Company</TabsTrigger>
          <TabsTrigger value="departments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Departments</TabsTrigger>
          <TabsTrigger value="categories" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Categories</TabsTrigger>
          <TabsTrigger value="manufacturers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Manufacturers</TabsTrigger>
          <TabsTrigger value="origins" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Origins</TabsTrigger>
          <TabsTrigger value="currencies" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Currencies</TabsTrigger>
          <TabsTrigger value="taxes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Taxes</TabsTrigger>
          <TabsTrigger value="purchase-terms" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Purchase Terms</TabsTrigger>
          <TabsTrigger value="delivery-terms" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Delivery Terms</TabsTrigger>
          <TabsTrigger value="delivery-types" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Type of Delivery</TabsTrigger>
          <TabsTrigger value="gl-accounts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">Chart of Accounts</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="mt-5">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Building2 className="h-5 w-5 text-primary" /></div>
                  <div>
                    <CardTitle className="text-lg">General</CardTitle>
                    <CardDescription>Company and regional settings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Company Name</Label>
                    <p className="text-sm text-muted-foreground">{user?.companyName || 'N/A'}</p>
                  </div>
                  <Badge variant="secondary">Read Only</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Timezone</Label>
                    <p className="text-sm text-muted-foreground">America/New_York (UTC-5)</p>
                  </div>
                  <Badge variant="outline">Phase 2</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Currency</Label>
                    <p className="text-sm text-muted-foreground">USD - US Dollar</p>
                  </div>
                  <Badge variant="outline">Phase 2</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Date Format</Label>
                    <p className="text-sm text-muted-foreground">MM/DD/YYYY</p>
                  </div>
                  <Badge variant="outline">Phase 2</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Palette className="h-5 w-5 text-primary" /></div>
                  <div>
                    <CardTitle className="text-lg">Appearance</CardTitle>
                    <CardDescription>Customize the look and feel</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Theme</Label>
                    <p className="text-sm text-muted-foreground">Switch between light and dark mode</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground capitalize">{theme}</span>
                    <ThemeToggle />
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">Reduce spacing for denser layouts</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch disabled />
                    <Badge variant="outline">Phase 2</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Bell className="h-5 w-5 text-primary" /></div>
                  <div>
                    <CardTitle className="text-lg">Notifications</CardTitle>
                    <CardDescription>Configure how you receive alerts</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive email alerts for important events</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch disabled />
                    <Badge variant="outline">Phase 3</Badge>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">In-App Notifications</Label>
                    <p className="text-sm text-muted-foreground">Show notifications in the app</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch disabled />
                    <Badge variant="outline">Phase 3</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Shield className="h-5 w-5 text-primary" /></div>
                  <div>
                    <CardTitle className="text-lg">Security</CardTitle>
                    <CardDescription>Security and authentication settings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Password Policy</Label>
                    <p className="text-sm text-muted-foreground">Configure minimum password requirements</p>
                  </div>
                  <Badge variant="outline">Phase 3</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
                  </div>
                  <Badge variant="outline">Phase 3</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company" className="mt-5">
          <CompanyConfig />
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="mt-5">
          <DepartmentsConfig />
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-5">
          <CategoriesConfig />
        </TabsContent>

        {/* Manufacturers Tab */}
        <TabsContent value="manufacturers" className="mt-5">
          <SimpleConfigTable endpoint="manufacturers" label="Manufacturer" />
        </TabsContent>

        {/* Origins Tab */}
        <TabsContent value="origins" className="mt-5">
          <SimpleConfigTable endpoint="origins" label="Origin" hasCode />
        </TabsContent>

        {/* Currencies Tab */}
        <TabsContent value="currencies" className="mt-5">
          <CurrenciesConfig />
        </TabsContent>

        {/* Taxes Tab */}
        <TabsContent value="taxes" className="mt-5">
          <TaxesConfig />
        </TabsContent>

        {/* Purchase Terms Tab */}
        <TabsContent value="purchase-terms" className="mt-5">
          <ConfigTableWithDesc endpoint="purchase-terms" label="Purchase Term" showDefault={false} />
        </TabsContent>

        {/* Delivery Terms Tab */}
        <TabsContent value="delivery-terms" className="mt-5">
          <ConfigTableWithDesc endpoint="delivery-terms" label="Delivery Term" showDefault={false} />
        </TabsContent>

        {/* Type of Delivery Tab */}
        <TabsContent value="delivery-types" className="mt-5">
          <SimpleConfigTable endpoint="delivery-types" label="Delivery Type" />
        </TabsContent>

        {/* GL Accounts Tab */}
        <TabsContent value="gl-accounts" className="mt-5">
          <ChartOfAccountsConfig />
        </TabsContent>
      </Tabs>
    </div>
  )
}
