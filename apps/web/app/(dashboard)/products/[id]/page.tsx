'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ItemCodes } from '@/components/item-codes'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { StatusBadge } from '@/components/status-badge'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft, Package, ImageIcon, DollarSign,
  Plus, Pencil, Trash2, Loader2, Star, CheckCircle2,
  ShoppingCart, ClipboardList, Upload, Download, Eye,
  Tag, Factory, Hash, Layers, Globe, Boxes, ArrowDownUp,
  Weight, MoveHorizontal, MoveVertical, Warehouse, AlertTriangle,
} from 'lucide-react'

type DropdownItem = { id: string; name: string }

// ── Shared upload event handlers ──────────────────────────────────
function makeFileSelectHandler(uploadFile: (f: File) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }
}

function makeDropHandler(uploadFile: (f: File) => void, setDragging: (v: boolean) => void) {
  return (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }
}

// ── Shared field display component ────────────────────────────────
function Field({ label, value, mono, icon: Icon }: Readonly<{ label: string; value: any; mono?: boolean; icon?: any }>) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={cn('text-sm font-medium flex items-center gap-1.5', mono && 'font-mono')}>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {value || <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  )
}

// ============================================================
// Profile Tab
// ============================================================

function HeroBanner({ product }: Readonly<{ product: any }>) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replaceAll('/api', '') || 'http://localhost:3004'
  const primaryImage = (product.images || []).find((img: any) => img.isPrimary) || (product.images || [])[0]
  let primarySrc: string | null = null
  if (primaryImage) {
    primarySrc = primaryImage.url.startsWith('http') ? primaryImage.url : `${apiBase}${primaryImage.url}`
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-[#1e3a5f] relative px-6 pb-20 pt-6">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h20v20H0V0zm20 20h20v20H20V20z\' fill=\'%23fff\' fill-opacity=\'0.1\'/%3E%3C/svg%3E")', backgroundSize: '20px 20px' }} />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white truncate">{product.name}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-white/70">
              <span className="font-mono">{product.sku}</span>
              <span className="hidden sm:inline text-white/40">|</span>
              <span>{product.manufacturer?.name}</span>
              <span className="hidden sm:inline text-white/40">|</span>
              <span className="font-mono">{product.modelNumber}</span>
            </div>
            {product.description && (
              <p className="text-sm text-white/60 mt-2 line-clamp-2 max-w-2xl">{product.description}</p>
            )}
          </div>
          <Badge className={cn('shrink-0 mt-1', product.isActive ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-400 text-white')}>
            {product.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      <CardContent className="relative px-6 pb-4">
        <div className="flex flex-col sm:flex-row gap-5 -mt-14">
          <div className="shrink-0">
            <div className="w-28 h-28 rounded-2xl border-4 border-background bg-muted overflow-hidden shadow-lg flex items-center justify-center">
              {primarySrc ? (
                <img src={primarySrc} alt={product.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <Package className="h-10 w-10 text-muted-foreground/40" />
              )}
            </div>
          </div>
          <div className="pt-2 sm:pt-7 flex-1 min-w-0">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-white/70">Stock:</span>
                <span className="font-semibold text-white">{product.currentStock}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/70">Category:</span>
                <span className="font-semibold text-white">{product.category?.name}{product.subCategory ? ` / ${product.subCategory.name}` : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/70">Origin:</span>
                <span className="font-semibold text-white">{product.origin?.name || '-'}</span>
              </div>
              <div className="flex items-center gap-1.5 capitalize">
                <span className="text-white/70">Type:</span>
                <span className="font-semibold text-white">{product.inventoryType}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProfileTab({ product }: Readonly<{ product: any }>) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replaceAll('/api', '') || 'http://localhost:3004'

  return (
    <div className="space-y-6">

      <div className="relative my-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-border/60" /></div><div className="relative flex justify-start"><span className="bg-background pr-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Product Details</span></div></div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-4">
        <Field label="Inventory Type" value={product.inventoryType} icon={Tag} />
        <Field label="Name" value={product.name} icon={Package} />
        <Field label="Manufacturer" value={product.manufacturer?.name} icon={Factory} />
        <Field label="Model Number" value={product.modelNumber} mono icon={Hash} />
        <Field label="SKU" value={product.sku} mono icon={Hash} />
        <Field label="Barcode" value={product.barcode} mono icon={Hash} />
        <Field label="Category" value={product.category?.name} icon={Layers} />
        <Field label="Sub Category" value={product.subCategory?.name} icon={Layers} />
        <Field label="Origin" value={product.origin?.name} icon={Globe} />
        <Field label="Current Stock" value={product.currentStock} icon={Boxes} />
        <Field label="Min Stock" value={product.minStock} icon={ArrowDownUp} />
        <Field label="Max Stock" value={product.maxStock} icon={ArrowDownUp} />
        <Field label="Reorder Qty" value={product.reorderQuantity} icon={ArrowDownUp} />
      </div>

      <ItemCodes code={product.id} sub={product.sku} name={product.name} />

      <div className="relative my-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-border/60" /></div><div className="relative flex justify-start"><span className="bg-background pr-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Specifications & Gallery</span></div></div>

      {/* Specifications + Gallery side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Specifications</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <Field label="Length" value={product.length} icon={MoveHorizontal} />
            <Field label="Depth" value={product.depth} icon={MoveHorizontal} />
            <Field label="Height" value={product.height} icon={MoveVertical} />
            <Field label="Weight" value={product.weight} icon={Weight} />
          </div>
        </div>

        {(product.images || []).length > 1 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Gallery</p>
            <div className="grid grid-cols-4 gap-2">
              {(product.images || []).slice(0, 4).map((img: any) => {
                const src = img.url.startsWith('http') ? img.url : `${apiBase}${img.url}`
                return (
                  <div key={img.id} className="aspect-square rounded-lg bg-muted overflow-hidden">
                    <img src={src} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                )
              })}
            </div>
            {(product.images || []).length > 4 && (
              <p className="text-xs text-muted-foreground mt-2">+{(product.images || []).length - 4} more in Media</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Media Tab (Photos only — DO storage placeholder)
// ============================================================

function MediaTab({ product }: Readonly<{ product: any }>) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [viewImage, setViewImage] = useState<string | null>(null)
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replaceAll('/api', '') || 'http://localhost:3004'

  const setPrimaryMutation = useMutation({
    mutationFn: (imageId: string) => api.put(`/products/${product.id}/images/${imageId}`, { isPrimary: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['product'] }); toast({ title: 'Primary photo updated' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to set primary photo.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => api.delete(`/products/${product.id}/images/${imageId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['product'] }); setDeleteTarget(null); toast({ title: 'Photo deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete photo.', variant: 'destructive' }),
  })

  async function uploadFile(file: File) {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i
    if (!allowed.test(file.name)) {
      toast({ title: 'Invalid file', description: 'Only image files are allowed (JPG, PNG, GIF, WEBP, SVG).', variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data: uploaded } = await api.post('/uploads/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await api.post(`/products/${product.id}/images`, {
        url: uploaded.fileUrl,
        fileName: uploaded.fileName,
      })
      queryClient.invalidateQueries({ queryKey: ['product'] })
      toast({ title: 'Photo uploaded' })
    } catch {
      toast({ title: 'Error', description: 'Failed to upload photo.', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = makeFileSelectHandler(uploadFile)
  const handleDrop = makeDropHandler(uploadFile, setDragging)

  const images = [...(product.images || [])].sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{images.length} photo{images.length === 1 ? '' : 's'}</p>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Upload drop zone — same size as photo cards */}
        <label
          className={cn(
            'aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/30',
            uploading && 'opacity-50 cursor-not-allowed pointer-events-none'
          )}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground font-medium">Click or drag</p>
              <p className="text-[10px] text-muted-foreground/60">to upload photo</p>
            </>
          )}
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" onChange={handleFileSelect} disabled={uploading} className="sr-only" />
        </label>

        {/* Photo cards */}
        {images.map((img: any) => {
          const src = img.url.startsWith('http') ? img.url : `${apiBase}${img.url}`
          return (
            <Card key={img.id} className="group relative overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center relative">
                <img src={src} alt={img.caption || img.fileName || 'Product'} className="object-cover w-full h-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <ImageIcon className="h-8 w-8 text-muted-foreground/30 absolute" />

                {/* Hover overlay with View button */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button onClick={() => setViewImage(src)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 text-sm font-medium text-slate-800 hover:bg-white transition-colors">
                    <Eye className="h-3.5 w-3.5" /> View full
                  </button>
                </div>
              </div>

              {/* Star icon — top right, always visible */}
              <button
                onClick={() => !img.isPrimary && setPrimaryMutation.mutate(img.id)}
                className={cn(
                  'absolute top-2 right-2 p-1.5 rounded-full transition-all',
                  img.isPrimary
                    ? 'text-amber-400'
                    : 'text-white/60 hover:text-amber-400 opacity-0 group-hover:opacity-100'
                )}
                title={img.isPrimary ? 'Primary photo' : 'Set as primary'}
              >
                <Star className={cn('h-5 w-5', img.isPrimary && 'fill-amber-400')} />
              </button>

              {/* Delete — bottom right on hover */}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setDeleteTarget(img)} className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {(img.caption || img.fileName) && (
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground truncate">{img.caption || img.fileName}</p>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Fullscreen image viewer */}
      {viewImage && (
        <button type="button" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewImage(null)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
          <div className="relative max-w-4xl max-h-[90vh] pointer-events-none">
            <img src={viewImage} alt="Full view" className="max-w-full max-h-[90vh] object-contain rounded-lg pointer-events-auto" />
            <button onClick={(e) => { e.stopPropagation(); setViewImage(null); }} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-800 flex items-center justify-center hover:bg-gray-100 shadow-lg text-lg font-bold pointer-events-auto">&times;</button>
          </div>
        </button>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Delete Photo" description="Remove this photo?" confirmLabel="Delete" variant="destructive" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} isLoading={deleteMutation.isPending} />
    </div>
  )
}

// ── Document helpers ──────────────────────────────────────────────
function getFileIcon(mimeType: string | null) {
  if (!mimeType) return 'DOC'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'XLS'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC'
  return 'FILE'
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================
// Documents Tab
// ============================================================

function DocumentsTab({ product }: Readonly<{ product: any }>) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replaceAll('/api', '') || 'http://localhost:3004'

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/products/${product.id}/documents/${docId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['product'] }); setDeleteTarget(null); toast({ title: 'Document deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete document.', variant: 'destructive' }),
  })

  async function uploadFile(file: File) {
    const allowed = /\.(pdf|doc|docx|xls|xlsx|csv|txt|ppt|pptx|zip|rar)$/i
    if (!allowed.test(file.name)) {
      toast({ title: 'Invalid file', description: 'Unsupported file type.', variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data: uploaded } = await api.post('/uploads/document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await api.post(`/products/${product.id}/documents`, {
        fileName: uploaded.fileName,
        fileUrl: uploaded.fileUrl,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
      })
      queryClient.invalidateQueries({ queryKey: ['product'] })
      toast({ title: 'Document uploaded' })
    } catch {
      toast({ title: 'Error', description: 'Failed to upload document.', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = makeFileSelectHandler(uploadFile)
  const handleDrop = makeDropHandler(uploadFile, setDragging)

  const documents = product.documents || []

  const iconColors: Record<string, string> = {
    PDF: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    XLS: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    DOC: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    FILE: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        className={cn(
          'flex items-center justify-center gap-3 px-6 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/30',
          uploading && 'opacity-50 cursor-not-allowed pointer-events-none'
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground/40" />
        )}
        <div>
          <p className="text-sm text-muted-foreground font-medium">{uploading ? 'Uploading...' : 'Click or drag file to upload'}</p>
          <p className="text-[10px] text-muted-foreground/60">PDF, Word, Excel, CSV, PowerPoint, ZIP</p>
        </div>
        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip,.rar" onChange={handleFileSelect} disabled={uploading} className="sr-only" />
      </label>

      <p className="text-sm text-muted-foreground">{documents.length} document{documents.length === 1 ? '' : 's'}</p>

      {documents.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">No documents yet.</div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: any) => {
            const url = doc.fileUrl.startsWith('http') ? doc.fileUrl : `${apiBase}${doc.fileUrl}`
            const type = getFileIcon(doc.mimeType)
            return (
              <div key={doc.id} className="group flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/30 transition-colors">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold', iconColors[type])}>
                  {type}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent" title="View">
                    <Eye className="h-3.5 w-3.5" />
                  </a>
                  <a href={url} download className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent" title="Download">
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button onClick={() => setDeleteTarget(doc)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Delete Document" description={`Remove "${deleteTarget?.fileName}"?`} confirmLabel="Delete" variant="destructive" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} isLoading={deleteMutation.isPending} />
    </div>
  )
}

// ============================================================
// Purchase Requests Tab
// ============================================================

function PurchaseRequestsTab({ product }: Readonly<{ product: any }>) {
  const router = useRouter()
  const items = product.purchaseRequestItems || []

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">No purchase requests reference this product.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">PR Number</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Est. Price</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Requested By</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item: any) => {
              const pr = item.purchaseRequest
              return (
                <tr
                  key={item.id}
                  className="hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/purchase-requests/${pr.id}`)}
                >
                  <td className="px-4 py-2.5 font-mono text-sm">{pr.requestNumber}</td>
                  <td className="px-4 py-2.5 font-medium">{pr.title}</td>
                  <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{item.estimatedPrice.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{item.totalPrice.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center"><StatusBadge status={pr.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{pr.requestedBy ? `${pr.requestedBy.firstName} ${pr.requestedBy.lastName}` : '-'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(pr.createdAt).toLocaleDateString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Stock Tab — where this product's stock is held
// ============================================================
const LOT_STATUS_CLASS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  QUARANTINE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  EXPIRED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  DEPLETED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}
const LOT_QC_CLASS: Record<string, string> = {
  PASSED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HOLD: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

function StockTab({ product }: Readonly<{ product: any }>) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [transferOpen, setTransferOpen] = useState(false)
  const [fromWh, setFromWh] = useState('')
  const [toWh, setToWh] = useState('')
  const [qty, setQty] = useState<number>(0)
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['product-stock-lots', product.id],
    queryFn: () => api.get('/stock-lots', { params: { productId: product.id, limit: 1000 } }),
  })
  const { data: whData } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => api.get('/warehouses', { params: { limit: 1000 } }),
  })

  const lots: any[] = data?.data?.data || []
  const unit = product.unit || ''
  const activeLots = lots.filter((l) => l.status !== 'DEPLETED' && (l.quantity || 0) > 0)
  const onHand = activeLots.reduce((s, l) => s + (l.quantity || 0), 0)
  const reorderPoint = product.reorderPoint ?? product.minStock ?? 0
  const isLow = reorderPoint > 0 && (product.currentStock ?? onHand) <= reorderPoint

  const warehouseMap: Record<string, { id: string | null; name: string; quantity: number; lots: number }> = {}
  for (const l of activeLots) {
    const key = l.warehouseId || 'none'
    if (!warehouseMap[key]) warehouseMap[key] = { id: l.warehouseId || null, name: l.warehouse?.name || 'Unassigned', quantity: 0, lots: 0 }
    warehouseMap[key].quantity += l.quantity || 0
    warehouseMap[key].lots += 1
  }
  const byWarehouse = Object.values(warehouseMap).sort((a, b) => b.quantity - a.quantity)

  const allWarehouses = (whData?.data?.data || []).map((w: any) => ({ value: w.id, label: w.name }))
  // Sources = places that actually hold stock (incl. "Unassigned" lots with no warehouse)
  const fromOptions = byWarehouse.map((w) => ({ value: w.id ?? 'UNASSIGNED', label: `${w.name} (${w.quantity.toLocaleString()} ${unit})` }))
  const availableAtFrom = (fromWh === 'UNASSIGNED' ? warehouseMap['none']?.quantity : warehouseMap[fromWh]?.quantity) ?? 0

  const transferMut = useMutation({
    mutationFn: () => api.post('/stock-transfers', {
      fromWarehouseId: fromWh,
      toWarehouseId: toWh,
      notes: notes || undefined,
      items: [{ productId: product.id, quantity: qty }],
    }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['product-stock-lots', product.id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setTransferOpen(false)
      toast({ title: `Transfer ${res?.data?.transferNumber || ''} completed` })
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Transfer failed', variant: 'destructive' }),
  })

  const openTransfer = () => {
    setFromWh(byWarehouse[0] ? (byWarehouse[0].id ?? 'UNASSIGNED') : '')
    setToWh('')
    setQty(0)
    setNotes('')
    setTransferOpen(true)
  }
  const canTransfer = !!fromWh && !!toWh && fromWh !== toWh && qty > 0 && qty <= availableAtFrom

  if (isLoading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total on-hand</p>
          <p className="mt-1 text-2xl font-bold"><span className="font-mono">{onHand.toLocaleString()}</span> <span className="text-sm font-normal text-muted-foreground">{unit}</span></p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Reorder point</p>
          <p className="mt-1 text-2xl font-bold font-mono">{Number(reorderPoint).toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Warehouses</p>
          <p className="mt-1 text-2xl font-bold font-mono">{byWarehouse.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Active lots</p>
          <p className="mt-1 text-2xl font-bold font-mono">{activeLots.length}</p>
        </CardContent></Card>
      </div>

      {isLow && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> On-hand is at or below the reorder point ({Number(reorderPoint).toLocaleString()} {unit}).
        </div>
      )}

      {/* By warehouse */}
      <Card>
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Stock by warehouse</p>
          </div>
          <Button size="sm" onClick={openTransfer} disabled={fromOptions.length === 0 || allWarehouses.length === 0} className="bg-gradient-primary text-white hover:opacity-90">
            <MoveHorizontal className="h-4 w-4 mr-2" /> Transfer stock
          </Button>
        </div>
        <CardContent className="p-0">
          {byWarehouse.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No stock is currently placed in any warehouse.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-4 py-3">Warehouse</th>
                  <th className="text-right px-4 py-3">Lots</th>
                  <th className="text-right px-4 py-3">On-hand</th>
                  <th className="text-right px-4 py-3">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byWarehouse.map((w) => (
                  <tr key={w.name} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium"><span className="flex items-center gap-2"><Warehouse className="h-3.5 w-3.5 text-muted-foreground" /> {w.name}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono">{w.lots}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{w.quantity.toLocaleString()} <span className="text-xs text-muted-foreground font-sans">{unit}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{onHand > 0 ? Math.round((w.quantity / onHand) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Individual lots */}
      <Card>
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Boxes className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Lots</p>
        </div>
        <CardContent className="p-0">
          {lots.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No stock lots recorded for this product yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-4 py-3">Lot #</th>
                  <th className="text-left px-4 py-3">Warehouse</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">QC</th>
                  <th className="text-left px-4 py-3">Expiry</th>
                  <th className="text-left px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lots.map((l) => (
                  <tr key={l.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-sm font-medium">{l.lotNumber}</td>
                    <td className="px-4 py-2.5"><span className="flex items-center gap-1.5"><Warehouse className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {l.warehouse?.name || <span className="text-muted-foreground">Unassigned</span>}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">{(l.quantity ?? 0).toLocaleString()} <span className="text-xs text-muted-foreground font-sans">{unit}</span></td>
                    <td className="px-4 py-2.5 text-center"><span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', LOT_STATUS_CLASS[l.status] || LOT_STATUS_CLASS.DEPLETED)}>{l.status}</span></td>
                    <td className="px-4 py-2.5 text-center"><span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', LOT_QC_CLASS[l.qcStatus] || LOT_QC_CLASS.PASSED)}>{l.qcStatus}</span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{l.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{l.source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Quick transfer modal */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <div className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>Transfer stock — {product.name}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">Move on-hand stock from one warehouse to another.</DialogDescription>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">From warehouse <span className="text-red-500">*</span></Label>
                <SearchableSelect options={fromOptions} value={fromWh} onChange={setFromWh} placeholder="Source" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">To warehouse <span className="text-red-500">*</span></Label>
                <SearchableSelect options={allWarehouses.filter((w: any) => w.value !== fromWh)} value={toWh} onChange={setToWh} placeholder="Destination" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Quantity <span className="text-red-500">*</span></Label>
              <Input type="number" step="any" min={0} value={qty || ''} onChange={(e) => setQty(Number.parseFloat(e.target.value) || 0)} className="h-9 rounded-lg" placeholder={`e.g., 10 ${unit}`} />
              <p className="text-xs text-muted-foreground">Available at source: <span className="font-mono font-medium text-foreground">{availableAtFrom.toLocaleString()} {unit}</span></p>
              {qty > availableAtFrom && qty > 0 && <p className="text-xs text-red-500">Exceeds available stock at the source warehouse.</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-lg" rows={2} placeholder="Optional reason for this transfer..." />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => transferMut.mutate()} className="bg-gradient-primary text-white" disabled={!canTransfer || transferMut.isPending}>
              {transferMut.isPending ? 'Transferring…' : 'Transfer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Purchase Orders Tab
// ============================================================

function PurchaseOrdersTab({ product }: Readonly<{ product: any }>) {
  const router = useRouter()
  const items = product.purchaseOrderItems || []

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">No purchase orders reference this product.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">PO Number</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Vendor</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Unit Price</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Received</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item: any) => {
              const po = item.purchaseOrder
              return (
                <tr
                  key={item.id}
                  className="hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/purchase-orders/${po.id}`)}
                >
                  <td className="px-4 py-2.5 font-mono text-sm">{po.orderNumber}</td>
                  <td className="px-4 py-2.5 font-medium">{po.vendor?.name || '-'}</td>
                  <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{item.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{item.totalPrice.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {(() => {
                      let receivedClass = 'text-muted-foreground'
                      if (item.receivedQty >= item.quantity) receivedClass = 'text-green-600'
                      else if (item.receivedQty > 0) receivedClass = 'text-amber-600'
                      return <span className={cn('font-mono', receivedClass)}>{item.receivedQty}/{item.quantity}</span>
                    })()}
                  </td>
                  <td className="px-4 py-2.5 text-center"><StatusBadge status={po.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(po.createdAt).toLocaleDateString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Pricing Tab
// ============================================================

const PRICING_TYPE_OPTIONS = [
  { value: 'local', label: 'Local' },
  { value: 'imported', label: 'Imported' },
]

const UOM_OPTIONS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
  { value: 'set', label: 'Set' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'l', label: 'Liter (L)' },
  { value: 'ml', label: 'Milliliter (mL)' },
  { value: 'm', label: 'Meter (m)' },
  { value: 'roll', label: 'Roll' },
  { value: 'bag', label: 'Bag' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'can', label: 'Can' },
  { value: 'pair', label: 'Pair' },
  { value: 'ream', label: 'Ream' },
  { value: 'unit', label: 'Unit' },
  { value: 'sheet', label: 'Sheet' },
  { value: 'carton', label: 'Carton' },
  { value: 'drum', label: 'Drum' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'ft', label: 'Feet (ft)' },
  { value: 'in', label: 'Inch (in)' },
  { value: 'cm', label: 'Centimeter (cm)' },
  { value: 'lb', label: 'Pound (lb)' },
  { value: 'oz', label: 'Ounce (oz)' },
  { value: 'gal', label: 'Gallon (gal)' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'spool', label: 'Spool' },
  { value: 'tube', label: 'Tube' },
]

const pricingSchema = z.object({
  vendorId: z.string().min(1, 'Vendor is required'),
  type: z.string().min(1, 'Type is required'),
  originalPackagingQty: z.coerce.number().int().min(1),
  pcsPerPack: z.coerce.number().int().min(1),
  originalPackagingUom: z.string().min(1, 'Required'),
  unitCost: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  currency: z.string().min(1),
  minOrderQty: z.coerce.number().int().min(1),
  leadTimeDays: z.coerce.number().int().min(0).optional().or(z.literal('')),
  effectiveDate: z.string().min(1, 'Required'),
  expiryDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

type PricingFormData = z.infer<typeof pricingSchema>

function PricingTab({ product }: Readonly<{ product: any }>) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  const { data: vendorsRes } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: async () => (await api.get<{ data: DropdownItem[] }>('/vendors?limit=1000')).data,
  })
  const vendorOptions = (Array.isArray(vendorsRes?.data) ? vendorsRes.data : []).map((v: any) => ({ value: v.id, label: v.name }))

  const { data: currenciesRes } = useQuery({
    queryKey: ['currencies-active'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; code: string; symbol: string | null; isDefault: boolean }[] }>('/currencies/active')).data,
  })
  const currencies: any[] = Array.isArray(currenciesRes?.data) ? currenciesRes.data : []
  const currencyOptions = currencies.map((c: any) => {
    const symbolPart = c.symbol ? ` (${c.symbol})` : ''
    return { value: c.code, label: `${c.code} - ${c.name}${symbolPart}` }
  })
  const defaultCurrency = currencies.find((c: any) => c.isDefault)?.code || 'USD'

  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<PricingFormData>({
    resolver: zodResolver(pricingSchema),
    mode: 'onChange',
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post(`/products/${product.id}/pricings`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['product'] }); closeModal(); toast({ title: 'Pricing added' }) },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to add pricing.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/products/${product.id}/pricings/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['product'] }); closeModal(); toast({ title: 'Pricing updated' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to update pricing.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${product.id}/pricings/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['product'] }); setDeleteTarget(null); toast({ title: 'Pricing deleted' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to delete pricing.', variant: 'destructive' }),
  })

  const applyMutation = useMutation({
    mutationFn: (pricingId: string) => api.post(`/products/${product.id}/pricings/${pricingId}/apply`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['product'] }); toast({ title: 'Price applied', description: 'This is now the official product price.' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to apply pricing.', variant: 'destructive' }),
  })

  const usedVendorIds = new Set((product.pricings || []).map((p: any) => p.vendor?.id || p.vendorId))

  function openAdd() {
    reset({ vendorId: '', type: 'local', originalPackagingQty: 1, pcsPerPack: 1, originalPackagingUom: 'pcs', unitCost: 0, sellingPrice: 0, currency: defaultCurrency, minOrderQty: 1, leadTimeDays: '', effectiveDate: new Date().toISOString().split('T')[0], expiryDate: '', notes: '' })
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(p: any) {
    reset({
      vendorId: p.vendor?.id || p.vendorId,
      type: p.type || 'local',
      originalPackagingQty: p.originalPackagingQty || 1,
      pcsPerPack: p.pcsPerPack || 1,
      originalPackagingUom: p.originalPackagingUom || 'pcs',
      unitCost: p.unitCost,
      sellingPrice: p.sellingPrice,
      currency: p.currency,
      minOrderQty: p.minOrderQty,
      leadTimeDays: p.leadTimeDays ?? '',
      effectiveDate: p.effectiveDate ? new Date(p.effectiveDate).toISOString().split('T')[0] : '',
      expiryDate: p.expiryDate ? new Date(p.expiryDate).toISOString().split('T')[0] : '',
      notes: p.notes || '',
    })
    setEditing(p)
    setModalOpen(true)
  }

  function closeModal() { setModalOpen(false); setEditing(null) }

  function onSubmit(data: PricingFormData) {
    const payload = { ...data, leadTimeDays: data.leadTimeDays === '' ? null : data.leadTimeDays, expiryDate: data.expiryDate || null, notes: data.notes || null, type: data.type }
    if (editing) updateMutation.mutate({ id: editing.id, data: payload })
    else addMutation.mutate(payload)
  }

  const availableVendorOptions = editing
    ? vendorOptions
    : vendorOptions.filter((v) => !usedVendorIds.has(v.value))

  const pricings = product.pricings || []
  const isSubmitting = addMutation.isPending || updateMutation.isPending
  const appliedPricing = pricings.find((p: any) => p.id === product.appliedPricingId)

  function formatCurrency(val: number, currencyCode: string) {
    const curr = currencies.find((c) => c.code === currencyCode)
    if (curr?.symbol) {
      const formatted = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return `${curr.symbol}${formatted}`
    }
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(val)
    } catch {
      return `${currencyCode} ${val.toFixed(2)}`
    }
  }

  let pricingStatusCard: JSX.Element | null = null;
  if (appliedPricing) {
    pricingStatusCard = (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">Official Price Applied</h3>
                <Badge variant="outline" className="text-[10px] capitalize border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">{appliedPricing.type || 'local'}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-[10px] text-green-600/70 dark:text-green-400/70 uppercase tracking-wider">Vendor</p>
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">{appliedPricing.vendor?.name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-green-600/70 dark:text-green-400/70 uppercase tracking-wider">Unit Cost</p>
                  <p className="text-sm font-bold font-mono text-green-900 dark:text-green-200">{formatCurrency(appliedPricing.unitCost, appliedPricing.currency)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-green-600/70 dark:text-green-400/70 uppercase tracking-wider">Selling Price</p>
                  <p className="text-sm font-bold font-mono text-green-900 dark:text-green-200">{formatCurrency(appliedPricing.sellingPrice, appliedPricing.currency)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-green-600/70 dark:text-green-400/70 uppercase tracking-wider">Min Order Qty</p>
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">{appliedPricing.minOrderQty}</p>
                </div>
                <div>
                  <p className="text-[10px] text-green-600/70 dark:text-green-400/70 uppercase tracking-wider">Lead Time</p>
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">{appliedPricing.leadTimeDays ? `${appliedPricing.leadTimeDays} days` : '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  } else if (pricings.length > 0) {
    pricingStatusCard = (
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="p-4 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-amber-500" />
          <p className="text-sm text-amber-700 dark:text-amber-300">No price applied yet. Click <strong>"Apply"</strong> on a pricing entry to set the official product price.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pricingStatusCard}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{pricings.length} pricing entr{pricings.length === 1 ? 'y' : 'ies'}</p>
        <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Pricing
        </Button>
      </div>

      {pricings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <DollarSign className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">No pricing set. Add vendor pricing for this product.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Vendor</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Packaging</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Unit Cost</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Selling Price</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Min Order</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Lead Time</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Effective</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="w-[120px] px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pricings.map((p: any) => (
                  <tr key={p.id} className={cn('hover:bg-accent/30 transition-colors', p.id === product.appliedPricingId && 'bg-green-50/50 dark:bg-green-950/10')}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {p.id === product.appliedPricingId && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                        <span className="font-medium">{p.vendor?.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant="outline" className="text-[10px] capitalize">{p.type || 'local'}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                      {p.originalPackagingQty || 1} × {p.pcsPerPack || 1} {(p.originalPackagingUom || 'pcs').toUpperCase()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(p.unitCost, p.currency)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(p.sellingPrice, p.currency)}</td>
                    <td className="px-4 py-2.5 text-center">{p.minOrderQty}</td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{p.leadTimeDays ? `${p.leadTimeDays}d` : '-'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(p.effectiveDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={p.isActive ? 'default' : 'secondary'} className="text-[10px]">{p.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-0.5 justify-end">
                        {p.id === product.appliedPricingId ? (
                          <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 px-2">Applied</span>
                        ) : (
                          <button
                            onClick={() => applyMutation.mutate(p.id)}
                            disabled={applyMutation.isPending}
                            className="px-2 py-1 rounded text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                          >
                            Apply
                          </button>
                        )}
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{editing ? 'Edit Pricing' : 'Add Pricing'}</DialogTitle>
          <DialogDescription>Set vendor-specific pricing for this product.</DialogDescription>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-[2fr_1fr] gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Vendor <span className="text-red-500">*</span></Label>
                <Controller control={control} name="vendorId" render={({ field }) => (
                  <SearchableSelect options={availableVendorOptions} value={field.value || ''} onChange={(val) => field.onChange(val)} placeholder="Select vendor" />
                )} />
                {errors.vendorId && <p className="text-xs text-red-500">{errors.vendorId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Type <span className="text-red-500">*</span></Label>
                <Controller control={control} name="type" render={({ field }) => (
                  <SearchableSelect options={PRICING_TYPE_OPTIONS} value={field.value || ''} onChange={(val) => field.onChange(val)} placeholder="Select type" />
                )} />
                {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">OP Qty <span className="text-red-500">*</span></Label>
                <Input type="number" min="1" step="1" {...register('originalPackagingQty')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Pcs/Pack <span className="text-red-500">*</span></Label>
                <Input type="number" min="1" step="1" {...register('pcsPerPack')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">UOM <span className="text-red-500">*</span></Label>
                <Controller control={control} name="originalPackagingUom" render={({ field }) => (
                  <SearchableSelect options={UOM_OPTIONS} value={field.value || ''} onChange={(val) => field.onChange(val)} placeholder="Select UOM" />
                )} />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_1fr_2fr] gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Unit Cost <span className="text-red-500">*</span></Label>
                <Input type="number" step="0.01" {...register('unitCost')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Selling Price <span className="text-red-500">*</span></Label>
                <Input type="number" step="0.01" {...register('sellingPrice')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Currency</Label>
                <Controller control={control} name="currency" render={({ field }) => (
                  <SearchableSelect options={currencyOptions} value={field.value || ''} onChange={(val) => field.onChange(val)} placeholder="Select currency" />
                )} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Min Order Qty</Label>
                <Input type="number" {...register('minOrderQty')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Lead Time (days)</Label>
                <Input type="number" {...register('leadTimeDays')} placeholder="Optional" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Effective Date <span className="text-red-500">*</span></Label>
                <Input type="date" {...register('effectiveDate')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Expiry Date</Label>
                <Input type="date" {...register('expiryDate')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Notes</Label>
              <Textarea {...register('notes')} rows={2} placeholder="e.g., Includes shipping, bulk discount applied, special terms..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={!isValid || isSubmitting} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Save' : 'Add Pricing'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground border-t pt-3 mt-1">
              Only one pricing per vendor is allowed. After adding, click <strong>"Apply"</strong> on the pricing table to set it as the official product price.
            </p>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Delete Pricing" description={`Remove pricing from "${deleteTarget?.vendor?.name}"?`} confirmLabel="Delete" variant="destructive" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} isLoading={deleteMutation.isPending} />
    </div>
  )
}

// ============================================================
// Product Detail Page
// ============================================================

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => (await api.get(`/products/${id}`)).data,
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Package className="h-12 w-12 mb-3 opacity-30" />
        <p>Product not found.</p>
        <Button variant="ghost" className="mt-3" onClick={() => router.push('/products')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Items
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Back button */}
      <button onClick={() => router.push('/products')} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Items
      </button>

      <HeroBanner product={product} />

      <Tabs defaultValue="profile" className="w-full mt-4">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger value="profile" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            Profile
          </TabsTrigger>
          <TabsTrigger value="stock" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm">
            Stock
          </TabsTrigger>
          <TabsTrigger value="pricing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm gap-1.5">
            Pricing {(product.pricings?.length || 0) > 0 && <span className="text-[10px] font-semibold bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{product.pricings.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="media" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm gap-1.5">
            Media {(product.images?.length || 0) > 0 && <span className="text-[10px] font-semibold bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{product.images.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm gap-1.5">
            Documents {(product.documents?.length || 0) > 0 && <span className="text-[10px] font-semibold bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{product.documents.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="purchase-requests" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm gap-1.5">
            Purchase Requests {(product.purchaseRequestItems?.length || 0) > 0 && <span className="text-[10px] font-semibold bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{product.purchaseRequestItems.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="purchase-orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm gap-1.5">
            Purchase Orders {(product.purchaseOrderItems?.length || 0) > 0 && <span className="text-[10px] font-semibold bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{product.purchaseOrderItems.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-5"><ProfileTab product={product} /></TabsContent>
        <TabsContent value="stock" className="mt-5"><StockTab product={product} /></TabsContent>
        <TabsContent value="pricing" className="mt-5"><PricingTab product={product} /></TabsContent>
        <TabsContent value="media" className="mt-5"><MediaTab product={product} /></TabsContent>
        <TabsContent value="documents" className="mt-5"><DocumentsTab product={product} /></TabsContent>
        <TabsContent value="purchase-requests" className="mt-5"><PurchaseRequestsTab product={product} /></TabsContent>
        <TabsContent value="purchase-orders" className="mt-5"><PurchaseOrdersTab product={product} /></TabsContent>
      </Tabs>
    </div>
  )
}
