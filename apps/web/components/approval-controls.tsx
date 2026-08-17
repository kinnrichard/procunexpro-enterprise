'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth';
import { Check, X, Loader2 } from 'lucide-react';

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export interface Approval {
  status: string;
  currentStep: number;
  totalSteps: number;
  currentRole?: string | null;
  currentStepName?: string | null;
}

/** True when the current user may act on the approval's current stage. */
export function useApprovalEligibility() {
  const { isAdmin } = usePermissions();
  const user = useAuthStore((s) => s.user);
  return (a?: Approval | null) => isAdmin || (!!a?.currentRole && user?.role === a.currentRole);
}

/** Status badge (+ "Stage n/N · role" line when a multi-stage approval is pending). */
export function ApprovalStatusBadge({ approval, fallback }: Readonly<{ approval?: Approval | null; fallback?: string }>) {
  const st = approval?.status || fallback || 'APPROVED';
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit', statusStyles[st] || statusStyles.APPROVED)}>
        {st.charAt(0) + st.slice(1).toLowerCase()}
      </span>
      {st === 'PENDING' && approval && approval.totalSteps > 1 && (
        <span className="text-[11px] text-muted-foreground">Stage {approval.currentStep}/{approval.totalSteps} · {approval.currentStepName || approval.currentRole}</span>
      )}
    </div>
  );
}

/**
 * Approve / Reject buttons for a pending row. Self-contained: owns the mutation,
 * role gating and cache invalidation. Renders nothing unless the row is pending
 * and the current user can act on its stage.
 */
export function ApprovalActions({
  endpoint, id, approval, fallback, invalidateKeys = [], appliedLabel = 'Approved & applied',
}: Readonly<{
  endpoint: string; id: string; approval?: Approval | null; fallback?: string;
  invalidateKeys?: string[]; appliedLabel?: string;
}>) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const eligibleFor = useApprovalEligibility();

  const decideMut = useMutation({
    mutationFn: (action: 'approve' | 'reject') => api.put(`${endpoint}/${id}/${action}`),
    onSuccess: (res: any, action) => {
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      const st = res?.data?.approval?.status ?? res?.data?.status;
      const msg = action === 'reject' ? 'Rejected'
        : st === 'PENDING' ? 'Stage approved — sent to next approver' : appliedLabel;
      toast({ title: msg });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Action failed', variant: 'destructive' }),
  });

  const st = approval?.status || fallback;
  if (st !== 'PENDING' || !eligibleFor(approval)) return null;
  const busy = decideMut.isPending;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" className="h-7 px-2.5 bg-green-600 hover:bg-green-700 text-white" disabled={busy} onClick={() => decideMut.mutate('approve')}>
        {busy && decideMut.variables === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        <span className="ml-1">Approve</span>
      </Button>
      <Button size="sm" variant="outline" className="h-7 px-2.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" disabled={busy} onClick={() => decideMut.mutate('reject')}>
        {busy && decideMut.variables === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        <span className="ml-1">Reject</span>
      </Button>
    </div>
  );
}
