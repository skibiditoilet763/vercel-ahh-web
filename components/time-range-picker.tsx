"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { CalendarIcon, Clock, Search, ChevronDown, Copy, Clipboard, GitCompare, Bookmark, BookmarkPlus, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TimeRange {
  from: number
  to: number
}

interface QuickRange {
  label: string
  getValue: () => { from: number; to: number }
  category: "relative" | "last" | "previous"
}

// ============== TIME HELPERS ==============

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const startOfWeek = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const startOfMonth = () => {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const startOfYear = () => {
  const d = new Date()
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const startOfFiscalQuarter = () => {
  const d = new Date()
  const quarter = Math.floor(d.getMonth() / 3)
  d.setMonth(quarter * 3, 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const startOfFiscalYear = () => startOfYear()

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

// ============== QUICK RANGES ==============

const QUICK_RANGES: QuickRange[] = [
  // Relative
  { label: "Today", getValue: () => ({ from: startOfToday(), to: Date.now() }), category: "relative" },
  { label: "Today so far", getValue: () => ({ from: startOfToday(), to: Date.now() }), category: "relative" },
  { label: "This week", getValue: () => ({ from: startOfWeek(), to: Date.now() }), category: "relative" },
  { label: "This week so far", getValue: () => ({ from: startOfWeek(), to: Date.now() }), category: "relative" },
  { label: "This month", getValue: () => ({ from: startOfMonth(), to: Date.now() }), category: "relative" },
  { label: "This month so far", getValue: () => ({ from: startOfMonth(), to: Date.now() }), category: "relative" },
  { label: "This year", getValue: () => ({ from: startOfYear(), to: Date.now() }), category: "relative" },
  { label: "This year so far", getValue: () => ({ from: startOfYear(), to: Date.now() }), category: "relative" },
  { label: "This fiscal quarter", getValue: () => ({ from: startOfFiscalQuarter(), to: Date.now() }), category: "relative" },
  { label: "This fiscal quarter so far", getValue: () => ({ from: startOfFiscalQuarter(), to: Date.now() }), category: "relative" },
  { label: "This fiscal year", getValue: () => ({ from: startOfFiscalYear(), to: Date.now() }), category: "relative" },
  { label: "This fiscal year so far", getValue: () => ({ from: startOfFiscalYear(), to: Date.now() }), category: "relative" },
  
  // Last X
  { label: "Last 5 minutes", getValue: () => ({ from: Date.now() - 5 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 15 minutes", getValue: () => ({ from: Date.now() - 15 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 30 minutes", getValue: () => ({ from: Date.now() - 30 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 1 hour", getValue: () => ({ from: Date.now() - 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 3 hours", getValue: () => ({ from: Date.now() - 3 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 6 hours", getValue: () => ({ from: Date.now() - 6 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 12 hours", getValue: () => ({ from: Date.now() - 12 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 24 hours", getValue: () => ({ from: Date.now() - 24 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 2 days", getValue: () => ({ from: Date.now() - 2 * 24 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 7 days", getValue: () => ({ from: Date.now() - 7 * 24 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 30 days", getValue: () => ({ from: Date.now() - 30 * 24 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 90 days", getValue: () => ({ from: Date.now() - 90 * 24 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 6 months", getValue: () => ({ from: Date.now() - 180 * 24 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 1 year", getValue: () => ({ from: Date.now() - 365 * 24 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 2 years", getValue: () => ({ from: Date.now() - 2 * 365 * 24 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 5 years", getValue: () => ({ from: Date.now() - 5 * 365 * 24 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  { label: "Last 10 years", getValue: () => ({ from: Date.now() - 10 * 365 * 24 * 60 * 60 * 1000, to: Date.now() }), category: "last" },
  
  // Previous
  { label: "Yesterday", getValue: () => ({ from: startOfYesterday(), to: endOfYesterday() }), category: "previous" },
  { label: "Day before yesterday", getValue: () => dayBeforeYesterday(), category: "previous" },
  { label: "This day last week", getValue: () => thisDayLastWeek(), category: "previous" },
  { label: "Previous week", getValue: () => ({ from: startOfPreviousWeek(), to: endOfPreviousWeek() }), category: "previous" },
  { label: "Previous month", getValue: () => ({ from: startOfPreviousMonth(), to: endOfPreviousMonth() }), category: "previous" },
  { label: "Previous fiscal quarter", getValue: () => ({ from: startOfPreviousFiscalQuarter(), to: endOfPreviousFiscalQuarter() }), category: "previous" },
  { label: "Previous year", getValue: () => ({ from: startOfPreviousYear(), to: endOfPreviousYear() }), category: "previous" },
  { label: "Previous fiscal year", getValue: () => ({ from: startOfPreviousFiscalYear(), to: endOfPreviousFiscalYear() }), category: "previous" },
]

// ============== TIMEZONES ==============

const TIMEZONES = [
  { value: "local", label: "Browser Time", offset: () => -new Date().getTimezoneOffset() },
  { value: "UTC", label: "UTC", offset: () => 0 },
  { value: "America/New_York", label: "New York (EST/EDT)", offset: () => -300 },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)", offset: () => -480 },
  { value: "America/Chicago", label: "Chicago (CST/CDT)", offset: () => -360 },
  { value: "Europe/London", label: "London (GMT/BST)", offset: () => 0 },
  { value: "Europe/Paris", label: "Paris (CET/CEST)", offset: () => 60 },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)", offset: () => 60 },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", offset: () => 540 },
  { value: "Asia/Shanghai", label: "Shanghai (CST)", offset: () => 480 },
  { value: "Asia/Singapore", label: "Singapore (SGT)", offset: () => 480 },
  { value: "Asia/Bangkok", label: "Bangkok (ICT)", offset: () => 420 },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)", offset: () => 600 },
]

// ============== UTILITIES ==============

function parseRelativeTime(expr: string): number | null {
  const trimmed = expr.trim().toLowerCase()
  
  if (trimmed === "now") return Date.now()
  
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

function getTimezoneOffset(): string {
  const offset = new Date().getTimezoneOffset()
  const hours = Math.abs(Math.floor(offset / 60))
  const minutes = Math.abs(offset % 60)
  const sign = offset <= 0 ? "+" : "-"
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

// ============== STORAGE KEYS ==============

const RECENT_RANGES_KEY = "grafana-time-picker-recent-ranges"
const BOOKMARKS_KEY = "grafana-time-picker-bookmarks"

interface RecentRange {
  from: number
  to: number
  label: string
  timestamp: number
}

interface Bookmark {
  id: string
  label: string
  from: string
  to: string
}

// ============== COMPONENT ==============

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
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [selectedTimezone, setSelectedTimezone] = useState("local")
  const [compareMode, setCompareMode] = useState(false)
  const [showCalendarFrom, setShowCalendarFrom] = useState(false)
  const [showCalendarTo, setShowCalendarTo] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)

  // Live preview of what expressions resolve to
  const fromPreview = useMemo(() => {
    const parsed = parseRelativeTime(fromInput)
    if (parsed) return formatDisplayDateTime(parsed)
    const date = Date.parse(fromInput)
    if (!isNaN(date)) return formatDisplayDateTime(date)
    return null
  }, [fromInput])

  const toPreview = useMemo(() => {
    const parsed = parseRelativeTime(toInput)
    if (parsed) return formatDisplayDateTime(parsed)
    const date = Date.parse(toInput)
    if (!isNaN(date)) return formatDisplayDateTime(date)
    return null
  }, [toInput])

  // Load from localStorage
  useEffect(() => {
    try {
      const storedRecent = localStorage.getItem(RECENT_RANGES_KEY)
      if (storedRecent) setRecentRanges(JSON.parse(storedRecent))
      
      const storedBookmarks = localStorage.getItem(BOOKMARKS_KEY)
      if (storedBookmarks) setBookmarks(JSON.parse(storedBookmarks))
    } catch {
      // Ignore
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault()
          setOpen(true)
        }
      }
      if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  const saveRecentRange = (from: number, to: number, label: string) => {
    const newRange: RecentRange = { from, to, label, timestamp: Date.now() }
    const updated = [newRange, ...recentRanges.filter(r => 
      !(r.from === from && r.to === to)
    )].slice(0, 5)
    setRecentRanges(updated)
    try {
      localStorage.setItem(RECENT_RANGES_KEY, JSON.stringify(updated))
    } catch {
      // Ignore
    }
  }

  const addBookmark = () => {
    const newBookmark: Bookmark = {
      id: Date.now().toString(),
      label: `${fromInput} to ${toInput}`,
      from: fromInput,
      to: toInput,
    }
    const updated = [...bookmarks, newBookmark]
    setBookmarks(updated)
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated))
    } catch {
      // Ignore
    }
  }

  const removeBookmark = (id: string) => {
    const updated = bookmarks.filter(b => b.id !== id)
    setBookmarks(updated)
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated))
    } catch {
      // Ignore
    }
  }

  const applyBookmark = (bookmark: Bookmark) => {
    setFromInput(bookmark.from)
    setToInput(bookmark.to)
  }

  const filteredRanges = useMemo(() => {
    if (!searchQuery.trim()) return QUICK_RANGES
    const query = searchQuery.toLowerCase()
    return QUICK_RANGES.filter((range) =>
      range.label.toLowerCase().includes(query)
    )
  }, [searchQuery])

  const handleQuickRangeSelect = (range: QuickRange) => {
    const { from, to } = range.getValue()
    
    if (compareMode) {
      const rangeDuration = to - from
      const compareFrom = from - rangeDuration
      const compareTo = to - rangeDuration
      // For now, just apply the selected range (compare visualization would be in the chart)
      onTimeRangeChange({ from, to }, `${range.label} (vs previous)`)
    } else {
      onTimeRangeChange({ from, to }, range.label)
    }
    
    setFromInput(toRelativeExpression(from))
    setToInput("now")
    saveRecentRange(from, to, range.label)
    setOpen(false)
  }

  const handleRecentRangeSelect = (range: RecentRange) => {
    onTimeRangeChange({ from: range.from, to: range.to }, range.label)
    setFromInput(toRelativeExpression(range.from))
    setToInput(toRelativeExpression(range.to))
    setOpen(false)
  }

  const handleApplyCustomRange = useCallback(() => {
    let from = parseRelativeTime(fromInput)
    let to = parseRelativeTime(toInput)
    
    if (from === null) {
      const parsed = Date.parse(fromInput)
      if (!isNaN(parsed)) from = parsed
    }
    if (to === null) {
      const parsed = Date.parse(toInput)
      if (!isNaN(parsed)) to = parsed
    }
    
    if (from === null || to === null) {
      setInputError("Invalid date format. Use 'now-1h' or 'YYYY-MM-DD HH:mm:ss'")
      return
    }
    
    if (from >= to) {
      setInputError("'From' must be before 'To'")
      return
    }
    
    setInputError(null)
    onTimeRangeChange({ from, to }, "Custom")
    saveRecentRange(from, to, `${formatDisplayDateTime(from)} to ${formatDisplayDateTime(to)}`)
    setOpen(false)
  }, [fromInput, toInput, onTimeRangeChange])

  const handleCopyRange = async () => {
    const text = `${fromInput} to ${toInput}`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback
    }
  }

  const handlePasteRange = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const match = text.match(/(.+)\s+to\s+(.+)/)
      if (match) {
        setFromInput(match[1].trim())
        setToInput(match[2].trim())
      }
    } catch {
      // Ignore
    }
  }

  const handleCalendarSelectFrom = (date: Date | undefined) => {
    if (date) {
      setFromInput(formatDisplayDateTime(date.getTime()))
      setShowCalendarFrom(false)
    }
  }

  const handleCalendarSelectTo = (date: Date | undefined) => {
    if (date) {
      const d = new Date(date)
      d.setHours(23, 59, 59, 999)
      setToInput(formatDisplayDateTime(d.getTime()))
      setShowCalendarTo(false)
    }
  }

  const syncInputsWithRange = () => {
    setFromInput(toRelativeExpression(timeRange.from))
    setToInput(toRelativeExpression(timeRange.to))
    setInputError(null)
  }

  const currentTimezone = TIMEZONES.find(tz => tz.value === selectedTimezone) || TIMEZONES[0]

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (isOpen) syncInputsWithRange()
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 gap-2 px-3 font-normal bg-muted/50 border-border hover:bg-muted hover:border-cyan-500/50 transition-all duration-200",
            className
          )}
        >
          <Clock className="h-4 w-4 text-cyan-400" />
          <span className="text-sm">{formatTimeRangeDisplay(timeRange.from, timeRange.to)}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[680px] p-0 bg-card border-border shadow-2xl overflow-hidden"
        align="end"
        sideOffset={8}
      >
        <div className="flex h-[460px]">
          {/* Left Panel - Absolute Time Range */}
          <div className="w-[300px] border-r border-border flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 pr-2">
              <div className="p-4 pr-2 space-y-3">
                <h3 className="text-sm font-medium text-foreground">Absolute time range</h3>

                {/* From Input with Calendar */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">From</label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={fromInput}
                      onChange={(e) => { setFromInput(e.target.value); setInputError(null) }}
                      placeholder="now-1h"
                      className="h-9 text-sm bg-muted/50 border-border pr-9 font-mono"
                    />
                    <button 
                      onClick={() => setShowCalendarFrom(!showCalendarFrom)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                    >
                      <CalendarIcon className="h-4 w-4 text-muted-foreground hover:text-cyan-400 transition-colors" />
                    </button>
                  </div>
                  {/* Live Preview */}
                  {fromPreview && (
                    <p className="text-xs text-cyan-400/70 font-mono">{fromPreview}</p>
                  )}
                  {/* Calendar Popover */}
                  {showCalendarFrom && (
                    <div className="absolute z-50 mt-1 bg-card border border-border rounded-lg shadow-xl p-2">
                      <Calendar
                        mode="single"
                        selected={fromPreview ? new Date(fromPreview) : undefined}
                        onSelect={handleCalendarSelectFrom}
                        initialFocus
                      />
                    </div>
                  )}
                </div>

                {/* To Input with Calendar */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">To</label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={toInput}
                      onChange={(e) => { setToInput(e.target.value); setInputError(null) }}
                      placeholder="now"
                      className="h-9 text-sm bg-muted/50 border-border pr-9 font-mono"
                    />
                    <button 
                      onClick={() => setShowCalendarTo(!showCalendarTo)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                    >
                      <CalendarIcon className="h-4 w-4 text-muted-foreground hover:text-cyan-400 transition-colors" />
                    </button>
                  </div>
                  {/* Live Preview */}
                  {toPreview && (
                    <p className="text-xs text-cyan-400/70 font-mono">{toPreview}</p>
                  )}
                  {/* Calendar Popover */}
                  {showCalendarTo && (
                    <div className="absolute z-50 mt-1 bg-card border border-border rounded-lg shadow-xl p-2">
                      <Calendar
                        mode="single"
                        selected={toPreview ? new Date(toPreview) : undefined}
                        onSelect={handleCalendarSelectTo}
                        initialFocus
                      />
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {inputError && (
                  <p className="text-xs text-red-400">{inputError}</p>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-border hover:border-cyan-500/50"
                    onClick={handleCopyRange}
                    title="Copy time range"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-border hover:border-cyan-500/50"
                    onClick={handlePasteRange}
                    title="Paste time range"
                  >
                    <Clipboard className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-border hover:border-cyan-500/50"
                    onClick={addBookmark}
                    title="Bookmark this range"
                  >
                    <BookmarkPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleApplyCustomRange}
                    className="flex-1 h-9 bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors"
                  >
                    Apply time range
                  </Button>
                </div>

                {/* Compare Mode Toggle */}
                <button
                  onClick={() => setCompareMode(!compareMode)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md border transition-colors",
                    compareMode 
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-400" 
                      : "border-border hover:border-cyan-500/50 text-muted-foreground"
                  )}
                >
                  <GitCompare className="h-4 w-4" />
                  <span className="text-sm">Compare with previous period</span>
                </button>

                {/* Recently Used */}
                {recentRanges.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Recently used</p>
                    <div className="space-y-1">
                      {recentRanges.slice(0, 3).map((range, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleRecentRangeSelect(range)}
                          className="w-full text-left text-xs text-foreground hover:text-cyan-400 transition-colors truncate py-1.5 px-2 rounded hover:bg-muted"
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bookmarks */}
                {bookmarks.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Bookmark className="h-3 w-3" /> Bookmarks
                    </p>
                    <div className="space-y-1">
                      {bookmarks.map((bookmark) => (
                        <div
                          key={bookmark.id}
                          className="flex items-center gap-2 group"
                        >
                          <button
                            onClick={() => applyBookmark(bookmark)}
                            className="flex-1 text-left text-xs text-foreground hover:text-cyan-400 transition-colors truncate py-1.5 px-2 rounded hover:bg-muted"
                          >
                            {bookmark.label}
                          </button>
                          <button
                            onClick={() => removeBookmark(bookmark.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
                          >
                            <X className="h-3 w-3 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timezone & Settings */}
                <div className="pt-3 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{currentTimezone.label}</span>
                    <span className="text-xs text-foreground font-mono">{getTimezoneOffset()}</span>
                  </div>
                  
                  {/* Timezone Selector */}
                  <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Change timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <ScrollBar className="w-2 bg-muted/30" />
            </ScrollArea>
          </div>

          {/* Right Panel - Quick Ranges */}
          <div className="flex-1 flex flex-col overflow-hidden">
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
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-muted/30 scrollbar-thumb-muted-foreground/50 hover:scrollbar-thumb-muted-foreground/70 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-muted/30 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/70">
              <div className="p-1 pr-2">
                {filteredRanges.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No matching ranges found
                  </p>
                ) : (
                  filteredRanges.map((range) => (
                    <button
                      key={range.label}
                      onClick={() => handleQuickRangeSelect(range)}
                      className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-muted hover:text-cyan-400 rounded-md transition-colors"
                    >
                      {range.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
