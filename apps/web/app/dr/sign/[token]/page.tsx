'use client';

import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2, Eraser } from 'lucide-react';

function SignaturePad({ onChange }: Readonly<{ onChange: (data: string) => void }>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Scale from displayed size to the canvas's internal coordinate space,
    // so strokes land under the finger on any screen width.
    const c = e.currentTarget;
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (c.width / rect.width),
      y: (e.clientY - rect.top) * (c.height / rect.height),
    };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL('image/png'));
  };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={520}
        height={180}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full rounded-lg border border-dashed bg-white touch-none cursor-crosshair"
      />
      <Button type="button" variant="ghost" size="sm" onClick={clear}><Eraser className="h-4 w-4 mr-1.5" /> Clear</Button>
    </div>
  );
}

export default function DrSignPage() {
  const params = useParams();
  const token = params?.token as string;
  const [name, setName] = useState('');
  const [signature, setSignature] = useState('');
  const [done, setDone] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dr-public', token],
    queryFn: () => api.get(`/dr-public/${token}`),
    enabled: !!token,
    retry: false,
  });

  const dr = data?.data;

  const signMut = useMutation({
    mutationFn: () => api.post(`/dr-public/${token}/sign`, { signedByName: name, signatureData: signature }),
    onSuccess: () => setDone(true),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (isError || !dr) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">This delivery receipt link is invalid or expired.</div>;

  const alreadySigned = dr.status === 'SIGNED' || done;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-xl mx-auto bg-background rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white">
          <p className="text-xs opacity-80">{dr.company}</p>
          <h1 className="text-xl font-semibold">Delivery Receipt {dr.drNumber}</h1>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs">Deliver to</p><p className="font-medium">{dr.customer?.name}</p>{dr.customer?.address && <p className="text-xs text-muted-foreground">{dr.customer.address}</p>}</div>
            <div><p className="text-muted-foreground text-xs">Date</p><p className="font-medium">{formatDate(dr.deliveryDate)}</p></div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground"><tr><th className="text-left px-3 py-2 font-medium">Item</th><th className="text-right px-3 py-2 font-medium">Qty</th></tr></thead>
              <tbody>
                {dr.items?.map((it: any) => (
                  <tr key={it.id} className="border-t"><td className="px-3 py-2">{it.product?.name} <span className="text-xs text-muted-foreground">({it.product?.sku})</span></td><td className="px-3 py-2 text-right">{it.quantity} {it.uom}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {(() => {
            if (alreadySigned) {
              return (
                <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 px-4 py-4 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="font-medium text-green-700 dark:text-green-400">Received & signed</p>
                  <p className="text-sm text-muted-foreground">by {done ? name : dr.signedByName}</p>
                  {(signature || dr.signatureData) && <img src={done ? signature : dr.signatureData} alt="signature" className="mx-auto max-h-24 border rounded bg-white" />}
                </div>
              );
            }
            if (dr.status === 'CANCELLED') {
              return <div className="rounded-lg border bg-red-50 px-4 py-4 text-center text-red-700">This delivery receipt was cancelled.</div>;
            }
            return (
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">Confirm receipt of the goods above</p>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Received by (name) <span className="text-red-500">*</span></Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="h-9 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Signature</Label>
                  <SignaturePad onChange={setSignature} />
                </div>
                <Button type="button" onClick={() => signMut.mutate()} disabled={!name || signMut.isPending} className="w-full bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white">
                  {signMut.isPending ? 'Submitting…' : 'Confirm & Sign'}
                </Button>
                {signMut.isError && <p className="text-sm text-red-600 text-center">Could not submit. Please try again.</p>}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
