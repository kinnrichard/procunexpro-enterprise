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

// Generic printable letterhead (dentro invoice/receipt style). Emits plain
// class-based markup — all styling comes from DOC_PRINT_CSS injected into the
// print window, so it renders identically to dentro regardless of app CSS.
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

  const addressLine = [company.address, company.city, company.state, company.postalCode, company.country].filter(Boolean).join(', ');
  const contactLine = [company.phone && `Tel: ${company.phone}`, company.email, company.website].filter(Boolean).join('  |  ');

  return (
    <>
      {/* Header */}
      <div className="doc-header">
        <div className="brand">
          {logo && <img src={logo} alt="" />}
          <div>
            {/* When a logo is present it carries the brand — skip the name text */}
            {!logo && <h1>{company.name || company.legalName || 'Your Company'}</h1>}
            {!logo && company.legalName && company.legalName !== company.name && <p className="legal">{company.legalName}</p>}
            {addressLine && <p>{addressLine}</p>}
            {contactLine && <p>{contactLine}</p>}
            {company.taxId && <p>TIN: {company.taxId}</p>}
          </div>
        </div>
        <div className="doc-title">
          <h2>{title}</h2>
          <p className="num">{number}</p>
          {status && <p className="status">{status}</p>}
        </div>
      </div>

      {/* Parties + meta */}
      {(parties.length > 0 || meta.length > 0) && (
        <div className="info-grid">
          <div className="parties">
            {parties.map((p) => (
              <div key={p.title} className="party">
                <div className="section-label">{p.title}</div>
                {p.lines.filter(Boolean).map((l, i) => (
                  <p key={i} className={i === 0 ? 'info-text bold' : 'info-text subtle'}>{l}</p>
                ))}
              </div>
            ))}
          </div>
          {meta.length > 0 && (
            <table className="meta-table">
              <tbody>
                {meta.map((m) => (
                  <tr key={m.label}>
                    <td className="meta-label">{m.label}</td>
                    <td className="meta-value">{m.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Items table */}
      <table className="items">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} style={{ textAlign: c.align ?? 'left', width: c.width }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => (
                <td key={c.header} style={{ textAlign: c.align ?? 'left' }}>{c.render(row, i)}</td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: '#9CA3AF' }}>No items</td></tr>
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
      {company.footerNote && <div className="footer">{company.footerNote}</div>}
    </>
  );
}
