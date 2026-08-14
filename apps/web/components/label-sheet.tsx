'use client'

import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'

export interface LabelItem {
  id: string
  name: string
  code: string // encoded in the QR + barcode (SKU or lot number)
  sub?: string // small mono line under the name
  lines?: string[] // extra info lines (location, expiry, qty…)
}

function LabelCard({ item }: { item: LabelItem }) {
  const bcRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!bcRef.current || !item.code) return
    try {
      JsBarcode(bcRef.current, item.code, { format: 'CODE128', displayValue: true, fontSize: 11, height: 34, margin: 4 })
    } catch {
      /* not encodable — skip barcode */
    }
  }, [item.code])

  return (
    <div className="label-card">
      <div className="label-name">{item.name}</div>
      {item.sub && <div className="label-sub">{item.sub}</div>}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
        <QRCodeSVG value={item.code} size={84} level="M" />
      </div>
      <svg ref={bcRef} />
      {item.lines?.map((l) => (
        <div key={l} className="label-sub">{l}</div>
      ))}
    </div>
  )
}

/**
 * Renders a print-only sheet of item/lot labels (portaled to <body> as
 * #print-root) and fires window.print() once the codes have rendered.
 * Pass an empty array to unmount; call onDone to reset after printing.
 */
export function LabelSheet({ items, onDone }: Readonly<{ items: LabelItem[]; onDone: () => void }>) {
  const [mounted, setMounted] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const startedRef = useRef(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted || items.length === 0) {
      startedRef.current = false
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    const t = setTimeout(() => {
      // Scope the print-isolation CSS to this run so normal Ctrl+P is unaffected
      document.body.classList.add('printing-labels')
      window.print()
      document.body.classList.remove('printing-labels')
      onDoneRef.current()
    }, 350)
    return () => {
      clearTimeout(t)
      document.body.classList.remove('printing-labels')
    }
  }, [mounted, items])

  if (!mounted || items.length === 0) return null

  return createPortal(
    <div id="print-root">
      <div className="label-grid">
        {items.map((it) => (
          <LabelCard key={it.id} item={it} />
        ))}
      </div>
    </div>,
    document.body,
  )
}
