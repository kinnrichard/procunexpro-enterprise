'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { QRCodeSVG } from 'qrcode.react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLabelCodeType } from '@/lib/label-settings'

interface ItemCodesProps {
  sku: string
  name?: string
  path?: string // relative item path; when set, the QR encodes the full URL so a phone opens the item
}

/**
 * Scannable code for an item, per the tenant's Settings preference:
 *  - QR   → encodes the item's URL (a phone opens the item page)
 *  - Barcode → encodes the SKU (short, for handheld scanners)
 */
export function ItemCodes({ sku, name, path }: Readonly<ItemCodesProps>) {
  const type = useLabelCodeType()
  const barcodeRef = useRef<SVGSVGElement>(null)
  const qrWrapRef = useRef<HTMLDivElement>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const qrValue = path ? `${origin}${path}` : sku
  const barcodeValue = sku

  useEffect(() => {
    if (type !== 'BARCODE' || !barcodeRef.current || !barcodeValue) return
    try {
      JsBarcode(barcodeRef.current, barcodeValue, { format: 'CODE128', displayValue: true, fontSize: 12, height: 50, margin: 8 })
    } catch {
      /* not encodable — skip */
    }
  }, [type, barcodeValue])

  function handlePrint() {
    const svg =
      type === 'QR'
        ? qrWrapRef.current?.querySelector('svg')?.outerHTML || ''
        : barcodeRef.current?.outerHTML || ''
    const win = window.open('', '_blank', 'width=420,height=560')
    if (!win) return
    win.document.write(
      `<!doctype html><html><head><title>${name || sku} — label</title>` +
      `<style>body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px;margin:0}` +
      `.name{font-weight:600;font-size:15px;margin-bottom:4px}.sku{font-family:monospace;color:#555;margin:6px 0 14px}svg{max-width:100%}</style></head>` +
      `<body onload="window.focus();window.print();">` +
      `<div class="name">${name || ''}</div><div class="sku">${sku}</div>${svg}</body></html>`,
    )
    win.document.close()
  }

  const caption = type === 'QR' ? (path ? 'Opens the item page' : `Encodes ${sku}`) : 'Encodes the SKU'

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">{type === 'QR' ? 'QR Code' : 'Barcode'}</h3>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1.5" /> Print label
        </Button>
      </div>
      <div className="flex items-center gap-6 flex-wrap">
        {type === 'QR' ? (
          <div ref={qrWrapRef} className="rounded-lg border bg-white p-2">
            <QRCodeSVG value={qrValue} size={120} level="M" />
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-2">
            <svg ref={barcodeRef} />
          </div>
        )}
        <div className="text-sm">
          <p className="font-mono">{sku}</p>
          <p className="text-xs text-muted-foreground mt-1">{caption}</p>
        </div>
      </div>
    </div>
  )
}
