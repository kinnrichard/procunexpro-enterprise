'use client'

import * as React from 'react'
import { Filter, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface FilterPopoverProps {
  /** number of active filters — shows a badge and enables "Clear all" */
  activeCount: number
  /** clears every filter */
  onClear: () => void
  /** the filter fields (Label + control per row) */
  children: React.ReactNode
  /** popover width, defaults to 340px */
  width?: number
}

/**
 * Standard "Filters" button + popover used across every list module.
 * Chrome matches the Purchase Requests filter popup exactly; each page
 * supplies its own fields as children.
 */
export function FilterPopover({ activeCount, onClear, children, width = 340 }: Readonly<FilterPopoverProps>) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="h-3.5 w-3.5 mr-1.5" /> Filters
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width }}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
          <p className="text-sm font-semibold">Filters</p>
          {activeCount > 0 && (
            <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>
        <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** A labelled filter row — keeps every module's fields visually identical. */
export function FilterField({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      {children}
    </div>
  )
}
