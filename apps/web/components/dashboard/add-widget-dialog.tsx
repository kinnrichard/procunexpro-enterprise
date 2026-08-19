'use client';

import { useMemo, useState } from 'react';
import { Search, LayoutGrid, BarChart3, List, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface CatalogEntry {
  type: string;
  label: string;
  category: 'KPI' | 'Chart' | 'List' | 'Utility';
  description: string;
  defaultSize: { w: number; h: number };
  configFields?: Array<{ key: string; label: string; type: string; default?: any; min?: number; max?: number }>;
}

const CATEGORY_ICON: Record<string, any> = { KPI: LayoutGrid, Chart: BarChart3, List, Utility: Sparkles };
const CATEGORY_ORDER: CatalogEntry['category'][] = ['KPI', 'Chart', 'List', 'Utility'];

export function AddWidgetDialog({
  open, onOpenChange, catalog, onPick,
}: Readonly<{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  catalog: CatalogEntry[];
  onPick: (entry: CatalogEntry) => void;
}>) {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? catalog.filter((e) => e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
      : catalog;
    return CATEGORY_ORDER
      .map((cat) => ({ cat, items: filtered.filter((e) => e.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [catalog, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a widget</DialogTitle>
          <DialogDescription>Pick a widget to place on the dashboard. You can set who can see it after adding.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search widgets…" className="h-9 rounded-lg pl-9" />
        </div>

        <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
          {grouped.map(({ cat, items }) => {
            const Icon = CATEGORY_ICON[cat];
            return (
              <div key={cat}>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" /> {cat}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((e) => (
                    <button
                      key={e.type}
                      onClick={() => { onPick(e); onOpenChange(false); }}
                      className={cn('flex flex-col items-start gap-0.5 rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/50 hover:shadow-sm')}
                    >
                      <span className="text-sm font-medium">{e.label}</span>
                      <span className="text-xs text-muted-foreground">{e.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {grouped.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No widgets match “{search}”.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
