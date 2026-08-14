'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'

const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004/api',
})

interface PublicItem {
  id: string
  name: string
  sku: string
  barcode: string | null
  inventoryType: string
  unit: string
  currentStock: number
  isActive: boolean
  category: string | null
  subCategory: string | null
  manufacturer: string | null
  origin: string | null
}

function Row({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || '—'}</span>
    </div>
  )
}

export default function ScanItemPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [item, setItem] = useState<PublicItem | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound'>('loading')

  useEffect(() => {
    if (!id) return
    publicApi
      .get(`/public/items/${id}`)
      .then((res) => { setItem(res.data); setStatus('ok') })
      .catch(() => setStatus('notfound'))
  }, [id])

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center px-4 py-10">
      <img src="/logo-primary.png" alt="Procunex" className="h-8 mb-6" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />

      <div className="w-full max-w-md rounded-2xl border bg-card shadow-sm p-6">
        {status === 'loading' && <p className="text-center text-sm text-muted-foreground py-10">Loading item…</p>}

        {status === 'notfound' && (
          <div className="text-center py-10">
            <p className="text-base font-semibold">Item not found</p>
            <p className="text-sm text-muted-foreground mt-1">This code doesn&apos;t match a known item.</p>
          </div>
        )}

        {status === 'ok' && item && (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold leading-tight">{item.name}</h1>
                <p className="text-sm font-mono text-muted-foreground mt-0.5">{item.sku}</p>
              </div>
              <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                {item.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="rounded-xl border bg-background px-4">
              <Row label="On hand" value={<span className="font-mono">{item.currentStock} {item.unit}</span>} />
              <Row label="Type" value={<span className="capitalize">{item.inventoryType?.replace(/_/g, ' ')}</span>} />
              <Row label="Category" value={[item.category, item.subCategory].filter(Boolean).join(' · ')} />
              <Row label="Manufacturer" value={item.manufacturer} />
              <Row label="Origin" value={item.origin} />
              <Row label="Barcode" value={item.barcode ? <span className="font-mono">{item.barcode}</span> : '—'} />
            </div>

            <a
              href={`/products/${item.sku}`}
              className="mt-5 flex items-center justify-center rounded-lg bg-gradient-primary text-white text-sm font-medium py-2.5 hover:opacity-90"
            >
              Open full details
            </a>
            <p className="text-[11px] text-muted-foreground text-center mt-2">Staff sign-in required for full details.</p>
          </>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mt-6">© Procunex</p>
    </div>
  )
}
