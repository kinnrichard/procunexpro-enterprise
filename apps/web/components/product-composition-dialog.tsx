'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { Plus, Trash2, Layers } from 'lucide-react';

interface Row {
  materialId: string;
  quantity: number;
  uom: string;
}

interface Props {
  productId: string | null;
  productName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductCompositionDialog({ productId, productName, open, onOpenChange }: Readonly<Props>) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [labor, setLabor] = useState(0);
  const [overhead, setOverhead] = useState(0);
  const [mode, setMode] = useState<'quantity' | 'percentage'>('quantity');

  const { data: compData, isFetching } = useQuery({
    queryKey: ['product-components', productId],
    queryFn: () => api.get(`/products/${productId}/components`),
    enabled: !!productId && open,
  });

  const { data: prodData } = useQuery({ queryKey: ['products-all'], queryFn: () => api.get('/products', { params: { limit: 1000 } }) });
  const { data: uomData } = useQuery({ queryKey: ['uom-active'], queryFn: () => api.get('/units-of-measure/active') });
  const uomList = Array.isArray(uomData?.data?.data) ? uomData.data.data : [];
  const uomOptions = uomList.map((u: any) => ({ value: u.code, label: u.code }));

  // Load existing components into editable rows when the dialog opens / data arrives
  useEffect(() => {
    if (open && compData?.data) {
      setRows(compData.data.map((c: any) => ({ materialId: c.materialId, quantity: c.quantity, uom: c.uom || 'pcs' })));
    }
  }, [open, compData]);

  // Prefill labor/overhead from the product record
  useEffect(() => {
    if (open && productId) {
      const p = (prodData?.data?.data || []).find((x: any) => x.id === productId);
      if (p) { setLabor(p.laborCostPerUnit ?? 0); setOverhead(p.overheadCostPerUnit ?? 0); setMode(p.formulationMode === 'percentage' ? 'percentage' : 'quantity'); }
    }
  }, [open, productId, prodData]);

  const materialOptions = (prodData?.data?.data || [])
    .filter((p: any) => p.id !== productId) // a product can't be its own component
    .map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` }));

  const usedIds = new Set(rows.map((r) => r.materialId).filter(Boolean));

  // Roll up material cost: sum(qty x material unit cost)
  const costMap = new Map<string, number>((prodData?.data?.data || []).map((p: any) => [p.id, p.costPrice ?? 0]));
  const factor = (q: number) => (mode === 'percentage' ? (q || 0) / 100 : (q || 0));
  const lineCost = (r: Row) => factor(r.quantity) * (costMap.get(r.materialId) ?? 0);
  const materialTotal = rows.reduce((sum, r) => sum + lineCost(r), 0);
  const totalCost = materialTotal + (labor || 0) + (overhead || 0);
  const pctSum = rows.reduce((sum, r) => sum + (r.materialId ? (r.quantity || 0) : 0), 0);
  const pctOff = mode === 'percentage' && rows.some((r) => r.materialId) && Math.abs(pctSum - 100) > 0.01;

  const saveMut = useMutation({
    mutationFn: () => api.put(`/products/${productId}/components`, { items: rows.filter((r) => r.materialId), laborCostPerUnit: labor || 0, overheadCostPerUnit: overhead || 0, formulationMode: mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-components', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Composition saved' });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to save composition', variant: 'destructive' }),
  });

  const addRow = () => setRows((r) => [...r, { materialId: '', quantity: 1, uom: 'pcs' }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const hasDuplicate = rows.some((r, i) => r.materialId && rows.findIndex((x) => x.materialId === r.materialId) !== i);
  const canSave = !hasDuplicate && rows.every((r) => !r.materialId || r.quantity > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
          <DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Composition</DialogTitle>
          <DialogDescription>Define the materials that make up {productName || 'this product'} (per 1 unit).</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-3 min-h-[420px] max-h-[80vh] overflow-y-auto">
          {isFetching && <p className="text-sm text-muted-foreground">Loading…</p>}

          {/* Formulation mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Formulation:</span>
            {(['quantity', 'percentage'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors', mode === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                {m === 'quantity' ? 'Quantity / unit' : '% of batch'}
              </button>
            ))}
            {mode === 'percentage' && (
              <span className={cn('ml-auto text-xs font-medium', pctOff ? 'text-amber-600' : 'text-green-600')}>
                Σ {pctSum.toFixed(2)}%{pctOff ? ' (should be 100%)' : ' ✓'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-[1fr_80px_110px_100px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>Material</span>
            <span>{mode === 'percentage' ? '% of batch' : 'Qty / unit'}</span>
            <span>UoM</span>
            <span className="text-right">Cost</span>
            <span />
          </div>

          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_110px_100px_40px] gap-2 items-center">
              <SearchableSelect
                options={materialOptions.filter((o: any) => o.value === row.materialId || !usedIds.has(o.value))}
                value={row.materialId}
                onChange={(v) => updateRow(i, { materialId: v })}
                placeholder="Select material"
              />
              <Input type="number" min={0} step="any" value={row.quantity || ''} placeholder="0" onChange={(e) => updateRow(i, { quantity: Number.parseFloat(e.target.value) || 0 })} className="h-9 rounded-lg" />
              <SearchableSelect options={uomOptions} value={row.uom} onChange={(v) => updateRow(i, { uom: v })} placeholder="UoM" />
              <span className="text-right text-sm tabular-nums">{row.materialId ? formatCurrency(lineCost(row)) : '—'}</span>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:text-red-700" onClick={() => removeRow(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {rows.length === 0 && !isFetching && (
            <p className="text-sm text-muted-foreground py-2">No materials yet. Add the components this product is made of.</p>
          )}

          <Button type="button" variant="outline" size="sm" onClick={addRow} className="mt-1">
            <Plus className="h-4 w-4 mr-1.5" /> Add material
          </Button>

          {hasDuplicate && <p className="text-sm text-red-600">Each material can only appear once.</p>}

          {/* Cost breakdown: materials + labor + overhead = unit cost */}
          <div className="mt-3 rounded-lg border bg-muted/40 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Materials / unit</span>
              <span className="tabular-nums font-medium">{formatCurrency(materialTotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm text-muted-foreground">Labor / unit</Label>
              <Input type="number" step="any" value={labor || ''} placeholder="0.00" onChange={(e) => setLabor(Number.parseFloat(e.target.value) || 0)} className="h-8 w-28 rounded-lg text-right" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm text-muted-foreground">Overhead / unit</Label>
              <Input type="number" step="any" value={overhead || ''} placeholder="0.00" onChange={(e) => setOverhead(Number.parseFloat(e.target.value) || 0)} className="h-8 w-28 rounded-lg text-right" />
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <div>
                <p className="text-sm font-medium">Total cost / unit</p>
                <p className="text-xs text-muted-foreground">Saved as this product&apos;s cost price</p>
              </div>
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={() => saveMut.mutate()} className="bg-gradient-primary text-white" disabled={!canSave || saveMut.isPending}>
            {saveMut.isPending ? 'Saving…' : 'Save Composition'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
