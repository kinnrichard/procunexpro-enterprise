'use client';

import { useQuery } from '@tanstack/react-query';
import { Settings2, X, GripVertical, Loader2, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { WidgetView } from './widget-views';

export interface Widget {
  id: string;
  type: string;
  title?: string | null;
  config?: any;
  allowedRoles: string[];
  x: number; y: number; w: number; h: number;
  isActive: boolean;
}

const TITLED = (type: string) => type.startsWith('chart-') || type.startsWith('list-');

export function WidgetRenderer({
  widget, catalogLabel, editMode, onEdit, onRemove,
}: Readonly<{
  widget: Widget;
  catalogLabel: string;
  editMode: boolean;
  onEdit: (w: Widget) => void;
  onRemove: (w: Widget) => void;
}>) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-data', widget.id],
    queryFn: () => api.get(`/dashboard-widgets/${widget.id}/data`).then((r) => r.data.data),
    staleTime: 60 * 1000,
  });

  const title = widget.title?.trim() || catalogLabel;
  const showHeader = TITLED(widget.type);
  const restricted = widget.allowedRoles?.length > 0;

  return (
    <div className="group/w relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Edit-mode control strip */}
      {editMode && (
        <div className="widget-no-drag absolute right-1.5 top-1.5 z-20 flex items-center gap-0.5 rounded-md border bg-background/90 p-0.5 shadow-sm backdrop-blur">
          <GripVertical className="h-4 w-4 cursor-move text-muted-foreground" />
          <button onClick={() => onEdit(widget)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Settings">
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onRemove(widget)} className="rounded p-1 text-muted-foreground hover:bg-red-100 hover:text-red-600" title="Remove">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {showHeader && (
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">{title}</h3>
          {editMode && restricted && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><EyeOff className="h-3 w-3" /> {widget.allowedRoles.length} role{widget.allowedRoles.length === 1 ? '' : 's'}</span>
          )}
        </div>
      )}

      <div className={cn('min-h-0 flex-1', showHeader && 'p-3')}>
        {(() => {
          if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
          if (isError) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Failed to load</div>;
          return <WidgetView type={widget.type} title={title} config={widget.config} data={data} />;
        })()}
      </div>
    </div>
  );
}
