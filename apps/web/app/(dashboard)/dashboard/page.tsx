'use client';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { useMemo, useState } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Check, LayoutDashboard } from 'lucide-react';
import api from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { WidgetRenderer, type Widget } from '@/components/dashboard/widget-renderer';
import { AddWidgetDialog, type CatalogEntry } from '@/components/dashboard/add-widget-dialog';
import { WidgetSettingsDialog } from '@/components/dashboard/widget-settings-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';

const Grid = WidthProvider(GridLayout);

export default function DashboardPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { can, isAdmin } = usePermissions();
  const canManage = isAdmin || can('dashboard', 'edit');

  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsFor, setSettingsFor] = useState<Widget | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Widget | null>(null);

  // In edit mode a manager sees every widget; otherwise only what their role may see.
  const listUrl = editMode ? '/dashboard-widgets' : '/dashboard-widgets/mine';
  const { data: widgets = [], isLoading } = useQuery<Widget[]>({
    queryKey: ['dashboard-widgets', editMode],
    queryFn: () => api.get(listUrl).then((r) => r.data.data),
  });

  const { data: catalog = [] } = useQuery<CatalogEntry[]>({
    queryKey: ['dashboard-widget-catalog'],
    queryFn: () => api.get('/dashboard-widgets/catalog').then((r) => r.data.data),
  });

  const catalogByType = useMemo(() => {
    const m = new Map<string, CatalogEntry>();
    for (const e of catalog) m.set(e.type, e);
    return m;
  }, [catalog]);

  const layout: Layout[] = useMemo(
    () => widgets.map((w) => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: 2, minH: 2 })),
    [widgets],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['dashboard-widgets'] });

  const layoutMut = useMutation({
    mutationFn: (items: Array<{ id: string; x: number; y: number; w: number; h: number }>) =>
      api.put('/dashboard-widgets/layout', { items }),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => api.post('/dashboard-widgets', body),
    onSuccess: () => { invalidate(); toast({ title: 'Widget added' }); },
    onError: () => toast({ title: 'Could not add widget', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => api.put(`/dashboard-widgets/${id}`, patch),
    onSuccess: (_r, v) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['widget-data', v.id] });
      setSettingsFor(null);
      toast({ title: 'Widget updated' });
    },
    onError: () => toast({ title: 'Could not save widget', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/dashboard-widgets/${id}`),
    onSuccess: () => { invalidate(); setRemoveTarget(null); toast({ title: 'Widget removed' }); },
    onError: () => toast({ title: 'Could not remove widget', variant: 'destructive' }),
  });

  const saveLayout = (l: Layout[]) => {
    if (!editMode) return;
    layoutMut.mutate(l.map((it) => ({ id: it.i, x: it.x, y: it.y, w: it.w, h: it.h })));
  };

  const handlePick = (entry: CatalogEntry) => {
    const maxY = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    createMut.mutate({ type: entry.type, x: 0, y: maxY, w: entry.defaultSize.w, h: entry.defaultSize.h });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Dashboard</h1>
          {editMode && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Editing layout</span>}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {editMode && (
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Widget
              </Button>
            )}
            <Button
              size="sm"
              variant={editMode ? 'default' : 'outline'}
              onClick={() => setEditMode((v) => !v)}
              className={editMode ? 'bg-gradient-primary' : ''}
            >
              {editMode ? <><Check className="mr-1.5 h-4 w-4" /> Done</> : <><Pencil className="mr-1.5 h-4 w-4" /> Edit Dashboard</>}
            </Button>
          </div>
        )}
      </div>

      {(() => {
        if (isLoading) return <div className="h-64 animate-pulse rounded-xl border bg-muted/40" />;
        if (widgets.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
              <LayoutDashboard className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {canManage ? 'No widgets yet. Turn on Edit Dashboard to add some.' : 'No widgets are visible for your role yet.'}
              </p>
              {canManage && !editMode && <Button size="sm" variant="outline" onClick={() => setEditMode(true)}><Pencil className="mr-1.5 h-4 w-4" /> Edit Dashboard</Button>}
            </div>
          );
        }
        return (
          <Grid
            className={editMode ? 'rounded-xl bg-muted/20 ring-1 ring-inset ring-primary/20' : ''}
            layout={layout}
            cols={12}
            rowHeight={64}
            margin={[16, 16]}
            containerPadding={editMode ? [12, 12] : [0, 0]}
            isDraggable={editMode}
            isResizable={editMode}
            draggableCancel=".widget-no-drag"
            compactType="vertical"
            onDragStop={saveLayout}
            onResizeStop={saveLayout}
          >
            {widgets.map((w) => (
              <div key={w.id} className="overflow-hidden">
                <WidgetRenderer
                  widget={w}
                  catalogLabel={catalogByType.get(w.type)?.label ?? w.type}
                  editMode={editMode}
                  onEdit={setSettingsFor}
                  onRemove={setRemoveTarget}
                />
              </div>
            ))}
          </Grid>
        );
      })()}

      <AddWidgetDialog open={addOpen} onOpenChange={setAddOpen} catalog={catalog} onPick={handlePick} />

      <WidgetSettingsDialog
        widget={settingsFor}
        entry={settingsFor ? catalogByType.get(settingsFor.type) : undefined}
        open={!!settingsFor}
        onOpenChange={(o) => !o && setSettingsFor(null)}
        saving={updateMut.isPending}
        onSave={(patch) => settingsFor && updateMut.mutate({ id: settingsFor.id, patch })}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Remove widget?"
        description="This removes the widget from the dashboard for everyone."
        confirmLabel="Remove"
        variant="destructive"
        isLoading={deleteMut.isPending}
        onConfirm={() => removeTarget && deleteMut.mutate(removeTarget.id)}
      />
    </div>
  );
}
