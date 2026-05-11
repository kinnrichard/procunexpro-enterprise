'use client'

import * as React from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  sortKey?: string | ((row: T) => any)
  className?: string
  render?: (value: any, row: T) => React.ReactNode
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  total: number
  page: number
  limit: number
  onPageChange: (page: number) => void
  onSearch?: (search: string) => void
  searchPlaceholder?: string
  onRowClick?: (row: T) => void
  isLoading?: boolean
  toolbar?: React.ReactNode
  emptyMessage?: string
  emptyIcon?: React.ReactNode
}

type SortDirection = 'asc' | 'desc' | null

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj)
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  total,
  page,
  limit,
  onPageChange,
  onSearch,
  searchPlaceholder = 'Search...',
  onRowClick,
  isLoading = false,
  toolbar,
  emptyMessage = 'No results found.',
  emptyIcon,
}: Readonly<DataTableProps<T>>) {
  const [searchValue, setSearchValue] = React.useState('')
  const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDir, setSortDir] = React.useState<SortDirection>(null)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleSearch = (value: string) => {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearch?.(value)
    }, 300)
  }

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') {
        setSortKey(null)
        setSortDir(null)
      }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDir) return data
    const col = columns.find((c) => c.key === sortKey)
    const getSortVal = (row: any) => {
      if (col?.sortKey) {
        return typeof col.sortKey === 'function' ? col.sortKey(row) : getNestedValue(row, col.sortKey)
      }
      return getNestedValue(row, sortKey)
    }
    return [...data].sort((a, b) => {
      const aVal = getSortVal(a)
      const bVal = getSortVal(b)
      if (aVal === null || aVal === undefined) {
        if (bVal === null || bVal === undefined) return 0;
        return 1;
      }
      if (bVal === null || bVal === undefined) return -1
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [data, sortKey, sortDir])

  const totalPages = Math.ceil(total / limit)
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1
  const endItem = Math.min(page * limit, total)

  function renderSortIcon(colKey: string) {
    const isActiveSortCol = sortKey === colKey
    if (isActiveSortCol && sortDir === 'asc') return <ArrowUp className="h-3.5 w-3.5" />
    if (isActiveSortCol && sortDir === 'desc') return <ArrowDown className="h-3.5 w-3.5" />
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
  }

  function renderTableBody() {
    if (isLoading) {
      return ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map((key) => (
        <tr key={key} className="border-b border-border/50">
          {columns.map((col) => (
            <td key={col.key} className="px-4 py-3">
              <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))
    }
    if (sortedData.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              {emptyIcon || <Inbox className="h-12 w-12 text-muted-foreground/40 mb-3" />}
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          </td>
        </tr>
      )
    }
    return sortedData.map((row, rowIndex) => (
      <tr
        key={row.id ?? rowIndex}
        className={cn(
          'border-b border-border/50 transition-colors',
          onRowClick && 'cursor-pointer hover:bg-accent/50'
        )}
        onClick={() => onRowClick?.(row)}
      >
        {columns.map((col) => (
          <td key={col.key} className={cn('text-sm py-3 px-4', col.className)}>
            {col.render
              ? col.render(getNestedValue(row, col.key), row)
              : getNestedValue(row, col.key) ?? '-'}
          </td>
        ))}
      </tr>
    ))
  }

  const getPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    let end = start + maxVisible - 1
    if (end > totalPages) {
      end = totalPages
      start = Math.max(1, end - maxVisible + 1)
    }
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {(onSearch || toolbar) && (
        <div className="flex items-center justify-between gap-4">
          {onSearch ? (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          ) : (
            <div />
          )}
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 text-left',
                      col.sortable && 'cursor-pointer select-none hover:text-foreground',
                      col.className
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {col.sortable && (
                        <span className="inline-flex">
                          {renderSortIcon(col.key)}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderTableBody()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{total}</span> results
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous</span>
            </Button>
            {getPageNumbers().map((p) => (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(p)}
                className={cn(
                  'h-8 w-8 p-0',
                  p === page && 'bg-primary text-primary-foreground'
                )}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="h-8 px-2"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
