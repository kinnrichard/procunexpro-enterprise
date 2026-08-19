// Matches the dentro project's receipt/invoice print CSS as closely as possible
// (values taken verbatim from dentro my-receipts). Injected into the print iframe
// so output is identical regardless of the app's styles.
export const DOC_PRINT_CSS = `
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; padding: 0.75in; color: #111827; margin: 0; }

  .receipt-header { border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px; }
  .receipt-header .flex { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .receipt-header img { height: 84px; max-width: 300px; object-fit: contain; }
  .receipt-header h1 { font-size: 24px; font-weight: 700; color: #111827; margin: 0; }
  .receipt-header h2 { font-size: 20px; font-weight: 700; color: #111827; margin: 0; text-transform: uppercase; }
  .receipt-header p { margin: 4px 0 0; font-size: 14px; color: #6B7280; }
  .receipt-header .mono { font-family: monospace; color: #4B5563; }

  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .mono { font-family: monospace; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .block { margin-bottom: 12px; }
  .section-label { font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .info-text { font-size: 14px; color: #111827; margin: 2px 0; }
  .info-text.subtle { color: #6B7280; }
  .info-text.bold { font-weight: 600; }

  table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 32px; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; font-size: 14px; }
  th { background-color: #f3f4f6; font-weight: 600; text-transform: uppercase; font-size: 12px; color: #374151; }
  td { color: #111827; vertical-align: top; }
  .item-name { font-weight: 600; }
  .items-desc { font-size: 12px; color: #6B7280; margin-top: 4px; }

  .amount-section { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .amount-box { width: 288px; }
  .amount-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #4B5563; }
  .amount-row.total { font-weight: 700; font-size: 18px; color: #111827; border-top: 1px solid #D1D5DB; margin-top: 4px; }

  .notes { margin-bottom: 24px; padding: 16px; background-color: #f9fafb; border-radius: 4px; }
  .notes .section-label { margin-bottom: 4px; }
  .notes p { font-size: 14px; color: #4B5563; white-space: pre-wrap; margin: 0; }
  .rfq-note { margin-bottom: 16px; font-size: 13px; font-style: italic; color: #6B7280; }

  .signatures { display: flex; gap: 40px; margin-top: 48px; margin-bottom: 24px; }
  .sig { flex: 1; }
  .sig-line { border-top: 1px solid #9CA3AF; padding-top: 6px; text-align: center; }
  .sig-line .name { font-size: 14px; font-weight: 500; color: #111827; min-height: 18px; }
  .sig-line .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9CA3AF; margin-top: 2px; }

  .footer { border-top: 1px solid #ccc; padding-top: 16px; margin-top: 24px; text-align: center; font-size: 14px; color: #9CA3AF; }
  .footer .bold { font-weight: 500; color: #374151; margin: 0 0 2px; }
  .footer p { margin: 0; }
`;
