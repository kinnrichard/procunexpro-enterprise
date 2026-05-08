import { cn } from '@/lib/utils'

export interface StatusBadgeProps {
  status: string
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'secondary'
}

const statusVariantMap: Record<string, StatusBadgeProps['variant']> = {
  ACTIVE: 'success',
  APPROVED: 'success',
  RECEIVED: 'success',
  CONVERTED: 'success',
  COMPLETED: 'success',
  FULFILLED: 'success',
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  DRAFT: 'warning',
  IN_PROGRESS: 'warning',
  REJECTED: 'destructive',
  CANCELLED: 'destructive',
  BLACKLISTED: 'destructive',
  SUSPENDED: 'destructive',
  CLOSED: 'destructive',
  SENT: 'info',
  PUBLISHED: 'info',
  ORDERED: 'info',
  PARTIALLY_RECEIVED: 'secondary',
  INACTIVE: 'secondary',
}

const variantStyles: Record<string, string> = {
  default:
    'bg-secondary text-secondary-foreground',
  success:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  warning:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  destructive:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  info:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  secondary:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const resolvedVariant = variant || statusVariantMap[status] || 'default'

  return (
    <span
      className={cn(
        'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyles[resolvedVariant]
      )}
    >
      {formatStatus(status)}
    </span>
  )
}
