'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Download, Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

interface ImportError { row: number; sku: string; message: string }
interface ImportResult { total: number; created: number; failed: number; errors: ImportError[] }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateUrl: string;
  importUrl: string;
  templateFilename?: string;
  title?: string;
  description?: string;
  onImported?: () => void;
}

export function BulkImportDialog({
  open, onOpenChange, templateUrl, importUrl,
  templateFilename = 'import-template.xlsx',
  title = 'Bulk Upload',
  description = 'Download the template, fill it in, then upload it to create records in bulk.',
  onImported,
}: Readonly<Props>) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => { setResult(null); if (fileRef.current) fileRef.current.value = ''; };

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await api.get(templateUrl, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = templateFilename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Failed to download template', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(importUrl, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data: ImportResult = res.data;
      setResult(data);
      if (data.created > 0) {
        onImported?.();
        toast({ title: `${data.created} item${data.created === 1 ? '' : 's'} imported${data.failed ? `, ${data.failed} skipped` : ''}` });
      } else {
        toast({ title: 'Nothing imported — see the errors below', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: err?.response?.data?.message || 'Import failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> {title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">{description}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">1</span>
            <div className="flex-1">
              <p className="text-sm font-medium">Download the template</p>
              <p className="text-xs text-muted-foreground mb-2">An Excel file with the columns to fill + a “Reference” sheet listing valid Categories, Manufacturers, Units, etc.</p>
              <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />} Download template
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">2</span>
            <div className="flex-1">
              <p className="text-sm font-medium">Upload the filled file</p>
              <p className="text-xs text-muted-foreground mb-2">.xlsx or .csv — valid rows import, any bad rows are reported so you can fix and re-upload them.</p>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={onPickFile} className="hidden" />
              <Button size="sm" className="bg-gradient-primary text-white" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />} {uploading ? 'Importing…' : 'Choose file & import'}
              </Button>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="h-4 w-4" /> {result.created} created</span>
                {result.failed > 0 && <span className="flex items-center gap-1.5 text-red-600"><AlertTriangle className="h-4 w-4" /> {result.failed} skipped</span>}
                <span className="text-muted-foreground ml-auto">{result.total} row{result.total === 1 ? '' : 's'} total</span>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded border bg-muted/30 divide-y">
                  {result.errors.map((e) => (
                    <div key={e.row} className="px-2.5 py-1.5 text-xs flex gap-2">
                      <span className="font-mono text-muted-foreground shrink-0">Row {e.row}{e.sku ? ` · ${e.sku}` : ''}</span>
                      <span className="text-red-600">{e.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end">
          <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
