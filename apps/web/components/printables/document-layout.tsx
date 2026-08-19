'use client';

import { type ReactNode } from 'react';
import { useCompanyProfile, useBranding, resolveAssetUrl } from '@/lib/company-settings';

export interface DocMeta { label: string; value: ReactNode }
export interface DocParty { title: string; lines: Array<string | undefined | null> }
export interface DocColumn {
  header: string;
  align?: 'left' | 'right' | 'center';
  render: (row: any, index: number) => ReactNode;
  width?: string;
}
export interface DocTotal { label: string; value: string; strong?: boolean }
export interface DocSignature { label: string; name?: string }

// Generic printable letterhead matching the dentro INVOICE look (Courier font):
// receipt-header (logo/company left, doc title + number right) + 2px rule, a
// two-column grid (parties left, meta+status right), a bordered items table,
// right-aligned totals, and a centered footer. No disclaimer box.
export function DocumentLayout({
  title, number, status, meta = [], parties = [], columns, rows = [], totals = [], notes, signatures = [], extraFooter,
}: Readonly<{
  title: string;
  number: string;
  status?: string;
  meta?: DocMeta[];
  parties?: DocParty[];
  columns: DocColumn[];
  rows?: any[];
  totals?: DocTotal[];
  notes?: string | null;
  signatures?: DocSignature[];
  extraFooter?: ReactNode;
}>) {
  const company = useCompanyProfile();
  const { printLogo } = useBranding();
  const logo = resolveAssetUrl(printLogo);

  // dentro puts status in the right meta column, not the header.
  const metaWithStatus: DocMeta[] = status ? [...meta, { label: 'Status', value: status }] : meta;

  const addressLine = [company.address, company.city, company.state, company.postalCode, company.country].filter(Boolean).join(', ');
  const contactLine = [company.phone && `Tel: ${company.phone}`, company.email, company.website].filter(Boolean).join('  |  ');

  return (
    <>
      {/* Header */}
      <div className="receipt-header">
        <div className="flex">
          <div>
            {logo
              ? <img src={logo} alt="" />
              : <h1>{company.name || company.legalName || 'Your Company'}</h1>}
            {addressLine && <p>{addressLine}</p>}
            {contactLine && <p>{contactLine}</p>}
            {company.taxId && <p>TIN: {company.taxId}</p>}
          </div>
          <div className="text-right">
            <h2>{title}</h2>
            <p className="mono">{number}</p>
          </div>
        </div>
      </div>

      {/* Parties (left) + meta+status (right) */}
      {(parties.length > 0 || metaWithStatus.length > 0) && (
        <div className="grid-2">
          <div>
            {parties.map((p) => (
              <div key={p.title} className="block">
                <div className="section-label">{p.title}</div>
                {p.lines.filter(Boolean).map((l, i) => (
                  <p key={i} className={i === 0 ? 'info-text bold' : 'info-text subtle'}>{l}</p>
                ))}
              </div>
            ))}
          </div>
          <div className="text-right">
            {metaWithStatus.map((m) => (
              <div key={m.label} className="block">
                <div className="section-label">{m.label}</div>
                <p className="info-text bold">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items table */}
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''} style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => (
                <td key={c.header} className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}>{c.render(row, i)}</td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="text-center" style={{ color: '#9CA3AF' }}>No items</td></tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      {totals.length > 0 && (
        <div className="amount-section">
          <div className="amount-box">
            {totals.map((t) => (
              <div key={t.label} className={t.strong ? 'amount-row total' : 'amount-row'}>
                <span>{t.label}</span>
                <span className="mono">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div className="notes">
          <div className="section-label">Notes</div>
          <p>{notes}</p>
        </div>
      )}

      {extraFooter}

      {/* Signatures */}
      {signatures.length > 0 && (
        <div className="signatures">
          {signatures.map((s) => (
            <div key={s.label} className="sig">
              <div className="sig-line">
                <div className="name">{s.name || ' '}</div>
                <div className="label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        {company.footerNote && <p className="bold">{company.footerNote}</p>}
        <p suppressHydrationWarning>This document was generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </>
  );
}
