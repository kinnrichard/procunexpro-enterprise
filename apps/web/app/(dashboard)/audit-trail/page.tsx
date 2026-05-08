'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollText, Plus, Pencil, Trash2, LogIn, LogOut, RefreshCw, Activity } from 'lucide-react';

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  STATUS_CHANGE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  LOGIN: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  LOGOUT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const actionIcons: Record<string, any> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  STATUS_CHANGE: RefreshCw,
  LOGIN: LogIn,
  LOGOUT: LogOut,
};

const entityTypes = ['', 'vendors', 'products', 'purchase-requests', 'purchase-orders', 'stock-movements', 'users', 'departments', 'categories', 'warehouses', 'budgets', 'contracts', 'rfq', 'workflows'];
const actions = ['', 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'LOGOUT'];

export default function AuditTrailPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data: response, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, entityFilter, actionFilter],
    queryFn: () => api.get('/audit', { params: {
      page, limit: 15, search,
      ...(entityFilter && { entityType: entityFilter }),
      ...(actionFilter && { action: actionFilter }),
    } }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: () => api.get('/audit/stats'),
  });

  const items = response?.data?.data || [];
  const total = response?.data?.total || 0;
  const stats = statsData?.data || {};

  const columns = [
    {
      key: 'action', label: 'Action', render: (v: string) => {
        const Icon = actionIcons[v] || Activity;
        return (
          <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', actionColors[v] || 'bg-gray-100 text-gray-600')}>
            <Icon className="h-3 w-3" />
            {v}
          </span>
        );
      },
    },
    {
      key: 'entityType', label: 'Entity', render: (v: string, row: any) => (
        <div>
          <span className="font-medium text-sm">{v}</span>
          {row.entityId && <span className="ml-1.5 text-xs text-muted-foreground font-mono">{row.entityId.slice(0, 8)}...</span>}
        </div>
      ),
    },
    {
      key: 'user', label: 'User', render: (_: any, row: any) => row.user
        ? <span className="text-sm">{row.user.firstName} {row.user.lastName}</span>
        : <span className="text-xs text-muted-foreground">System</span>,
    },
    {
      key: 'newValues', label: 'Changes', render: (v: any, row: any) => {
        if (!v && !row.oldValues) return <span className="text-xs text-muted-foreground">—</span>;
        const changes = v ? Object.keys(v).length : 0;
        return <span className="text-xs text-muted-foreground">{changes} field{changes !== 1 ? 's' : ''}</span>;
      },
    },
    { key: 'ipAddress', label: 'IP', render: (v: string) => v ? <span className="font-mono text-xs">{v}</span> : '—' },
    { key: 'createdAt', label: 'Time', sortable: true, render: (v: string) => <span className="text-xs">{formatDateTime(v)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Trail" description="Track all system activity and changes" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Events" value={total} icon={<ScrollText className="h-5 w-5" />} />
        <StatCard title="Creates" value={stats.CREATE || 0} icon={<Plus className="h-5 w-5" />} />
        <StatCard title="Updates" value={stats.UPDATE || 0} icon={<Pencil className="h-5 w-5" />} />
        <StatCard title="Deletes" value={stats.DELETE || 0} icon={<Trash2 className="h-5 w-5" />} />
        <StatCard title="Status Changes" value={stats.STATUS_CHANGE || 0} icon={<RefreshCw className="h-5 w-5" />} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={page}
        limit={15}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search audit logs..."
        isLoading={isLoading}
        emptyMessage="No audit events found"
        toolbar={
          <div className="flex items-center gap-2">
            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v === 'ALL' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-8 w-40 rounded-lg text-xs">
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Entities</SelectItem>
                {entityTypes.filter(Boolean).map(t => <SelectItem key={t} value={t}>{t.replace(/-/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === 'ALL' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-8 w-36 rounded-lg text-xs">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Actions</SelectItem>
                {actions.filter(Boolean).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
