'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { QRCodeSVG } from 'qrcode.react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLabelCodeType } from '@/lib/label-settings'

interface ItemCodesProps {
  code: string // value encoded in the QR/barcode — the item's primary key
  name?: string
  sub?: string // shown under the code (e.g., SKU)
}

/**
 * Renders a scannable code for an item — either a QR or a 1D Code-128 barcode,
 * per the tenant's Settings preference. The code encodes the item's primary key.
 */
export function ItemCodes({ code, name, sub }: Readonly<ItemCodesProps>) {
  const type = useLabelCodeType()
  const qrWrapRef = useRef<HTMLDivElement>(null)
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (type !== 'BARCODE' || !barcodeRef.current || !code) return
    try {
      JsBarcode(barcodeRef.current, code, { format: 'CODE128', displayValue: true, fontSize: 12, height: 50, margin: 8 })
    } catch {
      /* not encodable — skip */
    }
  }, [type, code])

  function handlePrint() {
    const svg =
      type === 'QR'
        ? qrWrapRef.current?.querySelector('svg')?.outerHTML || ''
        : barcodeRef.current?.outerHTML || ''
    const win = window.open('', '_blank', 'width=420,height=560')
    if (!win) return
    win.document.write(
      `<!doctype html><html><head><title>${name || sub || 'label'} — label</title>` +
      `<style>body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px;margin:0}` +
      `.name{font-weight:600;font-size:15px;margin-bottom:4px}.sku{font-family:monospace;color:#555;margin:6px 0 14px}svg{max-width:100%}</style></head>` +
      `<body onload="window.focus();window.print();">` +
      `<div class="name">${name || ''}</div><div class="sku">${sub || ''}</div>${svg}</body></html>`,
    )
    win.document.close()
  }

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
            <QRCodeSVG value={code} size={120} level="M" />
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-2">
            <svg ref={barcodeRef} />
          </div>
        )}
        <div className="text-sm">
          {sub && <p className="font-mono">{sub}</p>}
          <p className="text-xs text-muted-foreground mt-1">Encodes the SKU</p>
        </div>
      </div>
    </div>
  )
}
