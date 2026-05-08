'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { BarChart3, Plus, Pencil, Trash2, Trophy, Star, TrendingUp, Users } from 'lucide-react';

const scoreSchema = z.object({
  vendorId: z.string().min(1, 'Vendor required'),
  period: z.string().min(1, 'Period required'),
  quality: z.coerce.number().min(0).max(10),
  delivery: z.coerce.number().min(0).max(10),
  pricing: z.coerce.number().min(0).max(10),
  service: z.coerce.number().min(0).max(10),
  notes: z.string().optional(),
});

type ScoreFormData = z.infer<typeof scoreSchema>;

const scoreColor = (score: number) => {
  if (score >= 8) return 'text-green-600';
  if (score >= 6) return 'text-blue-600';
  if (score >= 4) return 'text-amber-600';
  return 'text-red-600';
};

const scoreBarColor = (score: number) => {
  if (score >= 8) return 'bg-green-500';
  if (score >= 6) return 'bg-blue-500';
  if (score >= 4) return 'bg-amber-500';
  return 'bg-red-500';
};

export default function SupplierScoringPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [tab, setTab] = useState('scores');

  const { data: response, isLoading } = useQuery({
    queryKey: ['supplier-scores', page, search],
    queryFn: () => api.get('/supplier-scoring', { params: { page, limit: 10, search } }),
  });

  const { data: leaderboardData } = useQuery({
    queryKey: ['supplier-leaderboard'],
    queryFn: () => api.get('/supplier-scoring/leaderboard'),
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: () => api.get('/vendors', { params: { limit: 1000 } }),
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const leaderboard = leaderboardData?.data || [];
  const vendors = (vendorData?.data?.data || []).map((v: any) => ({ value: v.id, label: v.name }));

  const form = useForm<ScoreFormData>({
    resolver: zodResolver(scoreSchema),
    mode: 'onChange',
    defaultValues: { vendorId: '', period: '', quality: 5, delivery: 5, pricing: 5, service: 5, notes: '' },
  });

  const createMut = useMutation({
    mutationFn: (data: ScoreFormData) => api.post('/supplier-scoring', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplier-scores'] }); queryClient.invalidateQueries({ queryKey: ['supplier-leaderboard'] }); setModalOpen(false); toast({ title: 'Score recorded' }); },
    onError: () => toast({ title: 'Failed to create', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/supplier-scoring/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplier-scores'] }); queryClient.invalidateQueries({ queryKey: ['supplier-leaderboard'] }); setModalOpen(false); toast({ title: 'Score updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/supplier-scoring/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplier-scores'] }); queryClient.invalidateQueries({ queryKey: ['supplier-leaderboard'] }); setDeleteTarget(null); toast({ title: 'Score deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditing(null);
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    form.reset({ vendorId: '', period: `${now.getFullYear()}-Q${q}`, quality: 5, delivery: 5, pricing: 5, service: 5, notes: '' });
    setModalOpen(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    form.reset({ vendorId: s.vendorId, period: s.period, quality: s.quality, delivery: s.delivery, pricing: s.pricing, service: s.service, notes: s.notes || '' });
    setModalOpen(true);
  };

  const onSubmit = (data: ScoreFormData) => {
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const ScoreBar = ({ label, value }: { label: string; value: number }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-semibold', scoreColor(value))}>{value.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', scoreBarColor(value))} style={{ width: `${(value / 10) * 100}%` }} />
      </div>
    </div>
  );

  const columns = [
    { key: 'vendor', label: 'Vendor', sortable: true, render: (_: any, row: any) => <span className="font-medium">{row.vendor?.name || '—'}</span> },
    { key: 'period', label: 'Period', render: (v: string) => <span className="font-mono text-sm">{v}</span> },
    { key: 'quality', label: 'Quality', render: (v: number) => <span className={cn('font-semibold', scoreColor(v))}>{v.toFixed(1)}</span> },
    { key: 'delivery', label: 'Delivery', render: (v: number) => <span className={cn('font-semibold', scoreColor(v))}>{v.toFixed(1)}</span> },
    { key: 'pricing', label: 'Pricing', render: (v: number) => <span className={cn('font-semibold', scoreColor(v))}>{v.toFixed(1)}</span> },
    { key: 'service', label: 'Service', render: (v: number) => <span className={cn('font-semibold', scoreColor(v))}>{v.toFixed(1)}</span> },
    {
      key: 'overall', label: 'Overall', sortable: true, render: (v: number) => (
        <div className="flex items-center gap-1.5">
          <Star className={cn('h-4 w-4', v >= 8 ? 'text-amber-400 fill-amber-400' : v >= 6 ? 'text-amber-400' : 'text-gray-300')} />
          <span className={cn('font-bold', scoreColor(v))}>{v.toFixed(1)}</span>
        </div>
      ),
    },
    {
      key: 'actions', label: '', render: (_: any, row: any) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ),
    },
  ];

  const avgScore = items.length > 0 ? items.reduce((s: number, i: any) => s + i.overall, 0) / items.length : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Supplier Scoring" description="Evaluate and rank vendor performance">
        <Button onClick={openCreate} className="bg-gradient-primary text-white hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> New Score
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Scores" value={total} icon={<BarChart3 className="h-5 w-5" />} />
        <StatCard title="Vendors Scored" value={new Set(items.map((i: any) => i.vendorId)).size} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Avg Score" value={avgScore.toFixed(1)} icon={<Star className="h-5 w-5" />} />
        <StatCard title="Top Performers" value={items.filter((i: any) => i.overall >= 8).length} icon={<Trophy className="h-5 w-5" />} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="scores">All Scores</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="mt-4">
          <DataTable columns={columns} data={items} total={total} page={page} limit={10} onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search scores..." isLoading={isLoading} emptyMessage="No scores yet" />
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <div className="grid gap-3">
            {leaderboard.map((entry: any, i: number) => (
              <Card key={entry.vendorId} className={cn(i === 0 && 'ring-2 ring-amber-400')}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'
                    )}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold truncate">{entry.vendorName || entry.vendor?.name || 'Unknown'}</h4>
                        {i === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
                      </div>
                      <div className="grid grid-cols-4 gap-3 mt-2">
                        <ScoreBar label="Quality" value={entry._avg?.quality || entry.avgQuality || 0} />
                        <ScoreBar label="Delivery" value={entry._avg?.delivery || entry.avgDelivery || 0} />
                        <ScoreBar label="Pricing" value={entry._avg?.pricing || entry.avgPricing || 0} />
                        <ScoreBar label="Service" value={entry._avg?.service || entry.avgService || 0} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn('text-2xl font-bold', scoreColor(entry._avg?.overall || entry.avgOverall || 0))}>
                        {(entry._avg?.overall || entry.avgOverall || 0).toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">Overall</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {leaderboard.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No scores recorded yet. Add scores to see the leaderboard.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>{editing ? 'Edit Score' : 'New Score'}</DialogTitle>
          </DialogHeader>
          <form id="score-form" onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Vendor <span className="text-red-500">*</span></Label>
                <Controller control={form.control} name="vendorId" render={({ field }) => (
                  <SearchableSelect options={vendors} value={field.value} onChange={field.onChange} placeholder="Select vendor" />
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Period <span className="text-red-500">*</span></Label>
                <Input {...form.register('period')} className="h-9 rounded-lg" placeholder="e.g. 2026-Q2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Quality (0-10)</Label>
                <Input type="number" min={0} max={10} step="0.1" {...form.register('quality', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Delivery (0-10)</Label>
                <Input type="number" min={0} max={10} step="0.1" {...form.register('delivery', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Pricing (0-10)</Label>
                <Input type="number" min={0} max={10} step="0.1" {...form.register('pricing', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Service (0-10)</Label>
                <Input type="number" min={0} max={10} step="0.1" {...form.register('service', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea {...form.register('notes')} className="rounded-lg" rows={2} />
            </div>
          </form>
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="score-form" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || createMut.isPending || updateMut.isPending}>
              {editing ? 'Update Score' : 'Record Score'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Score" description="Delete this score?" variant="destructive" confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
    </div>
  );
}
