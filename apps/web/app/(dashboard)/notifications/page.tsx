'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Bell, CheckCheck, FileText, ShoppingCart, Package, AlertTriangle,
  Wallet, FileSignature, FileSearch, Info, ChevronLeft, ChevronRight,
} from 'lucide-react';

const typeIcons: Record<string, any> = {
  PR_CREATED: FileText,
  PR_APPROVED: FileText,
  PR_REJECTED: FileText,
  PO_CREATED: ShoppingCart,
  PO_APPROVED: ShoppingCart,
  PO_SENT: ShoppingCart,
  PO_RECEIVED: Package,
  STOCK_LOW: AlertTriangle,
  BUDGET_ALERT: Wallet,
  CONTRACT_EXPIRY: FileSignature,
  RFQ_PUBLISHED: FileSearch,
  RFQ_AWARDED: FileSearch,
  GENERAL: Info,
};

const typeColors: Record<string, string> = {
  PR_CREATED: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  PR_APPROVED: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  PR_REJECTED: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  PO_CREATED: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  PO_APPROVED: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  PO_SENT: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  PO_RECEIVED: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  STOCK_LOW: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  BUDGET_ALERT: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  CONTRACT_EXPIRY: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  RFQ_PUBLISHED: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  RFQ_AWARDED: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  GENERAL: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function NotificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'' | 'unread' | 'read'>('');
  const limit = 15;

  const { data: response, isLoading } = useQuery({
    queryKey: ['notifications', page, filter],
    queryFn: () => api.get('/notifications', { params: {
      page, limit,
      ...(filter === 'unread' && { isRead: 'false' }),
      ...(filter === 'read' && { isRead: 'true' }),
    } }),
  });

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get('/notifications/unread-count'),
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const unreadCount = unreadData?.data?.count || 0;
  const totalPages = Math.ceil(total / limit);

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAllReadMut = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      toast({ title: 'All notifications marked as read' });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllReadMut.mutate()} disabled={markAllReadMut.isPending}>
            <CheckCheck className="h-4 w-4 mr-2" /> Mark All Read
          </Button>
        )}
      </PageHeader>

      <div className="flex items-center gap-1.5 mb-4">
        {(['', 'unread', 'read'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {f === '' ? 'All' : f === 'unread' ? `Unread (${unreadCount})` : 'Read'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse">
              <Card><CardContent className="py-4"><div className="h-12 bg-muted rounded" /></CardContent></Card>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-medium text-muted-foreground">No notifications</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((notif: any) => {
            const Icon = typeIcons[notif.type] || Info;
            const colorClass = typeColors[notif.type] || typeColors.GENERAL;

            return (
              <Card
                key={notif.id}
                className={cn(
                  'transition-colors cursor-pointer hover:bg-accent/30',
                  !notif.isRead && 'border-l-4 border-l-primary bg-primary/[0.02]'
                )}
                onClick={() => !notif.isRead && markReadMut.mutate(notif.id)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={cn('text-sm', !notif.isRead ? 'font-semibold' : 'font-medium text-muted-foreground')}>
                          {notif.title}
                        </h4>
                        {!notif.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground">{formatDateTime(notif.createdAt)}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{notif.type.replace(/_/g, ' ')}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
