'use client'

import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'

const NOISE_API = 'https://bengarlock.com/api/v1/garden/noise/'
const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'
const NVR_CLIPS_API = `${APP_BASE_PATH}/api/nvr-clips`
const DEFAULT_CAMERA_ID =
    process.env.NEXT_PUBLIC_GARDEN_CAMERA_ID || '677930230377fe03e4001fa9'
const NVR_CLIP_LIVE_GUARD_MS = 15 * 1000

/** Poll interval for live updates */
const REFRESH_MS = 60 * 1000

/** Fixed backend aggregation window — drives `bin_minutes` query and bar width. */
const BIN_MINUTES = 5

/** Bar fill gradient: quiet (low dB / more negative) → loud */
const LEVEL_COLORS = ['#22c55e', '#eab308', '#ef4444', '#a855f7']

/** Fixed RMS chart bounds in dB. */
const Y_DOMAIN = [-60, -10]

/** Push the first color breaks ~5% toward the top of the bar so the green band occupies more vertical space. */
const GRADIENT_GREEN_LIFT_PCT = 10

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

function monthStartLocal(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addLocalMonths(d, months) {
    return new Date(d.getFullYear(), d.getMonth() + months, 1)
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

/** UTC instant as `YYYY-MM-DDTHH:mm:ssZ` (matches binned API query examples). */
function formatUtcISOZ(d) {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
}

function buildNoiseUrl(start, end) {
    const q = new URLSearchParams({
        start: formatUtcISOZ(start),
        end: formatUtcISOZ(end),
        bin_minutes: String(BIN_MINUTES),
    })
    return `${NOISE_API}?${q.toString()}`
}

function clampClipRequestTime(d) {
    const requestedMs = d.getTime()
    if (!Number.isFinite(requestedMs)) return new Date(Date.now() - NVR_CLIP_LIVE_GUARD_MS)
    return new Date(Math.min(requestedMs, Date.now() - NVR_CLIP_LIVE_GUARD_MS))
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Snap hover to the nearest time bucket when within this many SVG units on the x-axis */
const HOVER_SNAP_X_PX = 36
const MIN_ZOOM_DRAG_PX = 16
const MIN_ZOOM_SPAN_MS = BIN_MINUTES * 60 * 1000
const NOISE_CACHE_PREFIX = 'gardenmate:noise:v1:'
const LIVE_CACHE_TTL_MS = REFRESH_MS
const HISTORICAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const LIVE_RANGE_GRACE_MS = REFRESH_MS * 2
const noiseCache = new Map()

function getNoiseCacheEntry(key) {
    if (!key) return null

    const memoryEntry = noiseCache.get(key)
    if (memoryEntry) return memoryEntry

    if (typeof window === 'undefined') return null

    try {
        const stored = window.sessionStorage.getItem(`${NOISE_CACHE_PREFIX}${key}`)
        if (!stored) return null
        const parsed = JSON.parse(stored)
        if (!parsed || !parsed.payload || !Number.isFinite(parsed.cachedAt)) return null
        noiseCache.set(key, parsed)
        return parsed
    } catch {
        return null
    }
}

function setNoiseCacheEntry(key, payload) {
    if (!key || !payload) return

    const entry = {
        cachedAt: Date.now(),
        payload,
    }
    noiseCache.set(key, entry)

    if (typeof window === 'undefined') return

    try {
        window.sessionStorage.setItem(`${NOISE_CACHE_PREFIX}${key}`, JSON.stringify(entry))
    } catch {
        // Browser storage may be full or unavailable; the in-memory cache still helps.
    }
}

function buildNoiseCacheKey(start, end, isLiveRange) {
    const stableEnd = isLiveRange ? 'live' : formatUtcISOZ(end)
    return `${formatUtcISOZ(start)}|${stableEnd}|${BIN_MINUTES}`
}

function isLiveNoiseRange(end) {
    return Date.now() - end.getTime() < LIVE_RANGE_GRACE_MS
}

export default function NoiseLevelChart() {
    const [payload, setPayload] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState(null)
    const [hoverIdx, setHoverIdx] = useState(null)
    const [timeframe, setTimeframe] = useState('day')
    const [selectedDay, setSelectedDay] = useState(() => dayStartLocal(new Date()))
    const [rangeApplied, setRangeApplied] = useState(null)
    const [rangeDraft, setRangeDraft] = useState({ start: null, end: null })
    const [rangePickerOpen, setRangePickerOpen] = useState(false)
    const [calendarMonth, setCalendarMonth] = useState(() => monthStartLocal(new Date()))
    const [zoomApplied, setZoomApplied] = useState(null)
    const [viewHistory, setViewHistory] = useState([])
    const [zoomDrag, setZoomDrag] = useState(null)
    const [rangeValidationError, setRangeValidationError] = useState(null)
    const [clipPanel, setClipPanel] = useState(null)
    const firstFetchEverRef = useRef(true)
    const clipRequestRef = useRef(null)
    const suppressNextClickRef = useRef(false)

    useEffect(() => {
        return () => {
            if (clipRequestRef.current) {
                clipRequestRef.current.abort()
            }
        }
    }, [])

    useEffect(() => {
        let cancelled = false

        const fetchNoise = () => {
            let start
            let end

            if (timeframe === 'zoom') {
                if (!zoomApplied?.start || !zoomApplied?.end) {
                    return
                }
                start = zoomApplied.start
                end = zoomApplied.end
            } else if (timeframe === 'range') {
                if (!rangeApplied?.start || !rangeApplied?.end) {
                    return
                }
                start = dayStartLocal(rangeApplied.start)
                end = addLocalDays(dayStartLocal(rangeApplied.end), 1)
            } else if (timeframe === 'day') {
                const now = new Date()
                start = dayStartLocal(selectedDay)
                const nextDay = addLocalDays(start, 1)
                end = isSameLocalDay(start, now) ? now : nextDay
            }

            const url = buildNoiseUrl(start, end)
            const isLiveRange = isLiveNoiseRange(end)
            const cacheKey = buildNoiseCacheKey(start, end, isLiveRange)
            const cacheTtl = isLiveRange ? LIVE_CACHE_TTL_MS : HISTORICAL_CACHE_TTL_MS
            const cached = getNoiseCacheEntry(cacheKey)
            const isCacheFresh = cached && Date.now() - cached.cachedAt < cacheTtl

            if (cached) {
                setPayload(cached.payload)
                setError(null)
                setLoading(false)
                firstFetchEverRef.current = false
            }

            if (isCacheFresh) {
                setIsRefreshing(false)
                return
            }

            const isFirstEver = firstFetchEverRef.current
            if (isFirstEver) setLoading(true)
            else setIsRefreshing(true)

            fetch(url)
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    return res.json()
                })
                .then((json) => {
                    if (!cancelled) {
                        setNoiseCacheEntry(cacheKey, json)
                        setPayload(json)
                        setError(null)
                        firstFetchEverRef.current = false
                    }
                })
                .catch((e) => {
                    if (!cancelled) {
                        setError(e.message ?? String(e))
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setLoading(false)
                        setIsRefreshing(false)
                    }
                })
        }

        fetchNoise()
        const intervalId = setInterval(fetchNoise, REFRESH_MS)

        return () => {
            cancelled = true
            clearInterval(intervalId)
        }
    }, [timeframe, selectedDay, rangeApplied, zoomApplied])

    const rawSeries = useMemo(() => {
        if (!payload) return []

        const bins = payload.bins
        if (Array.isArray(bins) && bins.length > 0) {
            const pts = bins
                .map((b) => {
                    const tStart = new Date(b.bin_start)
                    const tEnd = new Date(b.bin_end)
                    if (Number.isNaN(tStart.getTime()) || Number.isNaN(tEnd.getTime())) return null
                    const t = new Date((tStart.getTime() + tEnd.getTime()) / 2)
                    const rmsRaw = b.rms != null && b.rms !== '' ? Number(b.rms) : NaN
                    if (!Number.isFinite(rmsRaw)) return null
                    const nRaw = b.count
                    const n =
                        typeof nRaw === 'number' && Number.isFinite(nRaw)
                            ? nRaw
                            : Number(nRaw) || 1
                    return {
                        t,
                        y: rmsRaw,
                        rms: rmsRaw,
                        level: b.level ?? null,
                        n,
                    }
                })
                .filter(Boolean)
            pts.sort((a, b) => a.t - b.t)
            return pts
        }

        const rows = payload.results ?? []
        const pts = rows
            .map((row) => {
                const t = new Date(row.timestamp)
                if (Number.isNaN(t.getTime())) return null
                const rmsRaw = row.rms != null && row.rms !== '' ? Number(row.rms) : NaN
                if (!Number.isFinite(rmsRaw)) return null
                return {
                    t,
                    y: rmsRaw,
                    rms: rmsRaw,
                    level: row.level ?? null,
                    n: 1,
                }
            })
            .filter(Boolean)
        pts.sort((a, b) => a.t - b.t)
        return pts
    }, [payload])

    /** One bar per row; `y` is RMS (dB). */
    const series = useMemo(() => {
        if (rawSeries.length === 0) return []
        return rawSeries.map((p) => ({
            t: p.t,
            y: p.y,
            n: p.n ?? 1,
            rms: p.rms,
            level: p.level,
        }))
    }, [rawSeries])

    const margin = { top: 28, right: 28, bottom: 52, left: 108 }
    const width = 720
    const height = 340
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const xDomain = useMemo(() => {
        if (series.length === 0) return [new Date(), new Date()]
        const t0 = series[0].t
        const t1 = series[series.length - 1].t
        if (t0.getTime() === t1.getTime()) {
            const padMs = (BIN_MINUTES * 60 * 1000) / 2
            return [new Date(t0.getTime() - padMs), new Date(t1.getTime() + padMs)]
        }
        return [t0, t1]
    }, [series])

    const xScale = useMemo(
        () => d3.scaleTime().domain(xDomain).range([0, innerW]),
        [xDomain, innerW]
    )

    const yScale = useMemo(
        () => d3.scaleLinear().domain(Y_DOMAIN).range([innerH, 0]).clamp(true),
        [innerH]
    )

    /** Pixel width of one time bin (bars are centered on each sample time). */
    const barWidthPx = useMemo(() => {
        if (series.length === 0) return 8
        const t0 = series[0].t.getTime()
        const binMs = BIN_MINUTES * 60 * 1000
        return Math.max(4, Math.abs(xScale(new Date(t0 + binMs)) - xScale(new Date(t0))))
    }, [series, xScale])

    /** Bottom of plot area (fixed at -60 dB). */
    const yBaseline = yScale(yScale.domain()[0])

    /** Vertical gradient: quieter RMS (bottom) → louder RMS (top), keyed to y-scale domain. */
    const noiseGradientStops = useMemo(() => {
        const [d0, d1] = yScale.domain()
        const span = d1 - d0 || 1e-6
        const clampPct = (v) => Math.min(100, Math.max(0, v))
        const offsetForRms = (rms) => clampPct(((innerH - yScale(rms)) / innerH) * 100)

        return [
            { offset: '0%', color: LEVEL_COLORS[0] },
            {
                offset: `${clampPct(offsetForRms(d0 + span * 0.33) + GRADIENT_GREEN_LIFT_PCT)}%`,
                color: LEVEL_COLORS[1],
            },
            {
                offset: `${clampPct(offsetForRms(d0 + span * 0.66) + GRADIENT_GREEN_LIFT_PCT)}%`,
                color: LEVEL_COLORS[2],
            },
            { offset: '100%', color: LEVEL_COLORS[3] },
        ]
    }, [innerH, yScale])

    const xDomainSpanMs = useMemo(
        () => Math.max(0, xDomain[1].getTime() - xDomain[0].getTime()),
        [xDomain]
    )

    const xTickFormatFn = useMemo(() => {
        if (xDomainSpanMs > 48 * 60 * 60 * 1000) {
            return d3.timeFormat('%b %-d %-I %p')
        }
        if (xDomainSpanMs > 24 * 60 * 60 * 1000) {
            return d3.timeFormat('%b %-d · %-I:%M %p')
        }
        return d3.timeFormat('%-I:%M %p')
    }, [xDomainSpanMs])

    const xAxisLabel = xDomainSpanMs > 24 * 60 * 60 * 1000 ? 'Date & time' : 'Time of day'

    const formatDbTick = (v) => `${d3.format('.1f')(v)} dB`
    const clampPlotX = (x) => Math.min(innerW, Math.max(0, x))

    const zoomSelection =
        zoomDrag && Math.abs(zoomDrag.currentX - zoomDrag.startX) >= MIN_ZOOM_DRAG_PX
            ? {
                  x: Math.min(zoomDrag.startX, zoomDrag.currentX),
                  width: Math.abs(zoomDrag.currentX - zoomDrag.startX),
                  label: `${xTickFormatFn(xScale.invert(Math.min(zoomDrag.startX, zoomDrag.currentX)))} - ${xTickFormatFn(
                      xScale.invert(Math.max(zoomDrag.startX, zoomDrag.currentX))
                  )}`,
              }
            : null

    const handlePlotMouseMove = (e) => {
        if (series.length === 0) return
        const [innerX, innerY] = d3.pointer(e, e.currentTarget)
        if (zoomDrag) {
            setZoomDrag((current) =>
                current
                    ? {
                          ...current,
                          currentX: clampPlotX(innerX),
                      }
                    : current
            )
            setHoverIdx(null)
            return
        }
        if (innerX < 0 || innerX > innerW || innerY < 0 || innerY > innerH) {
            setHoverIdx(null)
            return
        }
        let best = 0
        let bestDx = Infinity
        for (let i = 0; i < series.length; i++) {
            const dx = Math.abs(xScale(series[i].t) - innerX)
            if (dx < bestDx) {
                bestDx = dx
                best = i
            }
        }
        setHoverIdx(bestDx <= HOVER_SNAP_X_PX ? best : null)
    }

    const handlePlotMouseLeave = () => {
        if (!zoomDrag) setHoverIdx(null)
    }

    const getNearestSeriesIndex = (innerX, innerY) => {
        if (series.length === 0 || innerX < 0 || innerX > innerW || innerY < 0 || innerY > innerH) {
            return null
        }

        let best = 0
        let bestDx = Infinity
        for (let i = 0; i < series.length; i++) {
            const dx = Math.abs(xScale(series[i].t) - innerX)
            if (dx < bestDx) {
                bestDx = dx
                best = i
            }
        }
        return bestDx <= HOVER_SNAP_X_PX ? best : null
    }

    const requestClipForBar = (idx) => {
        const point = series[idx]
        if (!point) return

        if (clipRequestRef.current) {
            clipRequestRef.current.abort()
        }
        requestClipDelete(clipPanel?.filename)

        const controller = new AbortController()
        clipRequestRef.current = controller
        const requestedAt = clampClipRequestTime(point.t).toISOString()

        setClipPanel({
            idx,
            requestedAt,
            status: 'loading',
            clipUrl: null,
            filename: null,
            error: null,
        })

        fetch(NVR_CLIPS_API, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                at: requestedAt,
                camera_id: DEFAULT_CAMERA_ID,
            }),
            signal: controller.signal,
        })
            .then(async (res) => {
                const json = await res.json().catch(() => ({}))
                if (!res.ok) {
                    throw new Error(json.message || json.detail || `HTTP ${res.status}`)
                }
                if (!json.clip_url) {
                    throw new Error('Clip response did not include a URL.')
                }
                return json
            })
            .then((json) => {
                setClipPanel({
                    idx,
                    requestedAt,
                    status: 'ready',
                    clipUrl: json.clip_url,
                    filename: json.filename ?? null,
                    error: null,
                })
            })
            .catch((e) => {
                if (e.name === 'AbortError') return
                setClipPanel({
                    idx,
                    requestedAt,
                    status: 'error',
                    clipUrl: null,
                    filename: null,
                    error: e.message ?? String(e),
                })
            })
            .finally(() => {
                if (clipRequestRef.current === controller) {
                    clipRequestRef.current = null
                }
            })
    }

    const handlePlotClick = (e) => {
        if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false
            return
        }
        const [innerX, innerY] = d3.pointer(e, e.currentTarget)
        const idx = getNearestSeriesIndex(innerX, innerY)
        if (idx == null) return
        requestClipForBar(idx)
    }

    const handlePlotPointerDown = (e) => {
        if (e.button !== 0 || series.length === 0) return
        const [innerX, innerY] = d3.pointer(e, e.currentTarget)
        if (innerX < 0 || innerX > innerW || innerY < 0 || innerY > innerH) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        setZoomDrag({
            startX: clampPlotX(innerX),
            currentX: clampPlotX(innerX),
        })
        setHoverIdx(null)
    }

    const handlePlotPointerMove = (e) => {
        if (!zoomDrag) return
        const [innerX] = d3.pointer(e, e.currentTarget)
        setZoomDrag((current) =>
            current
                ? {
                      ...current,
                      currentX: clampPlotX(innerX),
                  }
                : current
        )
    }

    const handlePlotPointerUp = (e) => {
        if (!zoomDrag) return
        e.currentTarget.releasePointerCapture?.(e.pointerId)

        const [releaseX] = d3.pointer(e, e.currentTarget)
        const startX = clampPlotX(zoomDrag.startX)
        const endX = clampPlotX(releaseX)
        const spanPx = Math.abs(endX - startX)
        setZoomDrag(null)

        if (spanPx < MIN_ZOOM_DRAG_PX) {
            return
        }

        const start = xScale.invert(Math.min(startX, endX))
        const end = xScale.invert(Math.max(startX, endX))
        if (end.getTime() - start.getTime() < MIN_ZOOM_SPAN_MS) {
            return
        }

        suppressNextClickRef.current = true
        resetChartSelection()
        setError(null)
        setRangePickerOpen(false)
        setViewHistory((current) => [
            ...current,
            {
                timeframe,
                selectedDay: new Date(selectedDay),
                rangeApplied: rangeApplied
                    ? {
                          start: new Date(rangeApplied.start),
                          end: new Date(rangeApplied.end),
                      }
                    : null,
                zoomApplied: zoomApplied
                    ? {
                          start: new Date(zoomApplied.start),
                          end: new Date(zoomApplied.end),
                      }
                    : null,
            },
        ])
        setZoomApplied({ start, end })
        setTimeframe('zoom')
    }

    const handlePlotPointerCancel = (e) => {
        e.currentTarget.releasePointerCapture?.(e.pointerId)
        setZoomDrag(null)
    }

    const requestClipDelete = (filename) => {
        if (!filename) return
        fetch(NVR_CLIPS_API, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename }),
            cache: 'no-store',
        }).catch(() => {
            // Best-effort cleanup; the popup should still close even if deletion fails.
        })
    }

    const handleCloseClipPanel = () => {
        if (clipRequestRef.current) {
            clipRequestRef.current.abort()
            clipRequestRef.current = null
        }
        requestClipDelete(clipPanel?.filename)
        setClipPanel(null)
    }

    const resetChartSelection = () => {
        setHoverIdx(null)
        handleCloseClipPanel()
    }

    const handleBackToPreviousView = () => {
        const previous = viewHistory[viewHistory.length - 1]
        if (!previous) return

        resetChartSelection()
        setError(null)
        setRangeValidationError(null)
        setRangePickerOpen(false)
        setViewHistory((current) => current.slice(0, -1))
        setSelectedDay(dayStartLocal(previous.selectedDay))
        setRangeApplied(
            previous.rangeApplied
                ? {
                      start: dayStartLocal(previous.rangeApplied.start),
                      end: dayStartLocal(previous.rangeApplied.end),
                  }
                : null
        )
        setZoomApplied(
            previous.zoomApplied
                ? {
                      start: new Date(previous.zoomApplied.start),
                      end: new Date(previous.zoomApplied.end),
                  }
                : null
        )
        setTimeframe(previous.timeframe)
    }

    const handleDayStep = (days) => {
        resetChartSelection()
        setError(null)
        setTimeframe('day')
        setRangePickerOpen(false)
        setZoomApplied(null)
        setViewHistory([])
        setSelectedDay((current) => dayStartLocal(addLocalDays(current, days)))
    }

    const handleTodayClick = () => {
        resetChartSelection()
        setError(null)
        setRangeValidationError(null)
        setRangePickerOpen(false)
        setZoomApplied(null)
        setViewHistory([])
        setSelectedDay(dayStartLocal(new Date()))
        setTimeframe('day')
    }

    const openRangePicker = () => {
        if (rangePickerOpen) {
            setRangePickerOpen(false)
            setRangeValidationError(null)
            return
        }

        const baseStart = rangeApplied?.start ?? selectedDay
        const baseEnd = rangeApplied?.end ?? selectedDay
        setRangeDraft({
            start: dayStartLocal(baseStart),
            end: dayStartLocal(baseEnd),
        })
        setCalendarMonth(monthStartLocal(baseStart))
        setRangeValidationError(null)
        setRangePickerOpen(true)
    }

    const handleCalendarDateClick = (day) => {
        const clicked = dayStartLocal(day)
        setRangeValidationError(null)
        setRangeDraft((current) => {
            if (!current.start || current.end) {
                return { start: clicked, end: null }
            }
            if (isBeforeLocalDay(clicked, current.start)) {
                return { start: clicked, end: current.start }
            }
            return { start: current.start, end: clicked }
        })
    }

    const handleApplyRange = () => {
        if (!rangeDraft.start || !rangeDraft.end) {
            setRangeValidationError('Select a start day and an end day.')
            return
        }
        resetChartSelection()
        setError(null)
        setRangeValidationError(null)
        setRangeApplied({
            start: dayStartLocal(rangeDraft.start),
            end: dayStartLocal(rangeDraft.end),
        })
        setZoomApplied(null)
        setViewHistory([])
        setTimeframe('range')
        setRangePickerOpen(false)
    }

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

    const rangeLabel = useMemo(
        () =>
            rangeApplied?.start && rangeApplied?.end
                ? formatDayRange(rangeApplied.start, rangeApplied.end)
                : selectedDayLabel,
        [rangeApplied, selectedDayLabel]
    )

    const zoomLabel = useMemo(() => {
        if (!zoomApplied?.start || !zoomApplied?.end) return ''
        const fmt = new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })
        return `${fmt.format(zoomApplied.start)} - ${fmt.format(zoomApplied.end)}`
    }, [zoomApplied])

    const activeDateLabel =
        timeframe === 'zoom' ? zoomLabel : timeframe === 'range' ? rangeLabel : selectedDayLabel

    const isSelectedDayToday = isSameLocalDay(selectedDay, new Date())
    const canGoBack = viewHistory.length > 0

    const calendarCells = useMemo(() => {
        const firstOfMonth = monthStartLocal(calendarMonth)
        const gridStart = addLocalDays(firstOfMonth, -firstOfMonth.getDay())
        return Array.from({ length: 42 }, (_, i) => dayStartLocal(addLocalDays(gridStart, i)))
    }, [calendarMonth])

    const calendarMonthLabel = useMemo(
        () =>
            new Intl.DateTimeFormat(undefined, {
                month: 'long',
                year: 'numeric',
            }).format(calendarMonth),
        [calendarMonth]
    )

    const timeframeControls = (
        <div
            className="mb-4 flex flex-wrap justify-center gap-2"
            role="group"
            aria-label="Time range for noise data"
        >
            <button
                type="button"
                onClick={handleTodayClick}
                aria-pressed={timeframe === 'day' && isSelectedDayToday}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${
                    timeframe === 'day' && isSelectedDayToday
                        ? 'bg-amber-500/90 text-slate-900 shadow-sm'
                        : 'bg-slate-700/80 text-slate-200 hover:bg-slate-600/90'
                }`}
            >
                Today
            </button>
        </div>
    )

    const dayNavigationControls = (
        <div className="mx-auto mb-3 grid w-full max-w-[28.5rem] grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center justify-center gap-2 pt-4">
            {canGoBack ? (
                <button
                    type="button"
                    onClick={handleBackToPreviousView}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/80 text-lg leading-none text-slate-100 transition-colors hover:bg-slate-600/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                    aria-label="Return to previous chart view"
                    title="Back"
                >
                    ←
                </button>
            ) : timeframe === 'day' ? (
                <button
                    type="button"
                    onClick={() => handleDayStep(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/80 text-xl leading-none text-slate-100 transition-colors hover:bg-slate-600/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                    aria-label="Show previous day"
                    title="Previous day"
                >
                    ‹
                </button>
            ) : (
                <span className="h-9 w-9" aria-hidden="true" />
            )}
            <button
                type="button"
                onClick={openRangePicker}
                className="h-9 w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-3 text-center text-sm font-semibold leading-9 text-slate-100 transition-colors hover:bg-slate-700/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                aria-expanded={rangePickerOpen}
                aria-label="Choose date range"
                title={activeDateLabel}
            >
                {activeDateLabel}
            </button>
            {timeframe === 'day' ? (
                <button
                    type="button"
                    onClick={() => handleDayStep(1)}
                    disabled={isSelectedDayToday}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/80 text-xl leading-none text-slate-100 transition-colors hover:bg-slate-600/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-700/80"
                    aria-label="Show next day"
                    title="Next day"
                >
                    ›
                </button>
            ) : (
                <span className="h-9 w-9" aria-hidden="true" />
            )}
        </div>
    )

    const rangePicker = rangePickerOpen ? (
        <div className="absolute left-1/2 top-28 z-30 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-slate-700/80 bg-slate-900/95 p-3 shadow-2xl ring-1 ring-black/30">
            <div className="mb-3 grid grid-cols-[2rem_1fr_2rem] items-center gap-3">
                <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => addLocalMonths(current, -1))}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-700/80 text-lg leading-none text-slate-100 transition-colors hover:bg-slate-600/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                    aria-label="Previous month"
                    title="Previous month"
                >
                    ‹
                </button>
                <div className="text-center text-sm font-semibold text-slate-100">
                    {calendarMonthLabel}
                </div>
                <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => addLocalMonths(current, 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-700/80 text-lg leading-none text-slate-100 transition-colors hover:bg-slate-600/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                    aria-label="Next month"
                    title="Next month"
                >
                    ›
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-500">
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
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : isInRange
                              ? 'bg-amber-500/25 text-amber-100'
                              : isToday
                                ? 'bg-slate-700/80 text-slate-100'
                                : 'text-slate-200 hover:bg-slate-700/80'

                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => handleCalendarDateClick(day)}
                            className={`relative flex aspect-square min-h-9 items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${
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
                <div className="mt-3 text-center text-sm font-medium text-amber-200">
                    {formatDayRange(rangeDraft.start, rangeDraft.end)}
                </div>
            )}
            {rangeValidationError && (
                <p className="mt-3 text-center text-sm text-red-300" role="alert">
                    {rangeValidationError}
                </p>
            )}
            <div className="mt-3 flex justify-center gap-2">
                <button
                    type="button"
                    onClick={() => setRangePickerOpen(false)}
                    className="rounded-lg bg-slate-700/80 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleApplyRange}
                    className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                >
                    Apply range
                </button>
            </div>
        </div>
    ) : null

    if (loading && !payload) {
        return (
            <div className="relative w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 shadow-xl">
                <h2 className="mb-1 text-lg font-semibold tracking-wide text-slate-100">
                    Noise Level
                </h2>
                {dayNavigationControls}
                {timeframeControls}
                {rangePicker}
                <p className="text-slate-300">Loading noise levels…</p>
            </div>
        )
    }

    if (error && !payload) {
        return (
            <div className="relative w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 shadow-xl">
                <h2 className="mb-1 text-lg font-semibold tracking-wide text-slate-100">
                    Noise Level
                </h2>
                {dayNavigationControls}
                {timeframeControls}
                {rangePicker}
                <p className="text-red-300">Could not load noise data: {error}</p>
            </div>
        )
    }

    if (rawSeries.length === 0) {
        return (
            <div className="relative w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 shadow-xl">
                <h2 className="mb-1 text-lg font-semibold tracking-wide text-slate-100">
                    Noise Level
                </h2>
                {dayNavigationControls}
                {timeframeControls}
                {rangePicker}
                <p className="text-slate-400">No RMS readings in this response.</p>
            </div>
        )
    }

    const selectedPoint =
        clipPanel && series[clipPanel.idx] ? series[clipPanel.idx] : null

    const clipPanelStyle = selectedPoint
        ? {
              left: `${((margin.left + xScale(selectedPoint.t)) / width) * 100}%`,
              top: `${(Math.max(8, margin.top + yScale(selectedPoint.y) - 178) / height) * 100}%`,
          }
        : null

    const hoverPoint = hoverIdx != null && series[hoverIdx] ? series[hoverIdx] : null

    return (
        <div className="relative w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold tracking-wide text-slate-100">
                Noise Level
            </h2>
            {dayNavigationControls}
            {timeframeControls}
            {rangePicker}
            {hoverPoint && (
                <div className="absolute right-6 top-32 z-10 w-44 rounded-lg border border-slate-700/80 bg-slate-950/85 px-3 py-2 text-right shadow-lg ring-1 ring-black/20">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        RMS
                    </p>
                    <p className="text-sm font-semibold text-slate-100">
                        {hoverPoint.rms != null && Number.isFinite(hoverPoint.rms)
                            ? `${Number(hoverPoint.rms).toFixed(2)} dB`
                            : '—'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                        {xTickFormatFn(hoverPoint.t)}
                    </p>
                </div>
            )}
            {error && payload && (
                <p className="mb-3 text-sm text-red-300">Could not refresh noise data: {error}</p>
            )}
            <div className="relative">
                {isRefreshing && (
                    <div
                        className="pointer-events-none absolute inset-x-0 top-8 z-10 flex justify-center rounded-lg"
                        aria-live="polite"
                    >
                        <span className="rounded-md bg-slate-900/85 px-2 py-1 text-xs text-slate-200 shadow">
                            Updating…
                        </span>
                    </div>
                )}
                {clipPanel && selectedPoint && clipPanelStyle && (
                    <div
                        className="absolute z-20 w-64 -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-950/95 p-3 text-left text-slate-100 shadow-2xl ring-1 ring-black/30"
                        style={clipPanelStyle}
                    >
                        <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                                    Noise clip
                                </p>
                                <p className="text-xs text-slate-400">
                                    {xTickFormatFn(new Date(clipPanel.requestedAt))}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseClipPanel}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                aria-label="Close clip"
                            >
                                ×
                            </button>
                        </div>
                        {clipPanel.status === 'loading' && (
                            <div className="flex h-24 items-center justify-center rounded-md bg-slate-900 text-sm text-slate-300">
                                Fetching clip…
                            </div>
                        )}
                        {clipPanel.status === 'error' && (
                            <div className="rounded-md bg-red-950/50 p-2 text-sm text-red-200">
                                {clipPanel.error}
                            </div>
                        )}
                        {clipPanel.status === 'ready' && clipPanel.clipUrl && (
                            <video
                                key={clipPanel.clipUrl}
                                src={clipPanel.clipUrl}
                                controls
                                playsInline
                                preload="metadata"
                                className="aspect-video w-full rounded-md bg-black"
                            />
                        )}
                    </div>
                )}
                <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className="block h-auto w-full overflow-visible"
                role="img"
                aria-label="Bar chart of RMS noise in dB versus time of day"
            >
                <g transform={`translate(${margin.left},${margin.top})`}>
                    <defs>
                        <linearGradient
                            id="noiseBarFill"
                            gradientUnits="userSpaceOnUse"
                            x1={0}
                            y1={innerH}
                            x2={0}
                            y2={0}
                        >
                            {noiseGradientStops.map((s, i) => (
                                <stop key={i} offset={s.offset} stopColor={s.color} />
                            ))}
                        </linearGradient>
                    </defs>
                    {yScale.ticks(6).map((tick) => (
                        <line
                            key={`grid-${tick}`}
                            x1={0}
                            x2={innerW}
                            y1={yScale(tick)}
                            y2={yScale(tick)}
                            stroke="#334155"
                            strokeDasharray="4 6"
                            strokeOpacity={0.85}
                        />
                    ))}
                    {series.map((d, i) => {
                        const cx = xScale(d.t)
                        const x = cx - barWidthPx / 2
                        const yTop = yScale(d.y)
                        const h = Math.max(0, yBaseline - yTop)
                        return (
                            <rect
                                key={`bar-${i}`}
                                x={x}
                                y={yTop}
                                width={barWidthPx}
                                height={h}
                                fill="url(#noiseBarFill)"
                                rx={2}
                                opacity={0.92}
                                stroke={clipPanel?.idx === i ? '#f59e0b' : hoverIdx === i ? '#f8fafc' : '#0f172a'}
                                strokeWidth={clipPanel?.idx === i ? 2 : hoverIdx === i ? 1.5 : 0.5}
                                strokeOpacity={clipPanel?.idx === i || hoverIdx === i ? 1 : 0.35}
                            />
                        )
                    })}
	                    {hoverIdx != null && series[hoverIdx] && (
	                        <g pointerEvents="none">
                            <line
                                x1={xScale(series[hoverIdx].t)}
                                x2={xScale(series[hoverIdx].t)}
                                y1={0}
                                y2={innerH}
                                stroke="#94a3b8"
                                strokeDasharray="4 4"
                                strokeOpacity={0.9}
                            />
		                        </g>
		                    )}
                    {zoomSelection && (
                        <g pointerEvents="none">
                            <rect
                                x={zoomSelection.x}
                                y={0}
                                width={zoomSelection.width}
                                height={innerH}
                                fill="#f59e0b"
                                fillOpacity={0.18}
                                stroke="#fbbf24"
                                strokeWidth={1.5}
                                strokeDasharray="6 4"
                            />
                            <text
                                x={zoomSelection.x + zoomSelection.width / 2}
                                y={16}
                                textAnchor="middle"
                                fill="#fde68a"
                                fontSize={11}
                                fontWeight={700}
                            >
                                {zoomSelection.label}
                            </text>
                        </g>
                    )}
	                    <rect
	                        x={0}
	                        y={0}
	                        width={innerW}
	                        height={innerH}
	                        fill="transparent"
	                        cursor={zoomDrag ? 'col-resize' : 'crosshair'}
	                        onMouseMove={handlePlotMouseMove}
	                        onMouseLeave={handlePlotMouseLeave}
	                        onClick={handlePlotClick}
                            onPointerDown={handlePlotPointerDown}
                            onPointerMove={handlePlotPointerMove}
                            onPointerUp={handlePlotPointerUp}
                            onPointerCancel={handlePlotPointerCancel}
                            style={{ touchAction: 'none' }}
	                    />
                    {yScale.ticks(6).map((tick) => (
                        <text
                            key={`yt-${tick}`}
                            x={-12}
                            y={yScale(tick)}
                            dy="0.35em"
                            textAnchor="end"
                            fill="#cbd5e1"
                            fontSize={12}
                        >
                            {formatDbTick(tick)}
                        </text>
                    ))}
                    {xScale.ticks(6).map((t, i) => (
                        <g key={i} transform={`translate(${xScale(t)},${innerH})`}>
                            <line y1={0} y2={6} stroke="#64748b" />
                            <text y={22} textAnchor="middle" fill="#94a3b8" fontSize={11}>
                                {xTickFormatFn(t)}
                            </text>
                        </g>
                    ))}
                    <text
                        x={innerW / 2}
                        y={innerH + 42}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize={12}
                    >
                        {xAxisLabel}
                    </text>
                </g>
            </svg>
            </div>
        </div>
    )
}
