'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Pencil, Trash2, CheckCircle, Ban, Loader2,
  Package, ShoppingCart, FileText, Wallet,
  Mail, Phone, Globe, MapPin, Building2, CreditCard, Landmark, StickyNote,
} from 'lucide-react'
import api from '@/lib/api'
import { StatusBadge } from '@/components/status-badge'
import { StatCard } from '@/components/stat-card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { VendorFormDialog } from '@/components/vendor-form-dialog'
import { CommentsPanel } from '@/components/comments-panel'
import { ActivityPanel } from '@/components/activity-panel'
import { DocumentsPanel } from '@/components/documents-panel'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { usePermissions } from '@/lib/permissions'

type VendorDetail = {
  id: string
  name: string
  code: string
  status: string
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
  createdAt: string
  totalSpend: number
  _count: { products: number; purchaseOrders: number; rfqs: number; contracts: number }
  purchaseOrders: { id: string; orderNumber: string; status: string; totalAmount: number; createdAt: string }[]
  products: { id: string; name: string; sku: string; inventoryType: string }[]
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function Field({ icon, label, children }: Readonly<{ icon?: React.ReactNode; label: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      {icon && <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-sm text-foreground mt-0.5 break-words">{children}</div>
      </div>
    </div>
  )
}

const dash = <span className="text-muted-foreground">—</span>

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { can } = usePermissions()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)

  const { data: vendor, isLoading, isError } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => (await api.get<VendorDetail>(`/vendors/${id}`)).data,
    enabled: !!id,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['vendor', id] })
    queryClient.invalidateQueries({ queryKey: ['vendors'] })
  }

  const approveMutation = useMutation({
    mutationFn: () => api.put(`/vendors/${id}/approve`),
    onSuccess: () => { invalidate(); setApproveOpen(false); toast({ title: 'Vendor approved' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to approve vendor.', variant: 'destructive' }),
  })

  const suspendMutation = useMutation({
    mutationFn: () => api.put(`/vendors/${id}/suspend`),
    onSuccess: () => { invalidate(); setSuspendOpen(false); toast({ title: 'Vendor suspended' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to suspend vendor.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast({ title: 'Vendor deleted' })
      router.push('/vendors')
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete vendor.', variant: 'destructive' }),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading vendor…
      </div>
    )
  }

  if (isError || !vendor) {
    return (
      <div className="space-y-4">
        <Link href="/vendors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Vendors
        </Link>
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">Vendor not found.</div>
      </div>
    )
  }

  const canEdit = can('vendors', 'edit')
  const canDelete = can('vendors', 'delete')
  const cityLine = [vendor.city, vendor.province, vendor.country].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/vendors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Vendors
      </Link>

      {/* Header */}
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-[#1e3a5f] text-white text-lg font-bold">
            {getInitials(vendor.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground truncate">{vendor.name}</h1>
              <StatusBadge status={vendor.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono">{vendor.code}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && vendor.status !== 'APPROVED' && (
              <Button variant="outline" size="sm" onClick={() => setApproveOpen(true)}>
                <CheckCircle className="h-4 w-4 mr-1.5 text-emerald-600" /> Approve
              </Button>
            )}
            {canEdit && vendor.status === 'APPROVED' && (
              <Button variant="outline" size="sm" onClick={() => setSuspendOpen(true)}>
                <Ban className="h-4 w-4 mr-1.5 text-amber-600" /> Suspend
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setEditOpen(true)} className="bg-gradient-primary text-white">
                <Pencil className="h-4 w-4 mr-1.5" /> Edit
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Spend" value={formatCurrency(vendor.totalSpend)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Purchase Orders" value={vendor._count.purchaseOrders} icon={<ShoppingCart className="h-5 w-5" />} />
        <StatCard title="Products" value={vendor._count.products} icon={<Package className="h-5 w-5" />} />
        <StatCard title="RFQs" value={vendor._count.rfqs} icon={<FileText className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: info + related */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact + Address */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="text-base font-semibold mb-1">Contact & Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0">
              <Field icon={<Building2 className="h-4 w-4" />} label="Contact Person">{vendor.contactPerson || dash}</Field>
              <Field icon={<Phone className="h-4 w-4" />} label="Phone">{vendor.phone || dash}</Field>
              <Field icon={<Mail className="h-4 w-4" />} label="Email">
                {vendor.email ? <a href={`mailto:${vendor.email}`} className="text-primary hover:underline">{vendor.email}</a> : dash}
              </Field>
              <Field icon={<Globe className="h-4 w-4" />} label="Website">
                {vendor.website ? <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{vendor.website}</a> : dash}
              </Field>
              <Field icon={<MapPin className="h-4 w-4" />} label="Address">{vendor.address || dash}</Field>
              <Field icon={<MapPin className="h-4 w-4" />} label="City / Province / Country">{cityLine || dash}</Field>
            </div>
          </div>

          {/* Business + Banking */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="text-base font-semibold mb-1">Business & Banking</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <Field icon={<CreditCard className="h-4 w-4" />} label="Payment Terms">{vendor.paymentTerms || dash}</Field>
              <Field icon={<FileText className="h-4 w-4" />} label="Tax ID">{vendor.taxId || dash}</Field>
              <Field icon={<Landmark className="h-4 w-4" />} label="Bank Name">{vendor.bankName || dash}</Field>
              <Field icon={<Landmark className="h-4 w-4" />} label="Bank Account">{vendor.bankAccount || dash}</Field>
              <Field icon={<Landmark className="h-4 w-4" />} label="Bank Routing">{vendor.bankRouting || dash}</Field>
            </div>
          </div>

          {/* Notes */}
          {vendor.notes && (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="text-base font-semibold mb-2 flex items-center gap-2"><StickyNote className="h-4 w-4" /> Notes</h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">{vendor.notes}</p>
            </div>
          )}

          {/* Recent Purchase Orders */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Recent Purchase Orders</h2>
              {vendor._count.purchaseOrders > 0 && (
                <Link href={`/purchase-orders?vendor=${vendor.id}`} className="text-xs text-primary hover:underline">View all</Link>
              )}
            </div>
            {vendor.purchaseOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No purchase orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                      <th className="py-2 pr-3 font-medium">Order #</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendor.purchaseOrders.map((po) => (
                      <tr
                        key={po.id}
                        onClick={() => router.push(`/purchase-orders/${po.id}`)}
                        className="border-b last:border-0 hover:bg-accent/40 cursor-pointer"
                      >
                        <td className="py-2.5 pr-3 font-mono font-medium text-primary">{po.orderNumber}</td>
                        <td className="py-2.5 pr-3"><StatusBadge status={po.status} /></td>
                        <td className="py-2.5 pr-3 text-muted-foreground">{formatDate(po.createdAt)}</td>
                        <td className="py-2.5 text-right font-mono">{formatCurrency(po.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Products supplied */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Items Supplied</h2>
              {vendor._count.products > 0 && (
                <Link href={`/products?vendor=${vendor.id}`} className="text-xs text-primary hover:underline">View all</Link>
              )}
            </div>
            {vendor.products.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No items linked to this vendor.</p>
            ) : (
              <div className="flex flex-col divide-y">
                {vendor.products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => router.push(`/products/${p.id}`)}
                    className="flex items-center justify-between py-2.5 text-left hover:bg-accent/40 -mx-2 px-2 rounded-md"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">
                      {p.inventoryType?.replace(/_/g, ' ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: comments / activity / files */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border bg-card p-5 lg:sticky lg:top-4">
            <Tabs defaultValue="comments">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>
              <TabsContent value="comments" className="mt-4">
                <div className="h-[520px]"><CommentsPanel entityType="VENDOR" entityId={vendor.id} /></div>
              </TabsContent>
              <TabsContent value="activity" className="mt-4">
                <div className="h-[520px]"><ActivityPanel entityType="VENDOR" entityId={vendor.id} /></div>
              </TabsContent>
              <TabsContent value="files" className="mt-4">
                <DocumentsPanel entityType="VENDOR" entityId={vendor.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      <VendorFormDialog open={editOpen} onOpenChange={setEditOpen} vendor={vendor} onSaved={invalidate} />

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={(o) => !o && setApproveOpen(false)}
        title="Approve Vendor"
        description={`Approve "${vendor.name}"? They will be marked as an approved supplier.`}
        confirmLabel="Approve"
        onConfirm={() => approveMutation.mutate()}
        isLoading={approveMutation.isPending}
      />
      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={(o) => !o && setSuspendOpen(false)}
        title="Suspend Vendor"
        description={`Suspend "${vendor.name}"? They will be blocked from new transactions.`}
        confirmLabel="Suspend"
        variant="destructive"
        onConfirm={() => suspendMutation.mutate()}
        isLoading={suspendMutation.isPending}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
        title="Delete Vendor"
        description={`Are you sure you want to delete "${vendor.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
