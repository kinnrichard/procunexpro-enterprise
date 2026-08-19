'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Image as ImageLucide, Save } from 'lucide-react';
import api from '@/lib/api';
import { useTenant, type CompanyProfile, type Branding } from '@/lib/company-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LogoUpload } from '@/components/logo-upload';
import { useToast } from '@/components/ui/use-toast';

const FIELDS: Array<{ key: keyof CompanyProfile; label: string; placeholder: string; full?: boolean }> = [
  { key: 'name', label: 'Company Name', placeholder: 'Acme Trading Corp.' },
  { key: 'legalName', label: 'Legal / Registered Name', placeholder: 'Acme Trading Corporation' },
  { key: 'address', label: 'Address', placeholder: '123 Industrial Ave.', full: true },
  { key: 'city', label: 'City', placeholder: 'Makati' },
  { key: 'state', label: 'State / Province', placeholder: 'Metro Manila' },
  { key: 'postalCode', label: 'Postal Code', placeholder: '1200' },
  { key: 'country', label: 'Country', placeholder: 'Philippines' },
  { key: 'phone', label: 'Phone', placeholder: '+63 2 8123 4567' },
  { key: 'email', label: 'Email', placeholder: 'info@acme.com' },
  { key: 'website', label: 'Website', placeholder: 'https://acme.com' },
  { key: 'taxId', label: 'Tax ID / TIN', placeholder: '000-000-000-000' },
  { key: 'registrationNo', label: 'Registration No.', placeholder: 'SEC-XXXXXX' },
];

export function CompanyProfileSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: tenant } = useTenant();

  const [company, setCompany] = useState<CompanyProfile>({});
  const [branding, setBranding] = useState<Branding>({});

  useEffect(() => {
    if (tenant) {
      setCompany(tenant.settings?.company ?? {});
      setBranding(tenant.settings?.branding ?? {});
    }
  }, [tenant]);

  const saveMut = useMutation({
    mutationFn: () =>
      api.put('/auth/tenant', {
        settings: { ...(tenant?.settings || {}), company, branding },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant'] });
      toast({ title: 'Company profile saved' });
    },
    onError: () => toast({ title: 'Could not save', variant: 'destructive' }),
  });

  const setField = (key: keyof CompanyProfile, v: string) => setCompany((c) => ({ ...c, [key]: v }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" /> Company Details</CardTitle>
          <p className="text-sm text-muted-foreground">Used across the app and printed on documents (POs, PRs, delivery receipts, etc.).</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.full ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
                <Label className="text-[13px]">{f.label}</Label>
                <Input
                  value={company[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="h-9 rounded-lg"
                />
              </div>
            ))}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[13px]">Document Footer Note</Label>
              <Textarea
                value={company.footerNote ?? ''}
                onChange={(e) => setCompany((c) => ({ ...c, footerNote: e.target.value }))}
                placeholder="e.g. Thank you for your business. Payment due within 30 days."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">Shown at the bottom of printed documents.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><ImageLucide className="h-4 w-4 text-primary" /> Logos & Branding</CardTitle>
          <p className="text-sm text-muted-foreground">PNG or SVG recommended. Transparent backgrounds look best.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <LogoUpload
            label="App / Sidebar Logo"
            hint="Shown in the sidebar. Falls back to the default Procunex logo if empty."
            value={branding.sidebarLogo}
            onChange={(v) => setBranding((b) => ({ ...b, sidebarLogo: v }))}
          />
          <LogoUpload
            label="Document / Print Logo"
            hint="Printed at the top of POs, PRs, delivery receipts and other documents."
            value={branding.printLogo}
            onChange={(v) => setBranding((b) => ({ ...b, printLogo: v }))}
            previewClassName="bg-white"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-gradient-primary">
          <Save className="mr-1.5 h-4 w-4" /> {saveMut.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
