'use client';

import { type ReactNode, type RefObject, useCallback, useRef } from 'react';
import { DOC_PRINT_CSS } from './document-css';

// Wraps captured markup in a standalone HTML document with the print CSS —
// keeps output independent of the app's styles.
export function buildDocHtml(innerHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title><style>${DOC_PRINT_CSS}</style></head><body>${innerHtml}</body></html>`;
}

// Print via a hidden iframe — no visible page/tab, just the native print dialog.
// The iframe is its own document, so the app's CSS can't leak in.
export function printHtml(innerHtml: string) {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden',
  } as CSSStyleDeclaration);
  iframe.setAttribute('aria-hidden', 'true');

  let done = false;
  const cleanup = () => { if (done) return; done = true; try { iframe.remove(); } catch { /* noop */ } };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return cleanup();
    win.onafterprint = cleanup;
    // Small delay lets the logo image paint before the dialog opens.
    setTimeout(() => { try { win.focus(); win.print(); } catch { cleanup(); } }, 150);
    // Fallback cleanup if onafterprint never fires (some browsers).
    setTimeout(cleanup, 60000);
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = buildDocHtml(innerHtml);
}

// For detail pages that already have the record: render the document hidden via
// <PrintDocHost innerRef={ref}> and wire a button to `print`.
export function usePrintDoc() {
  const ref = useRef<HTMLDivElement>(null);
  const print = useCallback(() => printHtml(ref.current?.innerHTML ?? ''), []);
  return { ref, print };
}

export function PrintDocHost({ innerRef, children }: Readonly<{ innerRef: RefObject<HTMLDivElement>; children: ReactNode }>) {
  return <div ref={innerRef} style={{ display: 'none' }} aria-hidden>{children}</div>;
}
