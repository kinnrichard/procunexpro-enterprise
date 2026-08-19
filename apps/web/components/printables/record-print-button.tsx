'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { printHtml } from './print-document';

// Print trigger for records on list-only pages (no detail page). Fetches the
// full record on click, renders it hidden, then prints it via a hidden iframe.
export function RecordPrintButton({
  fetchUrl, queryKey, render, title = 'Print', className,
}: Readonly<{
  fetchUrl: string;
  queryKey: unknown[];
  render: (data: any) => ReactNode;
  title?: string;
  className?: string;
}>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: () => api.get(fetchUrl).then((r) => r.data?.data ?? r.data),
    enabled: active,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (active && data) {
      printHtml(hostRef.current?.innerHTML ?? '');
      setActive(false);
    }
  }, [active, data]);

  return (
    <>
      <button
        type="button"
        title={title}
        onClick={() => setActive(true)}
        className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', className)}
      >
        {active && isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      </button>
      {active && data && <div ref={hostRef} style={{ display: 'none' }} aria-hidden>{render(data)}</div>}
    </>
  );
}
