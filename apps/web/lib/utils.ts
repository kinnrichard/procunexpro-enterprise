import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency?: string): string {
  let code = currency || 'USD';
  if (!currency && globalThis.window !== undefined) {
    try {
      // Read from zustand store without subscribing (for non-hook contexts)
      const store = (globalThis as any).__CURRENCY_STORE__;
      if (store) code = store.code || 'USD';
    } catch {}
  }
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount);
  } catch {
    return `${code} ${formatNumber(amount, 2)}`;
  }
}

/**
 * Format a number with thousands separators (comma grouping).
 * Trims trailing zeros up to `maxDecimals` (e.g. 1234 -> "1,234", 1234.5 -> "1,234.5").
 * Non-finite / null / undefined render as "0".
 */
export function formatNumber(value: number | string | null | undefined, maxDecimals = 2): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n == null || Number.isNaN(n) || !Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals }).format(n);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
