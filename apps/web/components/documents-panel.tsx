'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import { File, Plus, Trash2, ExternalLink, FileText, Image, FileSpreadsheet } from 'lucide-react';

const docSchema = z.object({
  fileName: z.string().min(1, 'File name required'),
  fileUrl: z.string().url('Valid URL required'),
  fileSize: z.coerce.number().optional(),
  mimeType: z.string().optional(),
});

type DocFormData = z.infer<typeof docSchema>;

const fileIcons: Record<string, any> = {
  'application/pdf': FileText,
  'image/': Image,
  'text/csv': FileSpreadsheet,
  'application/vnd': FileSpreadsheet,
};

function getFileIcon(mimeType?: string) {
  if (!mimeType) return File;
  for (const [key, icon] of Object.entries(fileIcons)) {
    if (mimeType.startsWith(key)) return icon;
  }
  return File;
}

interface DocumentsPanelProps {
  entityType: string;
  entityId: string;
}

export function DocumentsPanel({ entityType, entityId }: DocumentsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['documents', entityType, entityId],
    queryFn: () => api.get(`/documents/entity/${entityType}/${entityId}`),
  });

  const documents = docsData?.data || [];

  const form = useForm<DocFormData>({
    resolver: zodResolver(docSchema),
    mode: 'onChange',
    defaultValues: { fileName: '', fileUrl: '', fileSize: undefined, mimeType: '' },
  });

  const addMut = useMutation({
    mutationFn: (data: DocFormData) => api.post('/documents', { ...data, entityType, entityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
      setAddOpen(false);
      form.reset();
      toast({ title: 'Document attached' });
    },
    onError: () => toast({ title: 'Failed to attach', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
      setDeleteTarget(null);
      toast({ title: 'Document removed' });
    },
    onError: () => toast({ title: 'Failed to remove', variant: 'destructive' }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Documents ({documents.length})</h4>
        <Button type="button" variant="outline" size="sm" onClick={() => { form.reset(); setAddOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Attach
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
        </div>
      ) : documents.length === 0 ? (
        <p className="text-center py-4 text-sm text-muted-foreground">No documents attached</p>
      ) : (
        <div className="space-y-1.5">
          {documents.map((doc: any) => {
            const Icon = getFileIcon(doc.mimeType);
            return (
              <div key={doc.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 group">
                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-primary flex items-center gap-1 truncate">
                    {doc.fileName}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <p className="text-[10px] text-muted-foreground">
                    {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : ''} {doc.fileSize && '·'} {formatDateTime(doc.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteTarget(doc)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
            <DialogTitle>Attach Document</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((d) => addMut.mutate(d))} className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">File Name <span className="text-red-500">*</span></Label>
              <Input {...form.register('fileName')} className={cn('h-9 rounded-lg', form.formState.errors.fileName && 'border-red-300')} placeholder="e.g. Invoice.pdf" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">File URL <span className="text-red-500">*</span></Label>
              <Input {...form.register('fileUrl')} className={cn('h-9 rounded-lg', form.formState.errors.fileUrl && 'border-red-300')} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Size (bytes)</Label>
                <Input type="number" {...form.register('fileSize', { valueAsNumber: true })} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">MIME Type</Label>
                <Input {...form.register('mimeType')} className="h-9 rounded-lg" placeholder="application/pdf" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-gradient-primary text-white" disabled={!form.formState.isValid || addMut.isPending}>
                Attach
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Remove Document" description={`Remove "${deleteTarget?.fileName}"?`} variant="destructive" confirmLabel="Remove" onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} isLoading={deleteMut.isPending} />
    </div>
  );
}
