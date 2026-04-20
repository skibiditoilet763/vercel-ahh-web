"use client"

import { useState, useMemo, useEffect } from "react"
import { CalendarIcon, Clock, Search, ChevronDown, Copy, Clipboard } from "lucide-react"
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
  getValue: () => { from: number; to: number }
}

// Get start of today
const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Get start of this week (Monday)
const startOfWeek = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Get start of this month
const startOfMonth = () => {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Get start of this year
const startOfYear = () => {
  const d = new Date()
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Get start of fiscal quarter (assuming Q1 starts in January)
const startOfFiscalQuarter = () => {
  const d = new Date()
  const quarter = Math.floor(d.getMonth() / 3)
  d.setMonth(quarter * 3, 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Get start of fiscal year (assuming starts in January)
const startOfFiscalYear = () => startOfYear()

// Get previous period helpers
const startOfYesterday = () => startOfToday() - 24 * 60 * 60 * 1000
const endOfYesterday = () => startOfToday() - 1

const startOfPreviousWeek = () => startOfWeek() - 7 * 24 * 60 * 60 * 1000
const endOfPreviousWeek = () => startOfWeek() - 1

const startOfPreviousMonth = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 1, 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const endOfPreviousMonth = () => startOfMonth() - 1

const startOfPreviousYear = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1, 0, 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const endOfPreviousYear = () => startOfYear() - 1

const startOfPreviousFiscalQuarter = () => {
  const d = new Date()
  const quarter = Math.floor(d.getMonth() / 3)
  d.setMonth((quarter - 1) * 3, 1)
  if (quarter === 0) d.setFullYear(d.getFullYear() - 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const endOfPreviousFiscalQuarter = () => startOfFiscalQuarter() - 1

const startOfPreviousFiscalYear = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1, 0, 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const endOfPreviousFiscalYear = () => startOfFiscalYear() - 1

const thisDayLastWeek = () => {
  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const d = new Date(weekAgo)
  d.setHours(0, 0, 0, 0)
  return { from: d.getTime(), to: d.getTime() + 24 * 60 * 60 * 1000 - 1 }
}

const dayBeforeYesterday = () => {
  const start = startOfToday() - 2 * 24 * 60 * 60 * 1000
  return { from: start, to: start + 24 * 60 * 60 * 1000 - 1 }
}

// Comprehensive quick ranges similar to Grafana
const QUICK_RANGES: QuickRange[] = [
  // Relative ranges
  { label: "Today", getValue: () => ({ from: startOfToday(), to: Date.now() }) },
  { label: "Today so far", getValue: () => ({ from: startOfToday(), to: Date.now() }) },
  { label: "This week", getValue: () => ({ from: startOfWeek(), to: Date.now() }) },
  { label: "This week so far", getValue: () => ({ from: startOfWeek(), to: Date.now() }) },
  { label: "This month", getValue: () => ({ from: startOfMonth(), to: Date.now() }) },
  { label: "This month so far", getValue: () => ({ from: startOfMonth(), to: Date.now() }) },
  { label: "This year", getValue: () => ({ from: startOfYear(), to: Date.now() }) },
  { label: "This year so far", getValue: () => ({ from: startOfYear(), to: Date.now() }) },
  { label: "This fiscal quarter so far", getValue: () => ({ from: startOfFiscalQuarter(), to: Date.now() }) },
  { label: "This fiscal quarter", getValue: () => ({ from: startOfFiscalQuarter(), to: Date.now() }) },
  { label: "This fiscal year so far", getValue: () => ({ from: startOfFiscalYear(), to: Date.now() }) },
  { label: "This fiscal year", getValue: () => ({ from: startOfFiscalYear(), to: Date.now() }) },
  
  // Last X time
  { label: "Last 5 minutes", getValue: () => ({ from: Date.now() - 5 * 60 * 1000, to: Date.now() }) },
  { label: "Last 15 minutes", getValue: () => ({ from: Date.now() - 15 * 60 * 1000, to: Date.now() }) },
  { label: "Last 30 minutes", getValue: () => ({ from: Date.now() - 30 * 60 * 1000, to: Date.now() }) },
  { label: "Last 1 hour", getValue: () => ({ from: Date.now() - 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 3 hours", getValue: () => ({ from: Date.now() - 3 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 6 hours", getValue: () => ({ from: Date.now() - 6 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 12 hours", getValue: () => ({ from: Date.now() - 12 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 24 hours", getValue: () => ({ from: Date.now() - 24 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 2 days", getValue: () => ({ from: Date.now() - 2 * 24 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 7 days", getValue: () => ({ from: Date.now() - 7 * 24 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 30 days", getValue: () => ({ from: Date.now() - 30 * 24 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 90 days", getValue: () => ({ from: Date.now() - 90 * 24 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 6 months", getValue: () => ({ from: Date.now() - 180 * 24 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 1 year", getValue: () => ({ from: Date.now() - 365 * 24 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 2 years", getValue: () => ({ from: Date.now() - 2 * 365 * 24 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 5 years", getValue: () => ({ from: Date.now() - 5 * 365 * 24 * 60 * 60 * 1000, to: Date.now() }) },
  { label: "Last 10 years", getValue: () => ({ from: Date.now() - 10 * 365 * 24 * 60 * 60 * 1000, to: Date.now() }) },
  
  // Previous periods
  { label: "Yesterday", getValue: () => ({ from: startOfYesterday(), to: endOfYesterday() }) },
  { label: "Day before yesterday", getValue: () => dayBeforeYesterday() },
  { label: "This day last week", getValue: () => thisDayLastWeek() },
  { label: "Previous week", getValue: () => ({ from: startOfPreviousWeek(), to: endOfPreviousWeek() }) },
  { label: "Previous month", getValue: () => ({ from: startOfPreviousMonth(), to: endOfPreviousMonth() }) },
  { label: "Previous fiscal quarter", getValue: () => ({ from: startOfPreviousFiscalQuarter(), to: endOfPreviousFiscalQuarter() }) },
  { label: "Previous year", getValue: () => ({ from: startOfPreviousYear(), to: endOfPreviousYear() }) },
  { label: "Previous fiscal year", getValue: () => ({ from: startOfPreviousFiscalYear(), to: endOfPreviousFiscalYear() }) },
]

// Parse relative time expression like "now-30s", "now-1h", "now"
function parseRelativeTime(expr: string): number | null {
  const trimmed = expr.trim().toLowerCase()
  
  if (trimmed === "now") {
    return Date.now()
  }
  
  const match = trimmed.match(/^now\s*([+-])\s*(\d+)\s*(s|m|h|d|w|M|y)$/)
  if (!match) return null
  
  const [, operator, valueStr, unit] = match
  const value = parseInt(valueStr, 10)
  
  let ms = 0
  switch (unit) {
    case "s": ms = value * 1000; break
    case "m": ms = value * 60 * 1000; break
    case "h": ms = value * 60 * 60 * 1000; break
    case "d": ms = value * 24 * 60 * 60 * 1000; break
    case "w": ms = value * 7 * 24 * 60 * 60 * 1000; break
    case "M": ms = value * 30 * 24 * 60 * 60 * 1000; break
    case "y": ms = value * 365 * 24 * 60 * 60 * 1000; break
    default: return null
  }
  
  return operator === "-" ? Date.now() - ms : Date.now() + ms
}

// Format timestamp to relative expression
function toRelativeExpression(timestamp: number): string {
  const diff = Date.now() - timestamp
  
  if (Math.abs(diff) < 1000) return "now"
  
  const units = [
    { label: "y", ms: 365 * 24 * 60 * 60 * 1000 },
    { label: "M", ms: 30 * 24 * 60 * 60 * 1000 },
    { label: "w", ms: 7 * 24 * 60 * 60 * 1000 },
    { label: "d", ms: 24 * 60 * 60 * 1000 },
    { label: "h", ms: 60 * 60 * 1000 },
    { label: "m", ms: 60 * 1000 },
    { label: "s", ms: 1000 },
  ]
  
  for (const unit of units) {
    if (Math.abs(diff) >= unit.ms) {
      const value = Math.round(diff / unit.ms)
      return diff > 0 ? `now-${value}${unit.label}` : `now+${Math.abs(value)}${unit.label}`
    }
  }
  
  return "now"
}

// Format datetime for display
function formatDisplayDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
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

// Get timezone offset string
function getTimezoneOffset(): string {
  const offset = new Date().getTimezoneOffset()
  const hours = Math.abs(Math.floor(offset / 60))
  const minutes = Math.abs(offset % 60)
  const sign = offset <= 0 ? "+" : "-"
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

// Local storage key for recent ranges
const RECENT_RANGES_KEY = "grafana-time-picker-recent-ranges"

interface RecentRange {
  from: number
  to: number
  label: string
  timestamp: number
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
  const [fromInput, setFromInput] = useState(toRelativeExpression(timeRange.from))
  const [toInput, setToInput] = useState("now")
  const [recentRanges, setRecentRanges] = useState<RecentRange[]>([])

  // Load recent ranges from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_RANGES_KEY)
      if (stored) {
        setRecentRanges(JSON.parse(stored))
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Save recent range
  const saveRecentRange = (from: number, to: number, label: string) => {
    const newRange: RecentRange = { from, to, label, timestamp: Date.now() }
    const updated = [newRange, ...recentRanges.filter(r => 
      !(r.from === from && r.to === to)
    )].slice(0, 5)
    setRecentRanges(updated)
    try {
      localStorage.setItem(RECENT_RANGES_KEY, JSON.stringify(updated))
    } catch {
      // Ignore localStorage errors
    }
  }

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
    const { from, to } = range.getValue()
    onTimeRangeChange({ from, to }, range.label)
    setFromInput(toRelativeExpression(from))
    setToInput("now")
    saveRecentRange(from, to, range.label)
    setOpen(false)
  }

  // Handle recent range selection
  const handleRecentRangeSelect = (range: RecentRange) => {
    onTimeRangeChange({ from: range.from, to: range.to }, range.label)
    setFromInput(toRelativeExpression(range.from))
    setToInput(toRelativeExpression(range.to))
    setOpen(false)
  }

  // Handle custom date range apply
  const handleApplyCustomRange = () => {
    let from = parseRelativeTime(fromInput)
    let to = parseRelativeTime(toInput)
    
    // Try parsing as absolute date if relative parsing fails
    if (from === null) {
      const parsed = Date.parse(fromInput)
      if (!isNaN(parsed)) from = parsed
    }
    if (to === null) {
      const parsed = Date.parse(toInput)
      if (!isNaN(parsed)) to = parsed
    }
    
    if (from && to && from < to) {
      onTimeRangeChange({ from, to }, "Custom")
      saveRecentRange(from, to, `${formatDisplayDateTime(from)} to ${formatDisplayDateTime(to)}`)
      setOpen(false)
    }
  }

  // Copy current range to clipboard
  const handleCopyRange = async () => {
    const text = `${fromInput} to ${toInput}`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback
    }
  }

  // Paste range from clipboard
  const handlePasteRange = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const match = text.match(/(.+)\s+to\s+(.+)/)
      if (match) {
        setFromInput(match[1].trim())
        setToInput(match[2].trim())
      }
    } catch {
      // Ignore clipboard errors
    }
  }

  // Update inputs when popover opens
  const syncInputsWithRange = () => {
    setFromInput(toRelativeExpression(timeRange.from))
    setToInput(toRelativeExpression(timeRange.to))
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
        className="w-[620px] p-0 bg-card border-border shadow-xl"
        align="end"
        sideOffset={8}
      >
        <div className="flex">
          {/* Left Panel - Absolute Time Range */}
          <div className="w-[280px] border-r border-border p-4 flex flex-col gap-3">
            <h3 className="text-sm font-medium text-foreground">Absolute time range</h3>

            {/* From Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">From</label>
              <div className="relative">
                <Input
                  type="text"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  placeholder="now-1h"
                  className="h-9 text-sm bg-muted/50 border-border pr-9 font-mono"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* To Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">To</label>
              <div className="relative">
                <Input
                  type="text"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  placeholder="now"
                  className="h-9 text-sm bg-muted/50 border-border pr-9 font-mono"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-border"
                onClick={handleCopyRange}
                title="Copy time range"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-border"
                onClick={handlePasteRange}
                title="Paste time range"
              >
                <Clipboard className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleApplyCustomRange}
                className="flex-1 h-9 bg-cyan-600 hover:bg-cyan-700 text-white font-medium"
              >
                Apply time range
              </Button>
            </div>

            {/* Recently Used */}
            {recentRanges.length > 0 && (
              <div className="mt-2 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Recently used absolute ranges</p>
                <div className="space-y-1">
                  {recentRanges.slice(0, 3).map((range, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleRecentRangeSelect(range)}
                      className="w-full text-left text-xs text-foreground hover:text-cyan-400 transition-colors truncate py-1"
                    >
                      {formatDisplayDateTime(range.from)} to {formatDisplayDateTime(range.to)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Timezone */}
            <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Browser Time</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground font-mono">{getTimezoneOffset()}</span>
                <button className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                  Change time settings
                </button>
              </div>
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
            <ScrollArea className="flex-1 max-h-[380px]">
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
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted hover:text-cyan-400 rounded-md transition-colors"
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
