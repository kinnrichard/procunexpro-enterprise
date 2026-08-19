'use client';

import { type ReactNode, type RefObject, useCallback, useRef } from 'react';
import { DOC_PRINT_CSS } from './document-css';

// Wraps captured markup in a standalone HTML document with the print CSS —
// exactly the dentro approach, so output doesn't depend on the app's styles.
export function buildDocHtml(innerHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title><style>${DOC_PRINT_CSS}</style></head><body>${innerHtml}</body></html>`;
}

// Open a fresh window from a blob and print. MUST be called inside a user
// gesture (click) or the popup gets blocked.
export function printInNewWindow(innerHtml: string) {
  const blob = new Blob([buildDocHtml(innerHtml)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = globalThis.open(url, '_blank');
  if (win) {
    setTimeout(() => { win.focus(); win.print(); win.close(); URL.revokeObjectURL(url); }, 350);
  } else {
    URL.revokeObjectURL(url);
  }
}

// Write markup into an already-opened window (opened synchronously in the click
// handler) and print — used when the record must be fetched after the click.
export function writeAndPrint(win: Window | null, innerHtml: string) {
  if (!win) return;
  win.document.open();
  win.document.write(buildDocHtml(innerHtml));
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); win.close(); }, 350);
}

// For detail pages that already have the record: render the document hidden via
// <PrintDocHost innerRef={ref}> and wire a button to `print`.
export function usePrintDoc() {
  const ref = useRef<HTMLDivElement>(null);
  const print = useCallback(() => printInNewWindow(ref.current?.innerHTML ?? ''), []);
  return { ref, print };
}

export function PrintDocHost({ innerRef, children }: Readonly<{ innerRef: RefObject<HTMLDivElement>; children: ReactNode }>) {
  return <div ref={innerRef} style={{ display: 'none' }} aria-hidden>{children}</div>;
}
