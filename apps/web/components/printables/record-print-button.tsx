'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { writeAndPrint } from './print-document';

// Print trigger for records on list-only pages (no detail page). Opens the print
// window synchronously on click (so it isn't popup-blocked), fetches the full
// record, renders it hidden, then writes the markup into the window and prints.
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
  const winRef = useRef<Window | null>(null);
  const [active, setActive] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: () => api.get(fetchUrl).then((r) => r.data?.data ?? r.data),
    enabled: active,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (active && data && winRef.current) {
      writeAndPrint(winRef.current, hostRef.current?.innerHTML ?? '');
      winRef.current = null;
      setActive(false);
    }
  }, [active, data]);

  const onClick = () => {
    // Open synchronously inside the click (avoids the popup blocker).
    winRef.current = globalThis.open('', '_blank');
    setActive(true);
  };

  return (
    <>
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', className)}
      >
        {active && isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      </button>
      {active && data && <div ref={hostRef} style={{ display: 'none' }} aria-hidden>{render(data)}</div>}
    </>
  );
}
