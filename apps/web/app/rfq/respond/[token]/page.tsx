'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Loader2, Package, Calendar, Building2, FileText } from 'lucide-react';

const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004/api',
  headers: { 'Content-Type': 'application/json' },
});

export default function RfqRespondPage() {
  const params = useParams();
  const token = params.token as string;

  const [leadTime, setLeadTime] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: rfqData, isLoading, error } = useQuery({
    queryKey: ['rfq-public', token],
    queryFn: () => publicApi.get(`/rfq-public/${token}`),
  });

  const rfq = rfqData?.data;

  const submitMutation = useMutation({
    mutationFn: (body: any) => publicApi.post(`/rfq-public/${token}/submit`, body),
    onSuccess: () => setSubmitted(true),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rfq?.items?.length) return;

    const items = rfq.items.map((item: any) => ({
      rfqItemId: item.id,
      unitPrice: Number.parseFloat(prices[item.id] || '0'),
      notes: itemNotes[item.id] || undefined,
    }));

    submitMutation.mutate({
      leadTime: leadTime ? Number.parseInt(leadTime) : undefined,
      validUntil: validUntil || undefined,
      notes: notes || undefined,
      items,
    });
  }

  const allPricesFilled = rfq?.items?.every((item: any) => {
    const val = Number.parseFloat(prices[item.id] || '');
    return !Number.isNaN(val) && val > 0;
  });

  // ─── Loading / Error / Submitted States ────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border p-8 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Link Invalid or Expired</h2>
          <p className="text-sm text-gray-500">This RFQ response link is no longer valid. Please contact the buyer for a new invitation.</p>
        </div>
      </div>
    );
  }

  if (submitted || rfq.submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border p-8 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Quotation Submitted</h2>
          <p className="text-sm text-gray-500">Thank you! Your quotation for <strong>{rfq.rfqNumber}</strong> has been received. The buyer will review and get back to you.</p>
        </div>
      </div>
    );
  }

  if (rfq.status !== 'PUBLISHED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border p-8 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">RFQ Closed</h2>
          <p className="text-sm text-gray-500">This RFQ is no longer accepting quotations.</p>
        </div>
      </div>
    );
  }

  // ─── Main Form ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center">
              <Package className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{rfq.companyName}</p>
              <h1 className="text-lg font-semibold text-gray-900">Request for Quotation</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* RFQ Info */}
        <div className="bg-white rounded-xl border p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">RFQ #</p>
              <p className="text-sm font-medium">{rfq.rfqNumber}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Title</p>
              <p className="text-sm font-medium">{rfq.title}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Vendor</p>
              <p className="text-sm font-medium">{rfq.vendor?.name}</p>
            </div>
            {rfq.deadline && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Deadline</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-sm font-medium">{new Date(rfq.deadline).toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </div>
          {rfq.description && (
            <p className="text-sm text-gray-500 mt-3 pt-3 border-t">{rfq.description}</p>
          )}
        </div>

        {/* Items + Pricing Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50/50">
              <p className="text-xs font-semibold text-gray-700">Items — Enter Your Pricing</p>
            </div>
            <div className="divide-y">
              {rfq.items.map((item: any, idx: number) => (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-gray-400">{String(idx + 1).padStart(2, '0')}</span>
                        <p className="text-sm font-medium text-gray-900">{item.description}</p>
                      </div>
                      <p className="text-xs text-gray-500">{item.quantity} {item.unit}</p>
                    </div>
                    <div className="w-[140px] shrink-0">
                      <Label className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={prices[item.id] || ''}
                        onChange={(e) => setPrices({ ...prices, [item.id]: e.target.value })}
                        className="h-8 text-sm mt-1"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Input
                      placeholder="Item notes (optional)"
                      value={itemNotes[item.id] || ''}
                      onChange={(e) => setItemNotes({ ...itemNotes, [item.id]: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quote Details */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <p className="text-xs font-semibold text-gray-700">Quote Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-gray-500">Lead Time (days)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 14"
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-gray-500">Quote Valid Until</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-gray-500">Notes / Remarks</Label>
              <Textarea
                placeholder="Payment terms, conditions, or other remarks..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {allPricesFilled
                ? `Total: ${rfq.items.reduce((sum: number, item: any) => sum + (item.quantity * (Number.parseFloat(prices[item.id] || '0'))), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'Fill in all unit prices to submit'}
            </p>
            <Button
              type="submit"
              disabled={!allPricesFilled || submitMutation.isPending}
              className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white"
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Submit Quotation
            </Button>
          </div>

          {submitMutation.isError && (
            <p className="text-sm text-red-600 text-center">
              {(submitMutation.error as any)?.response?.data?.message || 'Failed to submit. Please try again.'}
            </p>
          )}
        </form>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-400 pb-4">Powered by Procunex</p>
      </div>
    </div>
  );
}
