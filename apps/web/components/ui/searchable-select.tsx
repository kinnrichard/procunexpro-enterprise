"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface Option {
  value: string
  label: string
}

// Radix Dialog locks page scroll (react-remove-scroll), which also swallows
// wheel events on portaled popover content. Manually scroll the list so the
// mouse wheel works whether or not the select lives inside a modal.
function handleListWheel(e: WheelEvent) {
  const el = e.currentTarget as HTMLDivElement
  if (el.scrollHeight <= el.clientHeight) return
  e.preventDefault()
  e.stopPropagation()
  el.scrollTop += e.deltaY
}

interface SearchableSelectProps {
  options: Option[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className,
}: Readonly<SearchableSelectProps>) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [showAll, setShowAll] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)

  const setListRef = React.useCallback((node: HTMLDivElement | null) => {
    if (listRef.current) {
      listRef.current.removeEventListener("wheel", handleListWheel)
    }
    listRef.current = node
    if (node) {
      node.addEventListener("wheel", handleListWheel, { passive: false })
    }
  }, [])

  const MAX_VISIBLE = 5

  const filtered = React.useMemo(() => {
    if (!search) return options
    const lower = search.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(lower))
  }, [options, search])

  const visibleItems = showAll ? filtered : filtered.slice(0, MAX_VISIBLE)
  const remainingCount = filtered.length - MAX_VISIBLE

  const selectedLabel = React.useMemo(
    () => options.find((opt) => opt.value === value)?.label,
    [options, value]
  )

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setSearch("")
      setShowAll(false)
    }
  }

  function handleSelect(optionValue: string) {
    onChange?.(optionValue)
    handleOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      {/* Portaled to <body> — escapes any modal overflow/clip container */}
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
        className="p-0 w-[var(--radix-popover-trigger-width)]"
      >
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex h-9 w-full bg-transparent py-2 pl-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div ref={setListRef} className="max-h-[min(300px,var(--radix-popover-content-available-height))] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          ) : (
            <>
              {visibleItems.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === option.value && "bg-accent"
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {value === option.value && <Check className="h-4 w-4" />}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
              {remainingCount > 0 && !showAll && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="w-full py-1.5 px-2 text-xs text-primary font-medium text-center hover:bg-accent rounded-sm"
                >
                  Show {remainingCount} more...
                </button>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { SearchableSelect }
export type { Option as SearchableSelectOption }
