'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { Loader2, Plus, Pencil, Trash2, ArrowRight, Send, CheckCircle, XCircle, Package, ChevronUp } from 'lucide-react';

const actionConfig: Record<string, { icon: any; color: string; label: string }> = {
  CREATE: { icon: Plus, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Created' },
  UPDATE: { icon: Pencil, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Updated' },
  DELETE: { icon: Trash2, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Deleted' },
  STATUS_CHANGE: { icon: ArrowRight, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Status Changed' },
};

const statusActionConfig: Record<string, { icon: any; color: string; label: string }> = {
  submit: { icon: Send, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Submitted for approval' },
  approve: { icon: CheckCircle, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Approved' },
  reject: { icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Rejected' },
  cancel: { icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Cancelled' },
};

const fieldLabels: Record<string, string> = {
  quantity: 'Quantity', estimatedPrice: 'Unit Price', discount: 'Discount',
  taxable: 'Taxable', taxIncluded: 'Tax Included', vendorId: 'Vendor', notes: 'Notes',
  title: 'Title', description: 'Description', companyId: 'Company', departmentId: 'Department',
  priority: 'Priority', requiredDate: 'Required Date', purchaseTerms: 'Purchase Terms',
  deliveryTerms: 'Delivery Terms', deliveryType: 'Delivery Type',
  glAccountId: 'COA Account', debitAmount: 'Debit', creditAmount: 'Credit', accountRemarks: 'Acct Remarks',
};

function formatValue(key: string, val: any): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (key === 'discount') return `${val}%`;
  if (key === 'requiredDate') {
    try { return new Date(val).toLocaleDateString(); } catch { return String(val); }
  }
  return String(val);
}

function buildChanges(log: any, fields: string[]): { field: string; from: string; to: string }[] {
  const changes: { field: string; from: string; to: string }[] = [];
  const newV = log.newValues || {};
  const oldV = log.oldValues || {};
  for (const key of fields) {
    if (newV[key] !== undefined) {
      const label = fieldLabels[key] || key;
      const from = formatValue(key, oldV[key]);
      const to = formatValue(key, newV[key]);
      if (from !== to) changes.push({ field: label, from, to });
    }
  }
  return changes;
}

type ActivityResult = { icon: any; color: string; text: string; changes?: { field: string; from: string; to: string }[]; detail?: string };

const ITEM_FIELDS = ['quantity', 'estimatedPrice', 'discount', 'taxable', 'taxIncluded', 'vendorId', 'glAccountId', 'debitAmount', 'creditAmount', 'accountRemarks', 'notes'];
const PR_FIELDS = ['title', 'description', 'companyId', 'departmentId', 'priority', 'requiredDate', 'purchaseTerms', 'deliveryTerms', 'deliveryType', 'notes'];

function getStatusChangeDescription(log: any, lastSegment: string): ActivityResult {
  const sc = statusActionConfig[lastSegment];
  if (!sc) return { ...actionConfig.STATUS_CHANGE, text: 'Changed status' };
  const detail = lastSegment === 'reject' && log.newValues?.rejectionNote
    ? `Reason: ${log.newValues.rejectionNote}` : undefined;
  return { icon: sc.icon, color: sc.color, text: sc.label, detail };
}

function getItemDescription(log: any): ActivityResult {
  const itemName = log.newValues?.__itemName;
  const itemLabel = itemName ? `"${itemName}"` : 'a line item';
  if (log.action === 'CREATE') return { icon: Package, color: actionConfig.CREATE.color, text: `Added ${itemLabel}` };
  if (log.action === 'DELETE') return { icon: Trash2, color: actionConfig.DELETE.color, text: `Removed ${itemLabel}` };
  const changes = buildChanges(log, ITEM_FIELDS);
  return { icon: Pencil, color: actionConfig.UPDATE.color, text: `Updated ${itemLabel}`, changes };
}

function getEntityDescription(log: any): ActivityResult {
  if (log.action === 'CREATE') return { ...actionConfig.CREATE, text: 'Created this request' };
  if (log.action === 'DELETE') return { ...actionConfig.DELETE, text: 'Deleted this request' };
  if (log.action === 'UPDATE') {
    const changes = buildChanges(log, PR_FIELDS);
    return { ...actionConfig.UPDATE, text: 'Updated this request', changes };
  }
  const config = actionConfig[log.action] || actionConfig.UPDATE;
  return { ...config, text: config.label };
}

function getActivityDescription(log: any): ActivityResult {
  const url: string = log.newValues?.__url || '';
  const lastSegment = url.split('/').pop() || '';

  if (log.action === 'STATUS_CHANGE') return getStatusChangeDescription(log, lastSegment);
  if (url.includes('/items')) return getItemDescription(log);
  return getEntityDescription(log);
}

interface ActivityPanelProps {
  entityType: string;
  entityId: string;
}

export function ActivityPanel({ entityType, entityId }: Readonly<ActivityPanelProps>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setShowScrollTop(e.currentTarget.scrollTop > 100);
  }, []);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit', entityType, entityId],
    queryFn: async () => (await api.get(`/audit/entity/${entityType}/${entityId}`)).data,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="relative h-full overflow-y-auto pr-1">
      <div className="absolute left-[18px] top-4 bottom-4 w-px bg-border" />
      <div className="space-y-0">
        {logs.map((log: any) => {
          const activity = getActivityDescription(log);
          const Icon = activity.icon;
          const user = log.user;
          const name = user ? `${user.firstName} ${user.lastName}` : 'System';

          return (
            <div key={log.id} className="relative flex items-start gap-3 py-3 pl-1">
              <div className={cn('w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0 z-10', activity.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground"> {activity.text.toLowerCase()}</span>
                </p>
                {activity.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.detail}</p>
                )}
                {activity.changes && activity.changes.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {activity.changes.map((c) => (
                      <p key={c.field} className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                        <span className="font-medium text-foreground/70">{c.field}:</span>
                        <span className="font-mono line-through text-muted-foreground/60">{c.from}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="font-mono text-foreground/80">{c.to}</span>
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatDateTime(log.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
      {showScrollTop && (
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="sticky bottom-2 left-full ml-auto w-7 h-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
