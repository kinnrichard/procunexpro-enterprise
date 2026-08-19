'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Widget } from './widget-renderer';
import type { CatalogEntry } from './add-widget-dialog';

const FULL_ACCESS = new Set(['SUPERADMIN', 'ADMIN']);

export function WidgetSettingsDialog({
  widget, entry, open, onOpenChange, onSave, saving,
}: Readonly<{
  widget: Widget | null;
  entry: CatalogEntry | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (patch: { title: string | null; allowedRoles: string[]; config: any }) => void;
  saving: boolean;
}>) {
  const [title, setTitle] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [config, setConfig] = useState<Record<string, any>>({});

  const { data: rolesResp } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data),
    enabled: open,
  });
  const roles: Array<{ key: string; label: string }> = (Array.isArray(rolesResp) ? rolesResp : [])
    .filter((r: any) => !FULL_ACCESS.has(r.key));

  useEffect(() => {
    if (!widget) return;
    setTitle(widget.title ?? '');
    setAllowedRoles(widget.allowedRoles ?? []);
    setConfig(widget.config ?? {});
  }, [widget]);

  if (!widget) return null;

  const toggleRole = (key: string) =>
    setAllowedRoles((prev) => prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]);

  const setField = (key: string, value: any) => setConfig((c) => ({ ...c, [key]: value }));

  const submit = () => onSave({ title: title.trim() || null, allowedRoles, config });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Widget settings</DialogTitle>
          <DialogDescription>{entry?.label ?? widget.type}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={entry?.label ?? 'Custom title'} className="h-9 rounded-lg" />
          </div>

          {/* Type-specific config fields */}
          {entry?.configFields?.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-[13px]">{f.label}</Label>
              {f.type === 'textarea' ? (
                <Textarea value={config[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} rows={4} placeholder="…" />
              ) : (
                <Input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={config[f.key] ?? ''}
                  min={f.min}
                  max={f.max}
                  placeholder={f.default != null ? String(f.default) : ''}
                  onChange={(e) => setField(f.key, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                  className="h-9 rounded-lg"
                />
              )}
            </div>
          ))}

          {/* Role visibility */}
          <div className="space-y-1.5">
            <Label className="text-[13px]">Visible to roles</Label>
            <p className="text-xs text-muted-foreground">Leave all unchecked to show this widget to everyone. Admins always see every widget.</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {roles.map((r) => {
                const on = allowedRoles.includes(r.key);
                return (
                  <button
                    key={r.key}
                    onClick={() => toggleRole(r.key)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {on && <Check className="h-3 w-3" />} {r.label}
                  </button>
                );
              })}
              {roles.length === 0 && <span className="text-xs text-muted-foreground">No custom roles configured.</span>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
