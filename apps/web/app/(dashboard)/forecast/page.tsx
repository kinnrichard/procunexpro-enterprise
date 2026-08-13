'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Factory, Loader2, PackageCheck } from 'lucide-react';

interface ForecastRow {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  maxBuildable: number;
  limitingMaterial: string | null;
  components: Array<{ material: string; sku: string; requiredPerUnit: number; unit: string; available: number; canMake: number | null }>;
}

export default function ForecastPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['production-forecast'],
    queryFn: () => api.get('/productions/forecast'),
  });

  const rows: ForecastRow[] = data?.data?.data || [];
  const buildable = rows.filter((r) => r.maxBuildable > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Production Forecast" description="What you can produce right now from current material stock" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Producible products" value={rows.length} icon={<Factory className="h-5 w-5" />} />
        <StatCard title="Buildable now" value={buildable} icon={<PackageCheck className="h-5 w-5" />} />
        <StatCard title="Blocked (0 buildable)" value={rows.length - buildable} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No products have a composition yet. Define a BOM to forecast production.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-right px-4 py-3">Can Build Now</th>
                  <th className="text-left px-4 py-3">Limiting Material</th>
                  <th className="text-left px-4 py-3">Bottleneck detail</th>
                  <th className="px-4 py-3 w-[110px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const limiting = r.components.find((c) => c.material === r.limitingMaterial);
                  return (
                    <tr key={r.productId} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5"><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground font-mono">{r.sku}</p></td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={cn('text-lg font-mono font-semibold', r.maxBuildable > 0 ? 'text-green-600' : 'text-red-600')}>{r.maxBuildable}</span>
                        <span className="text-xs text-muted-foreground ml-1">{r.unit}</span>
                      </td>
                      <td className="px-4 py-2.5">{r.limitingMaterial || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {limiting ? `${limiting.available} ${limiting.unit} in stock ÷ ${limiting.requiredPerUnit}/unit` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button size="sm" variant="ghost" className="h-8" disabled={r.maxBuildable <= 0} onClick={() => router.push('/productions')}>
                          <Factory className="h-4 w-4 mr-1" /> Produce
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
