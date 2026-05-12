"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"

interface Option {
  value: string
  label: string
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
  const containerRef = React.useRef<HTMLDivElement>(null)

  const MAX_VISIBLE = 5

  const filtered = React.useMemo(() => {
    if (!search) return options
    const lower = search.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(lower))
  }, [options, search])

  const [showAll, setShowAll] = React.useState(false)
  const visibleItems = showAll ? filtered : filtered.slice(0, MAX_VISIBLE)
  const remainingCount = filtered.length - MAX_VISIBLE

  const selectedLabel = React.useMemo(() => {
    const found = options.find((opt) => opt.value === value)
    return found?.label
  }, [options, value])

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
        setSearch("")
        setShowAll(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen(!open)
            setSearch("")
            setShowAll(false)
          }
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex h-9 w-full bg-transparent py-2 pl-2 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto p-1">
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
                    onClick={() => {
                      onChange?.(option.value)
                      setOpen(false)
                      setSearch("")
                      setShowAll(false)
                    }}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                      value === option.value && "bg-accent"
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      {value === option.value && (
                        <Check className="h-4 w-4" />
                      )}
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
        </div>
      )}
    </div>
  )
}

export { SearchableSelect }
export type { Option as SearchableSelectOption }
