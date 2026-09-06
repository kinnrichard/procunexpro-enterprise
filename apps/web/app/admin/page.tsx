'use client';

import { useState, useCallback } from 'react';
import {
  Loader2, Lock, RefreshCw, CheckCircle2, XCircle, Building2, Users,
  Plus, Eye, EyeOff, Copy, Check, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Tenant {
  id: string;
  companyName: string;
  schemaName: string;
  status: string;
  userCount: number;
  createdAt: string;
}

interface CreatedCreds {
  companyName: string;
  adminUsername: string;
  adminPassword: string;
  developerPassword?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-emerald-700 bg-emerald-100',
  SUSPENDED: 'text-amber-700 bg-amber-100',
  CANCELLED: 'text-red-700 bg-red-100',
};

const EMPTY_CREATE = {
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
      onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-gray-400 hover:text-gray-700 transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CredRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-sm text-gray-900">{value}</span>
        <CopyButton value={value} />
      </span>
    </div>
  );
}

export default function AdminPage() {
  const [apiKey, setApiKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createSaving, setCreateSaving] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<CreatedCreds | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchTenants = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/platform/tenants`, { headers: { 'x-platform-key': key } });
      if (res.status === 401) { setAuthError('Invalid platform key.'); setAuthed(false); return; }
      const json = await res.json();
      setTenants(json.data || []);
      setAuthed(true);
      setAuthError('');
    } catch {
      setAuthError('Could not connect to the API.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    await fetchTenants(apiKey.trim());
  };

  const pwMismatch = !!createForm.confirmPassword && createForm.adminPassword !== createForm.confirmPassword;
  const canCreate =
    createForm.companyName.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(createForm.adminEmail.trim()) &&
    createForm.adminUsername.trim().length >= 3 &&
    createForm.adminUsername.trim().toLowerCase() !== 'developer' &&
    createForm.adminPassword.length >= 8 &&
    !pwMismatch &&
    !createSaving;

  const handleCreate = async () => {
    setCreateSaving(true);
    setCreateMsg('');
    try {
      const res = await fetch(`${API_URL}/platform/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-platform-key': apiKey },
        body: JSON.stringify({
          companyName: createForm.companyName.trim(),
          adminEmail: createForm.adminEmail.trim(),
          adminUsername: createForm.adminUsername.trim(),
          adminPassword: createForm.adminPassword,
          createDeveloper: createForm.createDeveloper,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setCreatedCreds({
          companyName: createForm.companyName.trim(),
          adminUsername: createForm.adminUsername.trim(),
          adminPassword: createForm.adminPassword,
          developerPassword: json?.developerPassword ?? null,
        });
        setCreating(false);
        setCreateForm(EMPTY_CREATE);
        await fetchTenants(apiKey);
      } else {
        const m = json?.message;
        setCreateMsg(`Error: ${Array.isArray(m) ? m.join(', ') : m || 'Failed to create organization'}`);
      }
    } catch {
      setCreateMsg('Request failed.');
    } finally {
      setCreateSaving(false);
    }
  };

  const toggleStatus = async (t: Tenant) => {
    const next = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setBusyId(t.id);
    try {
      await fetch(`${API_URL}/platform/tenants/${t.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-platform-key': apiKey },
        body: JSON.stringify({ status: next }),
      });
      await fetchTenants(apiKey);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = tenants.filter((t) => t.companyName.toLowerCase().includes(search.toLowerCase()));
  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === 'ACTIVE').length,
    suspended: tenants.filter((t) => t.status !== 'ACTIVE').length,
  };

  // ── Lock screen ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 p-8">
          <div className="text-center mb-6">
            <img src="/logo-primary.png" alt="Procunex" className="h-10 w-auto mx-auto mb-4" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Lock className="h-5 w-5 text-blue-600" />
            </div>
            <h1 className="font-bold text-gray-900 text-lg">Platform Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Organization management</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-key" className="text-xs font-semibold text-gray-700 mb-1.5 block">Platform Admin Key</label>
              <input
                id="admin-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter platform key…"
                className="w-full bg-gray-50 border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>
            {authError && (
              <p className="text-red-600 text-xs flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> {authError}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Verifying…' : 'Access Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Console ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center"><ShieldCheck className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Platform Admin</p>
              <p className="text-xs text-gray-500">Organization management</p>
            </div>
          </div>
          <button
            onClick={() => fetchTenants(apiKey)}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Organizations', value: stats.total, color: 'text-gray-900', bg: 'bg-white' },
            { label: 'Active', value: stats.active, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Suspended', value: stats.suspended, color: 'text-amber-700', bg: 'bg-amber-50' },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-2xl border border-gray-100 shadow-sm p-5', s.bg)}>
              <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
              <p className="text-gray-500 text-xs mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search organizations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm bg-white border-2 border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={() => { setCreating(true); setCreateMsg(''); setCreateForm(EMPTY_CREATE); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> New Organization
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-500 text-xs">
                  <th className="text-left px-5 py-3.5 font-semibold">Organization</th>
                  <th className="text-left px-5 py-3.5 font-semibold">Login name</th>
                  <th className="text-left px-5 py-3.5 font-semibold">Status</th>
                  <th className="text-left px-5 py-3.5 font-semibold">Users</th>
                  <th className="text-left px-5 py-3.5 font-semibold">Created</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr><td colSpan={6} className="text-center py-16"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" /></td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">No organizations found</td></tr>
                )}
                {!loading && filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-blue-600" /></div>
                        <span className="font-semibold text-gray-900">{t.companyName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-gray-500">{t.companyName}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', STATUS_COLORS[t.status] || 'text-gray-600 bg-gray-100')}>{t.status}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-500"><Users className="h-3.5 w-3.5" /><span>{t.userCount}</span></div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => toggleStatus(t)}
                        disabled={busyId === t.id}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {busyId === t.id ? '…' : (t.status === 'ACTIVE' ? 'Suspend' : 'Activate')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-gray-900">New Organization</h2>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
            </div>
            <p className="text-gray-500 text-sm mb-5">The admin password is set here and stored only as a hash — keep a copy.</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="c-name" className="text-xs font-semibold text-gray-700 mb-1.5 block">Organization / login name</label>
                <input id="c-name" value={createForm.companyName} onChange={(e) => setCreateForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="e.g. tbmc" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                <p className="text-[11px] text-gray-400 mt-1">Users type this exact value (case-sensitive) in the Organization login field.</p>
              </div>
              <div>
                <label htmlFor="c-email" className="text-xs font-semibold text-gray-700 mb-1.5 block">Admin email</label>
                <input id="c-email" type="email" value={createForm.adminEmail} onChange={(e) => setCreateForm((f) => ({ ...f, adminEmail: e.target.value }))} placeholder="admin@company.com" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="c-user" className="text-xs font-semibold text-gray-700 mb-1.5 block">Admin username</label>
                <input id="c-user" value={createForm.adminUsername} onChange={(e) => setCreateForm((f) => ({ ...f, adminUsername: e.target.value }))} placeholder="admin" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                {createForm.adminUsername.trim().toLowerCase() === 'developer' && <p className="text-[11px] text-red-500 mt-1">"developer" is reserved.</p>}
              </div>
              <div>
                <label htmlFor="c-pass" className="text-xs font-semibold text-gray-700 mb-1.5 block">Admin password</label>
                <div className="relative">
                  <input id="c-pass" type={showPassword ? 'text' : 'password'} value={createForm.adminPassword} onChange={(e) => setCreateForm((f) => ({ ...f, adminPassword: e.target.value }))} placeholder="Min. 8 characters" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-blue-500" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="c-confirm" className="text-xs font-semibold text-gray-700 mb-1.5 block">Confirm password</label>
                <input id="c-confirm" type="password" value={createForm.confirmPassword} onChange={(e) => setCreateForm((f) => ({ ...f, confirmPassword: e.target.value }))} placeholder="Re-enter password" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                {pwMismatch && <p className="text-[11px] text-red-500 mt-1">Passwords don't match.</p>}
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={createForm.createDeveloper} onChange={(e) => setCreateForm((f) => ({ ...f, createDeveloper: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-blue-600 mt-0.5" />
                <span className="text-[13px] text-gray-700 leading-snug">
                  Create a <span className="font-medium">developer</span> (SUPERADMIN) backdoor account
                  <span className="block text-[11px] text-gray-400">A unique password is generated and shown once after creation.</span>
                </span>
              </label>
            </div>
            {createMsg && (
              <p className={cn('text-xs mt-3 flex items-center gap-1.5', createMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600')}>
                {createMsg.startsWith('Error') ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {createMsg}
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setCreating(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={!canCreate} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {createSaving && <Loader2 className="h-4 w-4 animate-spin" />} Create Organization
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One-time credentials reveal */}
      {createdCreds && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md p-6">
            <h2 className="font-bold text-gray-900">Organization created 🎉</h2>
            <p className="text-gray-500 text-sm mt-0.5 mb-4">Copy these now — the developer password can't be retrieved later.</p>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Admin account</p>
                <CredRow label="Organization" value={createdCreds.companyName} />
                <CredRow label="Username" value={createdCreds.adminUsername} />
                <CredRow label="Password" value={createdCreds.adminPassword} />
                <p className="text-[11px] text-gray-400 mt-1">Admin must change this on first login.</p>
              </div>
              {createdCreds.developerPassword && (
                <div className="border-t pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Developer (SUPERADMIN) backdoor</p>
                  <CredRow label="Username" value="developer" />
                  <CredRow label="Password" value={createdCreds.developerPassword} />
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setCreatedCreds(null)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
