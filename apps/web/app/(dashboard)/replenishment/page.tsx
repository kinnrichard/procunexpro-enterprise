'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { FilterPopover, FilterField } from '@/components/filter-popover';
import { PackagePlus, AlertTriangle, ShoppingCart, Loader2, Search } from 'lucide-react';

interface Suggestion {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  reorderPoint: number;
  suggestedQty: number;
  costPrice: number;
  estimatedCost: number;
  vendorId: string | null;
  vendorName: string | null;
}

export default function ReplenishmentPage() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [onlyWithVendor, setOnlyWithVendor] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['replenishment-suggestions'],
    queryFn: () => api.get('/replenishment/suggestions'),
  });

  const suggestions: Suggestion[] = data?.data?.data || [];
  const qtyFor = (s: Suggestion) => qty[s.productId] ?? s.suggestedQty;

  const filtered = suggestions.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q);
    const matchesVendor = !onlyWithVendor || !!s.vendorName;
    return matchesSearch && matchesVendor;
  });

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.productId));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((s) => s.productId)));

  const selectedItems = suggestions.filter((s) => selected.has(s.productId));
  const selectedCost = selectedItems.reduce((sum, s) => sum + qtyFor(s) * (s.costPrice || 0), 0);

  const generateMut = useMutation({
    mutationFn: () => api.post('/replenishment/generate', {
      items: selectedItems.map((s) => ({ productId: s.productId, quantity: qtyFor(s) })),
    }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      toast({ title: `Purchase request ${res?.data?.requestNumber || ''} created` });
      router.push('/purchase-requests');
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to generate PR', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Replenishment" description="Materials at or below reorder point — generate purchase requests to restock">
        <Button onClick={() => generateMut.mutate()} disabled={selected.size === 0 || generateMut.isPending} className="bg-gradient-primary text-white hover:opacity-90">
          {generateMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
          Generate PR ({selected.size})
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Items to reorder" value={suggestions.length} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="Selected" value={selected.size} icon={<PackagePlus className="h-5 w-5" />} />
        <StatCard title="Est. selected cost" value={formatCurrency(selectedCost)} icon={<ShoppingCart className="h-5 w-5" />} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search materials..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <FilterPopover activeCount={onlyWithVendor ? 1 : 0} onClear={() => setOnlyWithVendor(false)}>
          <FilterField label="Vendor">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={onlyWithVendor} onChange={(e) => setOnlyWithVendor(e.target.checked)} className="h-4 w-4" />
              Only items with a preferred vendor
            </label>
          </FilterField>
        </FilterPopover>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">{suggestions.length === 0 ? 'Nothing to reorder — all stock is above its reorder point. 🎉' : 'No materials match your search or filter.'}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 w-[40px]"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" /></th>
                  <th className="text-left px-4 py-3">Material</th>
                  <th className="text-right px-4 py-3">In Stock</th>
                  <th className="text-right px-4 py-3">Reorder Pt</th>
                  <th className="text-right px-4 py-3">Order Qty</th>
                  <th className="text-left px-4 py-3">Vendor</th>
                  <th className="text-right px-4 py-3">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.productId} className={cn('hover:bg-accent/30 transition-colors', selected.has(s.productId) && 'bg-primary/5')}>
                    <td className="px-4 py-2.5"><input type="checkbox" checked={selected.has(s.productId)} onChange={() => toggle(s.productId)} className="h-4 w-4" /></td>
                    <td className="px-4 py-2.5"><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground font-mono">{s.sku}</p></td>
                    <td className="px-4 py-2.5 text-right"><span className="font-mono font-semibold text-red-600">{s.currentStock}</span> <span className="text-xs text-muted-foreground">{s.unit}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{s.reorderPoint}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Input type="number" step="any" value={qtyFor(s)} onChange={(e) => setQty({ ...qty, [s.productId]: Number.parseFloat(e.target.value) || 0 })} className="h-8 w-24 rounded-lg text-right ml-auto" />
                    </td>
                    <td className="px-4 py-2.5">{s.vendorName || <span className="text-muted-foreground text-xs">— none —</span>}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCurrency(qtyFor(s) * (s.costPrice || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
