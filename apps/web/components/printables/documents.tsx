'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import { DocumentLayout, type DocColumn } from './document-layout';

const d = (v?: string | null) => (v ? formatDate(v) : '—');
const money = (v?: number | null) => formatCurrency(v ?? 0);

function ItemCell({ name, sku, description }: Readonly<{ name?: string; sku?: string; description?: string }>) {
  return (
    <div>
      <div className="item-name">{name || description || '—'}</div>
      {sku && <div className="items-desc">{sku}</div>}
      {name && description && description !== name && <div className="items-desc">{description}</div>}
    </div>
  );
}

// ── Purchase Order ───────────────────────────────────────────────────
export function PODocument({ po }: Readonly<{ po: any }>) {
  const columns: DocColumn[] = [
    { header: '#', align: 'center', width: '4%', render: (_r, i) => i + 1 },
    { header: 'Item', render: (r) => <ItemCell name={r.product?.name} sku={r.product?.sku} description={r.description} /> },
    { header: 'UOM', align: 'center', width: '8%', render: (r) => r.uom },
    { header: 'Qty', align: 'right', width: '9%', render: (r) => <span className="mono">{r.quantity}</span> },
    { header: 'Unit Price', align: 'right', width: '13%', render: (r) => <span className="mono">{money(r.unitPrice)}</span> },
    { header: 'Disc %', align: 'right', width: '9%', render: (r) => <span className="mono">{r.discount || 0}</span> },
    { header: 'Amount', align: 'right', width: '14%', render: (r) => <span className="mono">{money(r.totalPrice)}</span> },
  ];
  const totals = [
    { label: 'Subtotal', value: money(po.subtotal) },
    ...(po.taxAmount ? [{ label: 'Tax', value: money(po.taxAmount) }] : []),
    ...(po.shippingCost ? [{ label: 'Shipping', value: money(po.shippingCost) }] : []),
    { label: 'Total', value: money(po.totalAmount), strong: true },
  ];
  return (
    <DocumentLayout
      title="Purchase Order"
      number={po.orderNumber}
      status={po.status?.replaceAll('_', ' ')}
      parties={[
        { title: 'Vendor', lines: [po.vendor?.name, po.vendor?.address, po.vendor?.phone, po.vendor?.email] },
        { title: 'Ship To', lines: [po.shippingAddress] },
      ]}
      meta={[
        { label: 'Order Date', value: d(po.orderDate) },
        { label: 'Expected', value: d(po.expectedDate) },
        ...(po.paymentTerms ? [{ label: 'Payment Terms', value: po.paymentTerms }] : []),
        ...(po.purchaseRequest?.requestNumber ? [{ label: 'PR Ref', value: po.purchaseRequest.requestNumber }] : []),
      ]}
      columns={columns}
      rows={po.items ?? []}
      totals={totals}
      notes={po.notes}
      signatures={[
        { label: 'Prepared By', name: po.createdBy ? `${po.createdBy.firstName} ${po.createdBy.lastName}` : undefined },
        { label: 'Approved By', name: po.approvedBy },
        { label: 'Received By' },
      ]}
    />
  );
}

// ── Purchase Request ─────────────────────────────────────────────────
export function PRDocument({ pr }: Readonly<{ pr: any }>) {
  const columns: DocColumn[] = [
    { header: '#', align: 'center', width: '4%', render: (_r, i) => i + 1 },
    { header: 'Description', render: (r) => <ItemCell name={r.product?.name} description={r.description} /> },
    { header: 'UOM', align: 'center', width: '8%', render: (r) => r.uom },
    { header: 'Qty', align: 'right', width: '10%', render: (r) => <span className="mono">{r.quantity}</span> },
    { header: 'Est. Price', align: 'right', width: '14%', render: (r) => <span className="mono">{money(r.estimatedPrice)}</span> },
    { header: 'Amount', align: 'right', width: '15%', render: (r) => <span className="mono">{money(r.totalPrice)}</span> },
  ];
  return (
    <DocumentLayout
      title="Purchase Request"
      number={pr.requestNumber}
      status={pr.status?.replaceAll('_', ' ')}
      parties={[
        { title: 'Requested By', lines: [pr.requestedBy ? `${pr.requestedBy.firstName} ${pr.requestedBy.lastName}` : undefined, pr.department?.name] },
        ...(pr.company?.name ? [{ title: 'Company', lines: [pr.company.name] }] : []),
      ]}
      meta={[
        { label: 'Date', value: d(pr.createdAt) },
        { label: 'Required', value: d(pr.requiredDate) },
        ...(pr.priority ? [{ label: 'Priority', value: pr.priority }] : []),
      ]}
      columns={columns}
      rows={pr.items ?? []}
      totals={[{ label: 'Total', value: money(pr.totalAmount), strong: true }]}
      notes={pr.description ? `Purpose of Request: ${pr.description}${pr.notes ? `\n\n${pr.notes}` : ''}` : pr.notes}
      signatures={[
        { label: 'Prepared By', name: pr.requestedBy ? `${pr.requestedBy.firstName} ${pr.requestedBy.lastName}` : undefined },
        { label: 'Reviewed By' },
        { label: 'Approved By' },
      ]}
    />
  );
}

// ── Request for Quotation ────────────────────────────────────────────
export function RFQDocument({ rfq }: Readonly<{ rfq: any }>) {
  const columns: DocColumn[] = [
    { header: '#', align: 'center', width: '5%', render: (_r, i) => i + 1 },
    { header: 'Description', render: (r) => <div className="item-name">{r.description}</div> },
    { header: 'Unit', align: 'center', width: '10%', render: (r) => r.unit },
    { header: 'Qty', align: 'right', width: '12%', render: (r) => <span className="mono">{r.quantity}</span> },
    { header: 'Unit Price', align: 'right', width: '20%', render: () => <span style={{ color: '#D1D5DB' }}>__________</span> },
  ];
  return (
    <DocumentLayout
      title="Request for Quotation"
      number={rfq.rfqNumber}
      status={rfq.status}
      parties={[{ title: 'To (Vendor)', lines: [rfq.vendor?.name, rfq.vendor?.address, rfq.vendor?.email] }]}
      meta={[
        { label: 'Date', value: d(rfq.createdAt) },
        ...(rfq.deadline ? [{ label: 'Response Deadline', value: d(rfq.deadline) }] : []),
      ]}
      columns={columns}
      rows={rfq.items ?? []}
      notes={rfq.description || rfq.notes}
      signatures={[{ label: 'Prepared By' }, { label: 'Vendor Signature' }]}
      extraFooter={<p className="rfq-note">Please provide your best pricing, lead time and validity for the items listed above.</p>}
    />
  );
}

// ── Delivery Receipt ─────────────────────────────────────────────────
export function DRDocument({ dr }: Readonly<{ dr: any }>) {
  const columns: DocColumn[] = [
    { header: '#', align: 'center', width: '5%', render: (_r, i) => i + 1 },
    { header: 'Item', render: (r) => <ItemCell name={r.product?.name} sku={r.product?.sku} /> },
    { header: 'UOM', align: 'center', width: '12%', render: (r) => r.uom },
    { header: 'Quantity', align: 'right', width: '16%', render: (r) => <span className="mono">{r.quantity}</span> },
  ];
  return (
    <DocumentLayout
      title="Delivery Receipt"
      number={dr.drNumber}
      status={dr.status}
      parties={[{ title: 'Deliver To', lines: [dr.customer?.name, dr.customer?.address, dr.customer?.phone] }]}
      meta={[{ label: 'Delivery Date', value: d(dr.deliveryDate) }]}
      columns={columns}
      rows={dr.items ?? []}
      notes={dr.notes}
      signatures={[
        { label: 'Released By' },
        { label: 'Received By', name: dr.signedByName },
      ]}
    />
  );
}

// ── Goods Received Note ──────────────────────────────────────────────
export function GRNDocument({ gr }: Readonly<{ gr: any }>) {
  const columns: DocColumn[] = [
    { header: '#', align: 'center', width: '5%', render: (_r, i) => i + 1 },
    { header: 'Item', render: (r) => <ItemCell name={r.product?.name} sku={r.product?.sku} /> },
    { header: 'UOM', align: 'center', width: '9%', render: (r) => r.uom },
    { header: 'Qty Received', align: 'right', width: '13%', render: (r) => <span className="mono">{r.quantity}</span> },
    { header: 'Lot #', align: 'left', width: '15%', render: (r) => <span className="mono">{r.lotNumber || '—'}</span> },
    { header: 'Expiry', align: 'right', width: '13%', render: (r) => (r.expiryDate ? d(r.expiryDate) : '—') },
  ];
  return (
    <DocumentLayout
      title="Goods Received Note"
      number={gr.receiptNumber}
      status={gr.status}
      meta={[
        { label: 'Receipt Date', value: d(gr.receiptDate) },
        ...(gr.purchaseOrder?.orderNumber ? [{ label: 'PO Ref', value: gr.purchaseOrder.orderNumber }] : []),
        ...(gr.supplierDrRef ? [{ label: 'Supplier DR/Invoice', value: gr.supplierDrRef }] : []),
      ]}
      columns={columns}
      rows={gr.items ?? []}
      notes={gr.notes}
      signatures={[{ label: 'Received By' }, { label: 'Checked By' }]}
    />
  );
}
