"use client"

import * as React from "react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type CalendarProps = DayPickerProps

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 50 + i)
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const [displayMonth, setDisplayMonth] = React.useState<Date>(
    (props as any).selected instanceof Date
      ? (props as any).selected
      : new Date()
  )

  const handleMonthChange = (month: string) => {
    const newDate = new Date(displayMonth)
    newDate.setMonth(parseInt(month))
    setDisplayMonth(newDate)
  }

  const handleYearChange = (year: string) => {
    const newDate = new Date(displayMonth)
    newDate.setFullYear(parseInt(year))
    setDisplayMonth(newDate)
  }

  const handlePrevMonth = () => {
    const newDate = new Date(displayMonth)
    newDate.setMonth(newDate.getMonth() - 1)
    setDisplayMonth(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(displayMonth)
    newDate.setMonth(newDate.getMonth() + 1)
    setDisplayMonth(newDate)
  }

  return (
    <div className={cn("p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 w-7"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          <Select
            value={displayMonth.getMonth().toString()}
            onValueChange={handleMonthChange}
          >
            <SelectTrigger className="h-7 w-[110px] text-xs font-medium border-none shadow-none focus:ring-0 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {months.map((month, index) => (
                <SelectItem key={month} value={index.toString()} className="text-xs">
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={displayMonth.getFullYear().toString()}
            onValueChange={handleYearChange}
          >
            <SelectTrigger className="h-7 w-[70px] text-xs font-medium border-none shadow-none focus:ring-0 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()} className="text-xs">
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={handleNextMonth}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 w-7"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <DayPicker
        showOutsideDays={showOutsideDays}
        month={displayMonth}
        onMonthChange={setDisplayMonth}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "hidden",
          caption_label: "hidden",
          nav: "hidden",
          nav_button: "hidden",
          nav_button_previous: "hidden",
          nav_button_next: "hidden",
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell:
            "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          row: "flex w-full mt-2",
          cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: cn(
            "h-9 w-9 p-0 font-normal aria-selected:opacity-100 inline-flex items-center justify-center rounded-md text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground"
          ),
          day_range_end: "day-range-end",
          day_selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside:
            "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle:
            "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          ...classNames,
        }}
        {...props}
      />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
