'use client'

import * as d3 from 'd3'
import {useEffect, useMemo, useRef, useState} from 'react'

const WATER_USAGE_API = 'https://bengarlock.com/api/v1/garden/water/water-usage/'
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayStartLocal(d) {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
}

function addLocalDays(d, days) {
    const x = new Date(d)
    x.setDate(x.getDate() + days)
    return x
}

function monthStartLocal(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addLocalMonths(d, months) {
    return new Date(d.getFullYear(), d.getMonth() + months, 1)
}

function isSameLocalDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

function isBeforeLocalDay(a, b) {
    return dayStartLocal(a).getTime() < dayStartLocal(b).getTime()
}

function formatDateParam(d) {
    const x = dayStartLocal(d)
    const pad = (n) => String(n).padStart(2, '0')
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

function formatDayRange(start, end) {
    const fmt = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
    if (!start || !end) return ''
    if (isSameLocalDay(start, end)) return fmt.format(start)
    return `${fmt.format(start)} - ${fmt.format(end)}`
}

function buildWaterUrl(start, end) {
    const q = new URLSearchParams({
        start: formatDateParam(start),
        end: formatDateParam(end),
    })
    return `${WATER_USAGE_API}?${q.toString()}`
}

export default function WaterUsageChart() {
    const firstFetchRef = useRef(true)
    const [payload, setPayload] = useState(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState(null)
    const [selectedDay, setSelectedDay] = useState(() => dayStartLocal(new Date()))
    const [rangeApplied, setRangeApplied] = useState(null)
    const [rangeDraft, setRangeDraft] = useState({start: null, end: null})
    const [rangePickerOpen, setRangePickerOpen] = useState(false)
    const [calendarMonth, setCalendarMonth] = useState(() => monthStartLocal(new Date()))
    const [rangeValidationError, setRangeValidationError] = useState(null)
    const [hoverIdx, setHoverIdx] = useState(null)

    const currentRange = useMemo(() => {
        if (rangeApplied?.start && rangeApplied?.end) {
            return {
                start: dayStartLocal(rangeApplied.start),
                end: dayStartLocal(rangeApplied.end),
            }
        }
        const day = dayStartLocal(selectedDay)
        return {start: day, end: day}
    }, [rangeApplied, selectedDay])

    useEffect(() => {
        let cancelled = false
        const isFirstFetch = firstFetchRef.current

        if (isFirstFetch) {
            setLoading(true)
        } else {
            setRefreshing(true)
        }
        setError(null)

        fetch(buildWaterUrl(currentRange.start, currentRange.end), {cache: 'no-store'})
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.json()
            })
            .then((json) => {
                if (!cancelled) {
                    setPayload(json)
                    firstFetchRef.current = false
                }
            })
            .catch((e) => {
                if (!cancelled) setError(e.message ?? String(e))
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false)
                    setRefreshing(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [currentRange])

    const series = useMemo(() => {
        const rows = payload?.results ?? []
        const points = rows
            .map((row) => {
                const t = new Date(row.start_time)
                const gallons = Number(row.water_volume_gal)
                if (Number.isNaN(t.getTime()) || !Number.isFinite(gallons)) return null
                return {
                    t,
                    gallons,
                    zone: row.zone_name || row.device_name || 'Water',
                    runtime: row.run_time_minutes,
                    status: row.status,
                }
            })
            .filter(Boolean)
        points.sort((a, b) => a.t - b.t)
        return points
    }, [payload])

    const totalGallons = useMemo(
        () => series.reduce((sum, point) => sum + point.gallons, 0),
        [series]
    )

    const selectedDayLabel = useMemo(
        () =>
            new Intl.DateTimeFormat(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            }).format(selectedDay),
        [selectedDay]
    )

    const activeDateLabel =
        rangeApplied?.start && rangeApplied?.end
            ? formatDayRange(rangeApplied.start, rangeApplied.end)
            : selectedDayLabel

    const isSelectedDayToday = isSameLocalDay(selectedDay, new Date())

    const calendarCells = useMemo(() => {
        const firstOfMonth = monthStartLocal(calendarMonth)
        const gridStart = addLocalDays(firstOfMonth, -firstOfMonth.getDay())
        return Array.from({length: 42}, (_, i) => dayStartLocal(addLocalDays(gridStart, i)))
    }, [calendarMonth])

    const calendarMonthLabel = useMemo(
        () =>
            new Intl.DateTimeFormat(undefined, {
                month: 'long',
                year: 'numeric',
            }).format(calendarMonth),
        [calendarMonth]
    )

    const handleDayStep = (days) => {
        setRangeApplied(null)
        setRangePickerOpen(false)
        setRangeValidationError(null)
        setHoverIdx(null)
        setSelectedDay((current) => dayStartLocal(addLocalDays(current, days)))
    }

    const handleTodayClick = () => {
        setRangeApplied(null)
        setRangePickerOpen(false)
        setRangeValidationError(null)
        setHoverIdx(null)
        setSelectedDay(dayStartLocal(new Date()))
    }

    const openRangePicker = () => {
        if (rangePickerOpen) {
            setRangePickerOpen(false)
            setRangeValidationError(null)
            return
        }

        const start = rangeApplied?.start ?? selectedDay
        const end = rangeApplied?.end ?? selectedDay
        setRangeDraft({
            start: dayStartLocal(start),
            end: dayStartLocal(end),
        })
        setCalendarMonth(monthStartLocal(start))
        setRangeValidationError(null)
        setRangePickerOpen(true)
    }

    const handleCalendarDateClick = (day) => {
        const clicked = dayStartLocal(day)
        setRangeValidationError(null)
        setRangeDraft((current) => {
            if (!current.start || current.end) return {start: clicked, end: null}
            if (isBeforeLocalDay(clicked, current.start)) return {start: clicked, end: current.start}
            return {start: current.start, end: clicked}
        })
    }

    const handleApplyRange = () => {
        if (!rangeDraft.start || !rangeDraft.end) {
            setRangeValidationError('Select a start day and an end day.')
            return
        }
        setRangeApplied({
            start: dayStartLocal(rangeDraft.start),
            end: dayStartLocal(rangeDraft.end),
        })
        setHoverIdx(null)
        setRangePickerOpen(false)
        setRangeValidationError(null)
    }

    const margin = {top: 24, right: 24, bottom: 54, left: 74}
    const width = 720
    const height = 330
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const xDomain = useMemo(() => {
        const start = dayStartLocal(currentRange.start)
        const end = addLocalDays(dayStartLocal(currentRange.end), 1)
        return [start, end]
    }, [currentRange])

    const xScale = useMemo(
        () => d3.scaleTime().domain(xDomain).range([0, innerW]),
        [xDomain, innerW]
    )

    const yMax = useMemo(() => Math.max(10, d3.max(series, (d) => d.gallons) ?? 10), [series])

    const yScale = useMemo(
        () => d3.scaleLinear().domain([0, yMax * 1.15]).nice().range([innerH, 0]),
        [innerH, yMax]
    )

    const xSpanMs = xDomain[1].getTime() - xDomain[0].getTime()
    const xTickFormat = xSpanMs > 48 * 60 * 60 * 1000
        ? d3.timeFormat('%b %-d')
        : d3.timeFormat('%-I:%M %p')

    const barWidth = Math.max(8, Math.min(42, innerW / Math.max(series.length, 1) * 0.56))
    const hoverPoint = hoverIdx != null ? series[hoverIdx] : null


    const rangePicker = rangePickerOpen ? (
        <div className="absolute left-1/2 top-28 z-30 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-sky-700/80 bg-blue-950/95 p-3 shadow-2xl ring-1 ring-sky-300/20">
            <div className="mb-3 grid grid-cols-[2rem_1fr_2rem] items-center gap-3">
                <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => addLocalMonths(current, -1))}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-900/80 text-lg leading-none text-sky-100 transition-colors hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    aria-label="Previous month"
                    title="Previous month"
                >
                    ‹
                </button>
                <div className="text-center text-sm font-semibold text-sky-50">
                    {calendarMonthLabel}
                </div>
                <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => addLocalMonths(current, 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-900/80 text-lg leading-none text-sky-100 transition-colors hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    aria-label="Next month"
                    title="Next month"
                >
                    ›
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-sky-300/70">
                {WEEKDAY_LABELS.map((label) => (
                    <div key={label}>{label}</div>
                ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarCells.map((day) => {
                    const inCurrentMonth = day.getMonth() === calendarMonth.getMonth()
                    const isStart = rangeDraft.start && isSameLocalDay(day, rangeDraft.start)
                    const isEnd = rangeDraft.end && isSameLocalDay(day, rangeDraft.end)
                    const isInRange =
                        rangeDraft.start &&
                        rangeDraft.end &&
                        !isBeforeLocalDay(day, rangeDraft.start) &&
                        !isBeforeLocalDay(rangeDraft.end, day)
                    const isToday = isSameLocalDay(day, new Date())
                    const selectedClass =
                        isStart || isEnd
                            ? 'bg-cyan-300 text-blue-950 shadow-sm'
                            : isInRange
                                ? 'bg-cyan-400/25 text-cyan-100'
                                : isToday
                                    ? 'bg-sky-800 text-sky-50'
                                    : 'text-sky-100 hover:bg-sky-900'

                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => handleCalendarDateClick(day)}
                            className={`relative flex aspect-square min-h-9 items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                                inCurrentMonth ? selectedClass : `opacity-45 ${selectedClass}`
                            }`}
                            aria-pressed={Boolean(isStart || isEnd || isInRange)}
                            aria-label={new Intl.DateTimeFormat(undefined, {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                            }).format(day)}
                        >
                            {day.getDate()}
                        </button>
                    )
                })}
            </div>
            {rangeDraft.start && rangeDraft.end && (
                <div className="mt-3 text-center text-sm font-medium text-cyan-100">
                    {formatDayRange(rangeDraft.start, rangeDraft.end)}
                </div>
            )}
            {rangeValidationError && (
                <p className="mt-3 text-center text-sm text-red-200" role="alert">
                    {rangeValidationError}
                </p>
            )}
            <div className="mt-3 flex justify-center gap-2">
                <button
                    type="button"
                    onClick={() => setRangePickerOpen(false)}
                    className="rounded-lg bg-sky-900/80 px-4 py-2 text-sm font-medium text-sky-100 transition-colors hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleApplyRange}
                    className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-blue-950 shadow-sm transition-colors hover:bg-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                    Apply range
                </button>
            </div>
        </div>
    ) : null

    return (
        <div className="relative w-full rounded-lg border border-sky-400/20 bg-blue-950/80 p-4 shadow-xl shadow-blue-950/40">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                    <h3 className="text-lg font-semibold text-sky-50">Water Usage</h3>
                    <p className="mt-1 text-sm text-sky-200">
                        {payload?.count ?? 0} events · {totalGallons.toFixed(1)} gal
                    </p>
                </div>
                <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                    <button
                        type="button"
                        onClick={handleTodayClick}
                        className="h-9 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-blue-950 transition-colors hover:bg-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                        Today
                    </button>
                </div>
            </div>

            <div className="mx-auto mt-4 grid w-full max-w-[28.5rem] grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center justify-center gap-2">
                <button
                    type="button"
                    onClick={() => handleDayStep(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-900/90 text-xl leading-none text-sky-100 transition-colors hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    aria-label="Show previous day"
                    title="Previous day"
                >
                    ‹
                </button>
                <button
                    type="button"
                    onClick={openRangePicker}
                    className="h-9 w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-sky-950/70 px-3 text-center text-sm font-semibold leading-9 text-sky-50 transition-colors hover:bg-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    aria-expanded={rangePickerOpen}
                    aria-label="Choose date range"
                    title={activeDateLabel}
                >
                    {activeDateLabel}
                </button>
                <button
                    type="button"
                    onClick={() => handleDayStep(1)}
                    disabled={!rangeApplied && isSelectedDayToday}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-900/90 text-xl leading-none text-sky-100 transition-colors hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-sky-900/90"
                    aria-label="Show next day"
                    title="Next day"
                >
                    ›
                </button>
            </div>

            {rangePicker}

            {error && !payload && (
                <div className="mt-5 rounded-lg bg-red-950/70 p-5 text-sm text-red-100">
                    Could not load water usage: {error}
                </div>
            )}

            {(loading || payload) && (
                <div className="relative mt-5">
                    {refreshing && (
                        <div
                            className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center"
                            aria-live="polite"
                        >
                            <span className="rounded-md bg-blue-950/95 px-3 py-1 text-xs font-semibold text-cyan-100 shadow-lg ring-1 ring-cyan-300/20">
                                Updating...
                            </span>
                        </div>
                    )}
                    {loading && !payload && (
                        <div
                            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                            aria-live="polite"
                        >
                            <span className="rounded-md bg-blue-950/95 px-3 py-2 text-sm font-semibold text-cyan-100 shadow-lg ring-1 ring-cyan-300/20">
                                Loading water usage...
                            </span>
                        </div>
                    )}
                    {error && payload && (
                        <div
                            className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center"
                            aria-live="polite"
                        >
                            <span className="rounded-md bg-red-950/95 px-3 py-1 text-xs font-semibold text-red-100 shadow-lg ring-1 ring-red-300/20">
                                Could not refresh water usage: {error}
                            </span>
                        </div>
                    )}
                    {!loading && !error && series.length === 0 && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                            <span className="rounded-md bg-blue-950/80 px-3 py-2 text-sm font-semibold text-sky-100 ring-1 ring-cyan-300/20">
                                No water usage records in this range.
                            </span>
                        </div>
                    )}
                    {hoverPoint && (
                        <div className="absolute right-3 top-3 z-10 w-48 rounded-lg border border-cyan-300/30 bg-blue-950/95 px-3 py-2 text-right shadow-lg">
                            <p className="text-xs font-semibold uppercase text-cyan-200">
                                {hoverPoint.zone}
                            </p>
                            <p className="text-lg font-semibold text-white">
                                {hoverPoint.gallons.toFixed(1)} gal
                            </p>
                            <p className="text-xs text-sky-200">
                                {hoverPoint.runtime} min
                            </p>
                            <p className="text-xs text-sky-200">
                                {d3.timeFormat('%b %-d · %-I:%M %p')(hoverPoint.t)}
                            </p>
                        </div>
                    )}
                    <svg
                        width={width}
                        height={height}
                        viewBox={`0 0 ${width} ${height}`}
                        className="block h-auto w-full overflow-visible"
                        role="img"
                        aria-label="Bar chart of water usage in gallons over time"
                    >
                        <g transform={`translate(${margin.left},${margin.top})`}>
                            <defs>
                                <linearGradient id="waterUsageFill" x1="0" y1="1" x2="0" y2="0">
                                    <stop offset="0%" stopColor="#0369a1"/>
                                    <stop offset="52%" stopColor="#0ea5e9"/>
                                    <stop offset="100%" stopColor="#67e8f9"/>
                                </linearGradient>
                            </defs>
                            {yScale.ticks(5).map((tick) => (
                                <line
                                    key={`grid-${tick}`}
                                    x1={0}
                                    x2={innerW}
                                    y1={yScale(tick)}
                                    y2={yScale(tick)}
                                    stroke="#075985"
                                    strokeDasharray="4 6"
                                    strokeOpacity={0.8}
                                />
                            ))}
                            {series.map((d, i) => {
                                const x = xScale(d.t) - barWidth / 2
                                const y = yScale(d.gallons)
                                const h = innerH - y
                                return (
                                    <rect
                                        key={`${d.t.toISOString()}-${i}`}
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={Math.max(1, h)}
                                        rx={3}
                                        fill="url(#waterUsageFill)"
                                        opacity={hoverIdx === i ? 1 : 0.9}
                                        stroke={hoverIdx === i ? '#e0f2fe' : '#0284c7'}
                                        strokeWidth={hoverIdx === i ? 2 : 0.75}
                                        onMouseEnter={() => setHoverIdx(i)}
                                        onMouseLeave={() => setHoverIdx(null)}
                                    />
                                )
                            })}
                            {yScale.ticks(5).map((tick) => (
                                <text
                                    key={`yt-${tick}`}
                                    x={-12}
                                    y={yScale(tick)}
                                    dy="0.35em"
                                    textAnchor="end"
                                    fill="#bae6fd"
                                    fontSize={12}
                                >
                                    {d3.format('.0f')(tick)} gal
                                </text>
                            ))}
                            {xScale.ticks(6).map((t, i) => (
                                <g key={i} transform={`translate(${xScale(t)},${innerH})`}>
                                    <line y1={0} y2={6} stroke="#38bdf8" strokeOpacity={0.7}/>
                                    <text y={22} textAnchor="middle" fill="#bae6fd" fontSize={11}>
                                        {xTickFormat(t)}
                                    </text>
                                </g>
                            ))}
                            <text
                                x={innerW / 2}
                                y={innerH + 44}
                                textAnchor="middle"
                                fill="#7dd3fc"
                                fontSize={12}
                            >
                                Start time
                            </text>
                        </g>
                    </svg>
                </div>
            )}
        </div>
    )
}
