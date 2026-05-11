'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime, getInitials, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/lib/auth';
import { Send, Pencil, Trash2, Reply, Loader2, MessageSquare, CornerDownRight, ChevronUp } from 'lucide-react';

interface CommentsPanelProps {
  entityType: string;
  entityId: string;
}

export function CommentsPanel({ entityType, entityId }: Readonly<CommentsPanelProps>) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isPrivileged = currentUser && ['SUPERADMIN', 'ADMIN'].includes(currentUser.role);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setShowScrollTop(e.currentTarget.scrollTop > 100);
  }, []);

  const queryKey = ['comments', entityType, entityId];

  const { data: comments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await api.get(`/comments/entity/${entityType}/${entityId}`)).data,
  });

  const createMutation = useMutation({
    mutationFn: (data: { content: string; parentId?: string }) =>
      api.post('/comments', { entityType, entityId, ...data }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setNewComment(''); setReplyTo(null); setReplyContent(''); },
    onError: () => toast({ title: 'Failed to post comment', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.put(`/comments/${id}`, { content }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setEditingId(null); setEditContent(''); },
    onError: () => toast({ title: 'Failed to update comment', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/comments/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setDeleteTarget(null); },
    onError: () => toast({ title: 'Failed to delete comment', variant: 'destructive' }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    createMutation.mutate({ content: newComment.trim() });
  }

  function handleReply(parentId: string) {
    if (!replyContent.trim()) return;
    createMutation.mutate({ content: replyContent.trim(), parentId });
  }

  function startEdit(comment: any) {
    setEditingId(comment.id);
    setEditContent(comment.content);
  }

  function renderComment(comment: any, isReply = false) {
    const isEditing = editingId === comment.id;
    const user = comment.user;
    const initials = user ? getInitials(user.firstName, user.lastName) : '?';
    const name = user ? `${user.firstName} ${user.lastName}` : 'Unknown';

    return (
      <div key={comment.id} className={cn('flex gap-3', isReply && 'ml-10')}>
        {isReply && <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/40 mt-3 shrink-0 -ml-6" />}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-[#1e3a5f] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-[11px] text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
            {comment.createdAt !== comment.updatedAt && (
              <span className="text-[10px] text-muted-foreground italic">(edited)</span>
            )}
          </div>
          {isEditing ? (
            <div className="mt-1.5 space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                className="text-sm"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => updateMutation.mutate({ id: comment.id, content: editContent.trim() })} disabled={!editContent.trim() || updateMutation.isPending} className="h-7 text-xs">
                  {updateMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
              <div className="flex items-center gap-1 mt-1.5">
                {!isReply && (
                  <button onClick={() => { setReplyTo(replyTo === comment.id ? null : comment.id); setReplyContent(''); }} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent transition-colors">
                    <Reply className="h-3 w-3" /> Reply
                  </button>
                )}
                {(comment.user?.id === currentUser?.id || isPrivileged) && (
                  <>
                    <button onClick={() => startEdit(comment)} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent transition-colors">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => setDeleteTarget(comment)} className="text-[11px] text-muted-foreground hover:text-red-600 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {/* Reply input */}
          {replyTo === comment.id && (
            <div className="mt-2 flex gap-2">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                rows={1}
                className="text-sm flex-1"
                autoFocus
              />
              <Button size="sm" onClick={() => handleReply(comment.id)} disabled={!replyContent.trim() || createMutation.isPending} className="h-9 bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}

          {/* Replies */}
          {comment.replies?.length > 0 && (
            <div className="mt-3 space-y-3">
              {comment.replies.map((reply: any) => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* New comment */}
      <form onSubmit={handleSubmit} className="space-y-2 shrink-0">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={2}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!newComment.trim() || createMutation.isPending} className="bg-gradient-to-r from-slate-700 to-[#1e3a5f] text-white hover:opacity-90">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />} Send
          </Button>
        </div>
      </form>

      {/* Comments list */}
      {(isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )) || (comments.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
          <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment.</p>
        </div>
      )) || (
        <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
          {comments.map((c: any) => renderComment(c))}
          {showScrollTop && (
            <button
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="sticky bottom-2 left-full ml-auto w-7 h-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Comment"
        description="Delete this comment? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
