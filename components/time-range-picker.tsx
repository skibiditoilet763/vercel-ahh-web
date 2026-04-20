"use client"

import { useState, useMemo } from "react"
import { CalendarIcon, Clock, Search, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface TimeRange {
  from: number
  to: number
}

interface QuickRange {
  label: string
  value: number
  category: "relative" | "absolute"
}

// Comprehensive quick ranges similar to Grafana
const QUICK_RANGES: QuickRange[] = [
  // Last X time
  { label: "Last 5 minutes", value: 5 * 60 * 1000, category: "relative" },
  { label: "Last 15 minutes", value: 15 * 60 * 1000, category: "relative" },
  { label: "Last 30 minutes", value: 30 * 60 * 1000, category: "relative" },
  { label: "Last 1 hour", value: 60 * 60 * 1000, category: "relative" },
  { label: "Last 3 hours", value: 3 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 6 hours", value: 6 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 12 hours", value: 12 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 24 hours", value: 24 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 2 days", value: 2 * 24 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 7 days", value: 7 * 24 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 30 days", value: 30 * 24 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 90 days", value: 90 * 24 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 6 months", value: 180 * 24 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 1 year", value: 365 * 24 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 2 years", value: 2 * 365 * 24 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 5 years", value: 5 * 365 * 24 * 60 * 60 * 1000, category: "relative" },
  { label: "Last 10 years", value: 10 * 365 * 24 * 60 * 60 * 1000, category: "relative" },
]

// Helper function to format datetime for input
function formatDateTimeLocal(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Helper function to format display date
function formatDisplayDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Format time range for button display
function formatTimeRangeDisplay(from: number, to: number): string {
  const range = to - from
  const seconds = range / 1000
  const minutes = seconds / 60
  const hours = minutes / 60
  const days = hours / 24

  if (seconds < 60) return `Last ${Math.round(seconds)} seconds`
  if (minutes < 60) return `Last ${Math.round(minutes)} minutes`
  if (hours < 24) return `Last ${Math.round(hours)} hours`
  if (days < 7) return `Last ${Math.round(days)} days`
  if (days < 30) return `Last ${Math.round(days / 7)} weeks`
  if (days < 365) return `Last ${Math.round(days / 30)} months`
  return `Last ${Math.round(days / 365)} years`
}

interface TimeRangePickerProps {
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange, label?: string) => void
  className?: string
}

export function TimeRangePicker({
  timeRange,
  onTimeRangeChange,
  className,
}: TimeRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [fromInput, setFromInput] = useState(formatDateTimeLocal(timeRange.from))
  const [toInput, setToInput] = useState(formatDateTimeLocal(timeRange.to))

  // Filter quick ranges based on search
  const filteredRanges = useMemo(() => {
    if (!searchQuery.trim()) return QUICK_RANGES
    const query = searchQuery.toLowerCase()
    return QUICK_RANGES.filter((range) =>
      range.label.toLowerCase().includes(query)
    )
  }, [searchQuery])

  // Handle quick range selection
  const handleQuickRangeSelect = (range: QuickRange) => {
    const now = Date.now()
    const newFrom = now - range.value
    const newTo = now
    onTimeRangeChange({ from: newFrom, to: newTo }, range.label)
    setFromInput(formatDateTimeLocal(newFrom))
    setToInput(formatDateTimeLocal(newTo))
    setOpen(false)
  }

  // Handle custom date range apply
  const handleApplyCustomRange = () => {
    const from = new Date(fromInput).getTime()
    const to = new Date(toInput).getTime()
    if (from && to && from < to) {
      onTimeRangeChange({ from, to }, "Custom")
      setOpen(false)
    }
  }

  // Update inputs when timeRange prop changes
  const syncInputsWithRange = () => {
    setFromInput(formatDateTimeLocal(timeRange.from))
    setToInput(formatDateTimeLocal(timeRange.to))
  }

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (isOpen) syncInputsWithRange()
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 gap-2 px-3 font-normal bg-muted/50 border-border hover:bg-muted hover:border-cyan-500/50 transition-colors",
            className
          )}
        >
          <Clock className="h-4 w-4 text-cyan-400" />
          <span className="text-sm">{formatTimeRangeDisplay(timeRange.from, timeRange.to)}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[580px] p-0 bg-card border-border"
        align="end"
        sideOffset={8}
      >
        <div className="flex">
          {/* Left Panel - Absolute Time Range */}
          <div className="w-[260px] border-r border-border p-4 flex flex-col gap-4">
            <h3 className="text-sm font-medium text-foreground">Absolute time range</h3>

            {/* From Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">From</label>
              <div className="relative">
                <Input
                  type="datetime-local"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  className="h-9 text-sm bg-muted/50 border-border pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* To Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">To</label>
              <div className="relative">
                <Input
                  type="datetime-local"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  className="h-9 text-sm bg-muted/50 border-border pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Apply Button */}
            <Button
              onClick={handleApplyCustomRange}
              className="h-9 bg-cyan-500 hover:bg-cyan-600 text-black font-medium"
            >
              Apply time range
            </Button>

            {/* Current Selection Display */}
            <div className="mt-auto pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Current selection</p>
              <p className="text-xs text-foreground">
                {formatDisplayDate(timeRange.from)}
              </p>
              <p className="text-xs text-muted-foreground">to</p>
              <p className="text-xs text-foreground">
                {formatDisplayDate(timeRange.to)}
              </p>
            </div>

            {/* Timezone */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
              <span>Browser Time</span>
              <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
          </div>

          {/* Right Panel - Quick Ranges */}
          <div className="flex-1 flex flex-col">
            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search quick ranges"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-sm bg-muted/50 border-border placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Quick Ranges List */}
            <ScrollArea className="flex-1 max-h-[320px]">
              <div className="p-1">
                {filteredRanges.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No matching ranges found
                  </p>
                ) : (
                  filteredRanges.map((range) => (
                    <button
                      key={range.label}
                      onClick={() => handleQuickRangeSelect(range)}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                    >
                      {range.label}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
