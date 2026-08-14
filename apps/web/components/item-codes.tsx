'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { QRCodeSVG } from 'qrcode.react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ItemCodesProps {
  sku: string
  barcode?: string | null
  name?: string
}

/**
 * Scannable codes for an item: a QR of the SKU + a 1D Code-128 barcode of the
 * item's barcode (falls back to the SKU). Includes a "Print label" action.
 */
export function ItemCodes({ sku, barcode, name }: Readonly<ItemCodesProps>) {
  const qrWrapRef = useRef<HTMLDivElement>(null)
  const barcodeRef = useRef<SVGSVGElement>(null)
  const codeValue = (barcode && barcode.trim()) || sku

  useEffect(() => {
    if (!barcodeRef.current || !codeValue) return
    try {
      JsBarcode(barcodeRef.current, codeValue, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 13,
        height: 50,
        margin: 8,
      })
    } catch {
      /* value not encodable — leave the barcode empty */
    }
  }, [codeValue])

  function handlePrint() {
    const qr = qrWrapRef.current?.querySelector('svg')?.outerHTML || ''
    const bc = barcodeRef.current?.outerHTML || ''
    const win = window.open('', '_blank', 'width=420,height=600')
    if (!win) return
    win.document.write(
      `<!doctype html><html><head><title>${name || sku} — label</title>` +
      `<style>body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px;margin:0}` +
      `.name{font-weight:600;font-size:15px;margin-bottom:4px}.sku{font-family:monospace;color:#555;margin:6px 0 14px}` +
      `svg{max-width:100%}</style></head>` +
      `<body onload="window.focus();window.print();">` +
      `<div class="name">${name || ''}</div><div class="sku">${sku}</div>` +
      `${qr}<div style="height:14px"></div>${bc}</body></html>`,
    )
    win.document.close()
  }

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Barcode &amp; QR</h3>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1.5" /> Print label
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div ref={qrWrapRef} className="rounded-lg border bg-white p-2">
            <QRCodeSVG value={sku} size={120} level="M" />
          </div>
          <span className="text-xs text-muted-foreground">QR · SKU</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-lg border bg-white p-2">
            <svg ref={barcodeRef} />
          </div>
          <span className="text-xs text-muted-foreground">{barcode ? 'Barcode' : 'Code 128 · SKU'}</span>
        </div>
      </div>
    </div>
  )
}
