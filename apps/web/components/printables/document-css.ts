// Verbatim dentro-style print CSS. Injected into a fresh print window so the
// output is identical regardless of the app's Tailwind / global styles.
export const DOC_PRINT_CSS = `
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 0.75in;
    color: #111827;
    margin: 0;
    font-size: 14px;
  }

  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px; }
  .doc-header .brand { display: flex; align-items: flex-start; gap: 12px; }
  .doc-header img { max-height: 64px; max-width: 200px; object-fit: contain; }
  .doc-header h1 { font-size: 24px; font-weight: 700; color: #111827; margin: 0; }
  .doc-header .legal { font-size: 14px; color: #374151; font-weight: 500; margin: 4px 0 0; }
  .doc-header p { margin: 2px 0 0; font-size: 14px; color: #6B7280; }
  .doc-title { text-align: right; flex-shrink: 0; }
  .doc-title h2 { font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: #111827; margin: 0; }
  .doc-title .num { font-family: monospace; color: #4B5563; font-size: 14px; margin: 4px 0 0; }
  .doc-title .status { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6B7280; margin: 4px 0 0; }

  .mono { font-family: monospace; }

  .info-grid { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 32px; }
  .parties { display: flex; flex-wrap: wrap; gap: 16px 40px; }
  .party { min-width: 180px; }
  .section-label { font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .info-text { font-size: 14px; color: #111827; margin: 2px 0; }
  .info-text.subtle { color: #6B7280; }
  .info-text.bold { font-weight: 600; }
  .meta-table td { font-size: 14px; padding: 2px 0; }
  .meta-table .meta-label { padding-right: 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9CA3AF; }
  .meta-table .meta-value { text-align: right; font-weight: 500; }

  table.items { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.items th, table.items td { border: 1px solid #ccc; padding: 8px 12px; font-size: 14px; vertical-align: top; }
  table.items th { background: #f3f4f6; font-weight: 600; text-transform: uppercase; font-size: 12px; color: #374151; }
  table.items td { color: #111827; }
  .item-name { font-weight: 600; }
  .item-sub { font-size: 12px; color: #6B7280; margin-top: 2px; }

  .amount-section { display: flex; justify-content: flex-end; margin-top: 24px; }
  .amount-box { width: 288px; }
  .amount-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #4B5563; }
  .amount-row.total { font-weight: 700; color: #111827; font-size: 16px; border-top: 1px solid #D1D5DB; }

  .notes { margin-top: 24px; background: #f9fafb; border-radius: 4px; padding: 16px; }
  .notes .section-label { margin-bottom: 4px; }
  .notes p { font-size: 14px; color: #4B5563; white-space: pre-wrap; margin: 0; }
  .rfq-note { margin-top: 16px; font-size: 13px; font-style: italic; color: #6B7280; }

  .signatures { display: flex; flex-wrap: wrap; gap: 40px; margin-top: 56px; }
  .sig { min-width: 180px; flex: 1; }
  .sig-line { border-top: 1px solid #9CA3AF; padding-top: 6px; text-align: center; }
  .sig-line .name { font-size: 14px; font-weight: 500; color: #111827; min-height: 18px; }
  .sig-line .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9CA3AF; }

  .footer { border-top: 1px solid #ccc; padding-top: 16px; margin-top: 40px; text-align: center; font-size: 14px; color: #9CA3AF; }
`;
