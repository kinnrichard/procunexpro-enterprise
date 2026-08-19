'use client';

import { useRef, useState } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { resolveAssetUrl } from '@/lib/company-settings';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Reusable image uploader. Uploads to POST /uploads/image and returns the stored
// path (e.g. /uploads/123.png) via onChange. Shows a live preview.
export function LogoUpload({
  value, onChange, label, hint, previewClassName,
}: Readonly<{
  value?: string;
  onChange: (path: string) => void;
  label: string;
  hint?: string;
  previewClassName?: string;
}>) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/uploads/image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(data.fileUrl);
      toast({ title: 'Logo uploaded' });
    } catch {
      toast({ title: 'Upload failed', description: 'Please use an image under 10MB.', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const preview = resolveAssetUrl(value);

  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <div className={cn('flex h-16 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40', previewClassName)}>
          {preview
            ? <img src={preview} alt={label} className="max-h-full max-w-full object-contain" />
            : <ImageIcon className="h-6 w-6 text-muted-foreground/50" />}
        </div>
        <div className="flex flex-col gap-1.5">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              {value ? 'Replace' : 'Upload'}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} className="text-muted-foreground hover:text-red-600">
                <X className="mr-1 h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
