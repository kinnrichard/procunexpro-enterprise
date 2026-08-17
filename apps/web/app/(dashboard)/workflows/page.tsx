'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * The standalone Workflows builder has been superseded by the configurable
 * approval engine under Settings → Approval Workflows (covers all modules and is
 * what the runtime actually enforces). Redirect there to keep a single source of
 * truth and avoid two editors writing to the same table.
 */
export default function WorkflowsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings?tab=approvals');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-full py-20 gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <p className="text-sm">Redirecting to Settings → Approval Workflows…</p>
    </div>
  );
}
