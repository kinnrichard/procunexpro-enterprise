'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, ShieldCheck, Copy, Check } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface TenantRow {
  id: string;
  companyName: string;
  schemaName: string;
  status: string;
  createdAt: string;
  _count?: { users: number; products: number; departments: number };
}

interface CreatedCreds {
  companyName: string;
  adminUsername: string;
  adminPassword: string;
  developerPassword?: string | null;
}

const EMPTY_FORM = {
  companyName: '',
  adminEmail: '',
  adminUsername: 'admin',
  adminPassword: '',
  confirmPassword: '',
  createDeveloper: true,
};

function CopyButton({ value }: Readonly<{ value: string }>) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CredRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[13px]">{value}</span>
        <CopyButton value={value} />
      </span>
    </div>
  );
}

export default function OrganizationsPage() {
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createdCreds, setCreatedCreds] = useState<CreatedCreds | null>(null);

  const isSuperAdmin = user?.role === 'SUPERADMIN';

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.get('/tenants').then((r) => r.data?.data as TenantRow[]),
    enabled: isSuperAdmin,
  });

  const createMut = useMutation({
    mutationFn: () =>
      api
        .post('/tenants', {
          companyName: form.companyName.trim(),
          adminEmail: form.adminEmail.trim(),
          adminUsername: form.adminUsername.trim(),
          adminPassword: form.adminPassword,
          createDeveloper: form.createDeveloper,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      setCreatedCreds({
        companyName: form.companyName.trim(),
        adminUsername: form.adminUsername.trim(),
        adminPassword: form.adminPassword,
        developerPassword: data?.developerPassword ?? null,
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: 'Organization created', description: `"${data?.companyName}" is ready.` });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast({
        title: 'Could not create organization',
        description: Array.isArray(msg) ? msg.join(', ') : msg || 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const pwMismatch = !!form.confirmPassword && form.adminPassword !== form.confirmPassword;
  const canSubmit =
    form.companyName.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.adminEmail.trim()) &&
    form.adminUsername.trim().length >= 3 &&
    form.adminUsername.trim().toLowerCase() !== 'developer' &&
    form.adminPassword.length >= 8 &&
    !pwMismatch &&
    !createMut.isPending;

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ShieldCheck className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Only the developer (SUPERADMIN) account can manage organizations.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Organizations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage tenant organizations. Each new org is provisioned with an admin
            account (password you set) and baseline configuration.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-gradient-primary text-white">
          <Plus className="h-4 w-4 mr-1.5" /> New Organization
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Organization</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Login name</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Users</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && !tenants?.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No organizations yet.</td></tr>
              )}
              {tenants?.map((t) => (
                <tr key={t.id} className="hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{t.companyName}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-muted-foreground">{t.companyName}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono">{t._count?.users ?? 0}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-md p-0 gap-0">
          <div className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>New Organization</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              The admin password is set here and stored only as a hash — keep a copy, it can't be shown again.
            </DialogDescription>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (canSubmit) createMut.mutate(); }}
            className="px-6 py-5 space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-[13px]">Organization / login name <span className="text-red-500">*</span></Label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                className="h-9 rounded-lg"
                placeholder="e.g., tbmc"
              />
              <p className="text-[11px] text-muted-foreground">Users type this exact value (case-sensitive) in the Organization login field.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Admin email <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                className="h-9 rounded-lg"
                placeholder="admin@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Admin username <span className="text-red-500">*</span></Label>
              <Input
                value={form.adminUsername}
                onChange={(e) => setForm((f) => ({ ...f, adminUsername: e.target.value }))}
                className="h-9 rounded-lg"
                placeholder="admin"
              />
              {form.adminUsername.trim().toLowerCase() === 'developer' && (
                <p className="text-[11px] text-red-500">"developer" is reserved.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Admin password <span className="text-red-500">*</span></Label>
              <Input
                type="password"
                value={form.adminPassword}
                onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                className="h-9 rounded-lg"
                placeholder="Min. 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Confirm password <span className="text-red-500">*</span></Label>
              <Input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                className="h-9 rounded-lg"
                placeholder="Re-enter password"
              />
              {pwMismatch && <p className="text-[11px] text-red-500">Passwords don't match.</p>}
            </div>
            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={form.createDeveloper}
                onChange={(e) => setForm((f) => ({ ...f, createDeveloper: e.target.checked }))}
                className="h-4 w-4 rounded border-input mt-0.5"
              />
              <span className="text-[13px] leading-snug">
                Create a <span className="font-medium">developer</span> (SUPERADMIN) backdoor account
                <span className="block text-[11px] text-muted-foreground">A unique password is generated and shown once after creation.</span>
              </span>
            </label>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => createMut.mutate()} className="bg-gradient-primary text-white" disabled={!canSubmit}>
              {createMut.isPending ? 'Creating…' : 'Create organization'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* One-time credentials reveal */}
      <Dialog open={!!createdCreds} onOpenChange={(o) => { if (!o) setCreatedCreds(null); }}>
        <DialogContent className="max-w-md p-0 gap-0">
          <div className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>Organization created 🎉</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Copy these now — the developer password can't be retrieved later.
            </DialogDescription>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Admin account</p>
              <CredRow label="Organization" value={createdCreds?.companyName ?? ''} />
              <CredRow label="Username" value={createdCreds?.adminUsername ?? ''} />
              <CredRow label="Password" value={createdCreds?.adminPassword ?? ''} />
              <p className="text-[11px] text-muted-foreground mt-1">Admin must change this on first login.</p>
            </div>
            {createdCreds?.developerPassword && (
              <div className="border-t pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Developer (SUPERADMIN) backdoor</p>
                <CredRow label="Username" value="developer" />
                <CredRow label="Password" value={createdCreds.developerPassword} />
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-end">
            <Button type="button" onClick={() => setCreatedCreds(null)} className="bg-gradient-primary text-white">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
