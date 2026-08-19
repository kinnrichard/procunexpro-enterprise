'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// Company profile + branding live in tenant.settings (JSON) — no schema change.
// Read/written via GET/PUT /auth/tenant with the merge-on-save pattern.

export interface CompanyProfile {
  name?: string;
  legalName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  registrationNo?: string;
  footerNote?: string;
}

export interface Branding {
  sidebarLogo?: string; // app / sidebar logo (uploaded path or absolute URL)
  printLogo?: string;   // document / letterhead logo
}

export interface TenantSettings {
  company?: CompanyProfile;
  branding?: Branding;
  labelCodeType?: 'QR' | 'BARCODE';
  [key: string]: any;
}

export interface Tenant {
  id: string;
  companyName: string;
  logo?: string | null;
  settings?: TenantSettings | null;
}

// The API is served under /api, but uploaded files are served at the origin root
// (`/uploads/...`). Strip the /api suffix to build absolute asset URLs.
export function apiOrigin(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004/api';
  return base.replace(/\/api\/?$/, '');
}

// Resolve a stored asset path to a displayable URL.
// - absolute http(s) URLs pass through
// - /uploads/* → API origin + path
// - anything else (e.g. /logo-primary.png in web/public) passes through
export function resolveAssetUrl(path?: string | null): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/uploads')) return apiOrigin() + path;
  return path;
}

export function useTenant() {
  return useQuery<Tenant>({
    queryKey: ['tenant'],
    queryFn: () => api.get('/auth/tenant').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyProfile(): CompanyProfile {
  const { data } = useTenant();
  return data?.settings?.company ?? {};
}

export function useBranding(): Branding {
  const { data } = useTenant();
  return data?.settings?.branding ?? {};
}
