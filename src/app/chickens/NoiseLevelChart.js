'use client'

import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'

const NOISE_API = 'https://bengarlock.com/api/v1/garden/noise/'
const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'
const NVR_CLIPS_API = `${APP_BASE_PATH}/api/nvr-clips`
const CHICKEN_AUDIO_EVENTS_API = `${APP_BASE_PATH}/api/chicken-audio-events`
const CHICKEN_AUDIO_SUMMARY_API = `${CHICKEN_AUDIO_EVENTS_API}/summary`
const CHICKEN_AUDIO_RETRAIN_API = `${CHICKEN_AUDIO_EVENTS_API}/retrain`
const DEFAULT_CAMERA_ID =
    process.env.NEXT_PUBLIC_GARDEN_CAMERA_ID || '677930230377fe03e4001fa9'
const NOISE_BIN_SOURCE = 'gardenmate-noise-bin'
const NVR_CLIP_LIVE_GUARD_MS = 15 * 1000
const CLIP_PANEL_WIDTH_PX = 256
const CLIP_PANEL_GUTTER_PX = 12

/** Poll interval for live updates */
const REFRESH_MS = 60 * 1000

/** Fixed backend aggregation window — drives `bin_minutes` query and bar width. */
const BIN_MINUTES = 5
const BIN_MS = BIN_MINUTES * 60 * 1000
const REVIEW_MATCH_TOLERANCE_MS = BIN_MS / 2 + 1000

/** Bar fill gradient: quiet (low dB / more negative) → loud */
const LEVEL_COLORS = ['#22c55e', '#eab308', '#f97316', '#a855f7']
const HUMAN_LABEL_COLORS = {
    chicken: '#ef4444',
    not_chicken: '#64748b',
    unsure: '#64748b',
    ignored: '#64748b',
}
const AI_CHICKEN_STROKE = '#f59e0b'
const MIN_PREDICTED_CHICKEN_CONFIDENCE = 0.9

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

function clampNumber(value, min, max) {
    if (max < min) return (min + max) / 2
    return Math.min(max, Math.max(min, value))
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

function buildChickenAudioEventsUrl(start, end) {
    const q = new URLSearchParams({
        start: formatUtcISOZ(start),
        end: formatUtcISOZ(end),
        noise_chart: 'true',
        bin_minutes: String(BIN_MINUTES),
        limit: '2000',
    })
    return `${CHICKEN_AUDIO_EVENTS_API}?${q.toString()}`
}

function eventLabelUrl(eventId) {
    return `${CHICKEN_AUDIO_EVENTS_API}/${eventId}/human-label`
}

function audioEventTimeKey(value) {
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
    if (!Number.isFinite(time)) return null
    return String(Math.round(time / 1000))
}

function audioEventTimeMs(event) {
    const time = event?.recorded_at ? new Date(event.recorded_at).getTime() : NaN
    return Number.isFinite(time) ? time : null
}

function audioEventBinRangeMs(event) {
    const start = event?.bin_start ? new Date(event.bin_start).getTime() : NaN
    const end = event?.bin_end ? new Date(event.bin_end).getTime() : NaN
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    return { start, end }
}

function humanLabelColor(humanLabel) {
    return HUMAN_LABEL_COLORS[humanLabel] ?? null
}

function predictionConfidence(event) {
    const confidence = Number(event?.predicted_confidence)
    return Number.isFinite(confidence) ? confidence : null
}

function isHighConfidencePredictedChicken(event) {
    const confidence = predictionConfidence(event)
    return event?.predicted_label === 'chicken' && confidence != null && confidence >= MIN_PREDICTED_CHICKEN_CONFIDENCE
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
const CHICKEN_EVENTS_FOR_MAX_SCORE = 9
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

function extractNoisePoints(noisePayload) {
    if (!noisePayload) return []

    const bins = noisePayload.bins
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

    const rows = noisePayload.results ?? []
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
}

export default function NoiseLevelChart({ variant = 'full' }) {
    const isTileVariant = variant === 'tile'
    const [payload, setPayload] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState(null)
    const [hoverIdx, setHoverIdx] = useState(null)
    const [timeframe, setTimeframe] = useState('day')
    const [eventFilter, setEventFilter] = useState('all')
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
    const [audioEventRows, setAudioEventRows] = useState([])
    const [audioEventsByTimeKey, setAudioEventsByTimeKey] = useState({})
    const [audioEventError, setAudioEventError] = useState(null)
    const [labelSavingKey, setLabelSavingKey] = useState(null)
    const [audioSummary, setAudioSummary] = useState(null)
    const [audioSummaryLoading, setAudioSummaryLoading] = useState(false)
    const [audioSummaryError, setAudioSummaryError] = useState(null)
    const [retrainState, setRetrainState] = useState({ status: 'idle', message: '' })
    const firstFetchEverRef = useRef(true)
    const clipRequestRef = useRef(null)
    const suppressNextClickRef = useRef(false)
    const clipVideoRef = useRef(null)

    useEffect(() => {
        return () => {
            if (clipRequestRef.current) {
                clipRequestRef.current.abort()
            }
        }
    }, [])

    useEffect(() => {
        if (clipPanel?.status !== 'ready' || !clipPanel.clipUrl || !clipVideoRef.current) return

        clipVideoRef.current.play().catch(() => {
            // Some browsers block autoplay with sound; the controls remain visible.
        })
    }, [clipPanel?.status, clipPanel?.clipUrl])

    useEffect(() => {
        if (isTileVariant) return undefined
        let cancelled = false

        async function fetchAudioSummary() {
            setAudioSummaryLoading(true)
            try {
                const response = await fetch(CHICKEN_AUDIO_SUMMARY_API, {
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                })
                const json = await response.json().catch(() => ({}))
                if (!response.ok) {
                    throw new Error(json.message || `HTTP ${response.status}`)
                }
                if (!cancelled) {
                    setAudioSummary(json)
                    setAudioSummaryError(null)
                }
            } catch (e) {
                if (!cancelled) setAudioSummaryError(e.message ?? String(e))
            } finally {
                if (!cancelled) setAudioSummaryLoading(false)
            }
        }

        fetchAudioSummary()
        return () => {
            cancelled = true
        }
    }, [isTileVariant])

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
        return extractNoisePoints(payload)
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

    const margin = isTileVariant
        ? { top: 12, right: 12, bottom: 30, left: 12 }
        : { top: 28, right: 28, bottom: 52, left: 108 }
    const width = 720
    const height = isTileVariant ? 220 : 340
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const xDomain = useMemo(() => {
        if (series.length === 0) return [new Date(), new Date()]
        const t0 = series[0].t
        const t1 = series[series.length - 1].t
        if (t0.getTime() === t1.getTime()) {
            const padMs = BIN_MS / 2
            return [new Date(t0.getTime() - padMs), new Date(t1.getTime() + padMs)]
        }
        return [t0, t1]
    }, [series])

    useEffect(() => {
        if (series.length === 0) {
            setAudioEventRows([])
            setAudioEventsByTimeKey({})
            return
        }

        let cancelled = false
        const halfBinMs = BIN_MS / 2
        const start = new Date(xDomain[0].getTime() - halfBinMs)
        const end = new Date(xDomain[1].getTime() + halfBinMs)

        fetch(buildChickenAudioEventsUrl(start, end), {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
        })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.json()
            })
            .then((json) => {
                if (cancelled) return
                const rows = Array.isArray(json.results) ? json.results : []
                const next = {}
                rows.forEach((event) => {
                    const key = audioEventTimeKey(event.recorded_at)
                    if (key) next[key] = event
                })
                setAudioEventRows(rows)
                setAudioEventsByTimeKey(next)
                setAudioEventError(null)
            })
            .catch((e) => {
                if (!cancelled) {
                    setAudioEventError(e.message ?? String(e))
                }
            })

        return () => {
            cancelled = true
        }
    }, [series.length, xDomain])

    const audioEvents = useMemo(
        () => audioEventRows.filter(Boolean),
        [audioEventRows]
    )

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
    const eventMatchesPoint = (event, pointMs) => {
        const binRange = audioEventBinRangeMs(event)
        if (binRange) {
            return pointMs >= binRange.start && pointMs < binRange.end
        }

        const eventMs = audioEventTimeMs(event)
        return eventMs != null && Math.abs(eventMs - pointMs) <= REVIEW_MATCH_TOLERANCE_MS
    }

    const getAudioEventsForPoint = (point) => {
        if (!point) return []

        const pointMs = point.t.getTime()
        if (!Number.isFinite(pointMs)) return []

        return audioEvents.filter((event) => eventMatchesPoint(event, pointMs))
    }

    const getAudioEventForPoint = (point) => {
        const key = point ? audioEventTimeKey(point.t) : null
        const exactEvent = key ? audioEventsByTimeKey[key] ?? null : null
        if (exactEvent || !point) return exactEvent

        const pointMs = point.t.getTime()
        if (!Number.isFinite(pointMs)) return null

        let closestEvent = null
        let closestDistance = Infinity

        audioEvents.forEach((event) => {
            const eventMs = audioEventTimeMs(event)
            if (eventMs == null) return

            const distance = Math.abs(eventMs - pointMs)
            if (distance <= REVIEW_MATCH_TOLERANCE_MS && distance < closestDistance) {
                closestEvent = event
                closestDistance = distance
            }
        })

        return closestEvent
    }

    const getPointHumanLabel = (point) => {
        const event = getAudioEventForPoint(point)
        return event?.human_label ?? null
    }

    const getBarFill = (point) => {
        const events = getAudioEventsForPoint(point)
        if (events.some((event) => event.human_label === 'chicken')) return HUMAN_LABEL_COLORS.chicken

        return 'url(#noiseBarFill)'
    }

    const getBarOpacity = (point) => {
        const events = getAudioEventsForPoint(point)
        return events.some((event) => event.human_label === 'chicken') ? 0.78 : 0.92
    }

    const hasHumanChickenForPoint = (point) =>
        getAudioEventsForPoint(point).some((event) => event.human_label === 'chicken')

    const hasHumanReviewForPoint = (point) =>
        getAudioEventsForPoint(point).some((event) => Boolean(event.human_label))

    const hasReviewedNonChickenForPoint = (point) =>
        getAudioEventsForPoint(point).some(
            (event) => event.human_label && event.human_label !== 'chicken'
        )

    const hasHighConfidencePredictionForPoint = (point) =>
        !hasReviewedNonChickenForPoint(point) &&
        getAudioEventsForPoint(point).some(isHighConfidencePredictedChicken)

    const getBestPredictionForPoint = (point) =>
        getAudioEventsForPoint(point)
            .filter(isHighConfidencePredictedChicken)
            .sort((a, b) => (predictionConfidence(b) ?? 0) - (predictionConfidence(a) ?? 0))[0] ?? null

    const getBarStroke = (point, index) => {
        if (clipPanel?.idx === index) return '#f59e0b'
        if (hoverIdx === index) return '#f8fafc'
        if (hasHighConfidencePredictionForPoint(point)) return AI_CHICKEN_STROKE
        return '#0f172a'
    }

    const getBarStrokeWidth = (point, index) =>
        clipPanel?.idx === index
            ? 2
            : hoverIdx === index
              ? 1.5
              : hasHighConfidencePredictionForPoint(point)
                ? 1.5
                : 0.5

    const getBarStrokeOpacity = (point, index) =>
        clipPanel?.idx === index || hoverIdx === index || hasHighConfidencePredictionForPoint(point) ? 1 : 0.35

    const visibleSeries = useMemo(() => {
        if (eventFilter !== 'detected') return series
        return series.filter((point) => {
            return hasHumanChickenForPoint(point) || hasHighConfidencePredictionForPoint(point)
        })
    }, [eventFilter, series, audioEvents])

    const noiseScore = useMemo(() => {
        let chickenCount = 0
        let reviewedCount = 0
        let aiPredictionCount = 0
        let chickenNoiseEventCount = 0

        series.forEach((point) => {
            const hasChickenLabel = hasHumanChickenForPoint(point)
            const hasAiChickenAlert = hasHighConfidencePredictionForPoint(point)
            if (hasHumanReviewForPoint(point)) {
                reviewedCount += 1
                if (hasChickenLabel) chickenCount += 1
            }
            if (hasAiChickenAlert) aiPredictionCount += 1
            if (hasChickenLabel || hasAiChickenAlert) chickenNoiseEventCount += 1
        })

        return {
            value: Math.min(10, 1 + Math.min(CHICKEN_EVENTS_FOR_MAX_SCORE, chickenCount)),
            chickenCount,
            reviewedCount,
            aiPredictionCount,
            chickenNoiseEventCount,
            visibleCount: visibleSeries.length,
        }
    }, [series, visibleSeries.length, audioEvents])

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
        if (visibleSeries.length === 0) return
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
        for (let i = 0; i < visibleSeries.length; i++) {
            const dx = Math.abs(xScale(visibleSeries[i].t) - innerX)
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
        if (visibleSeries.length === 0 || innerX < 0 || innerX > innerW || innerY < 0 || innerY > innerH) {
            return null
        }

        let best = 0
        let bestDx = Infinity
        for (let i = 0; i < visibleSeries.length; i++) {
            const dx = Math.abs(xScale(visibleSeries[i].t) - innerX)
            if (dx < bestDx) {
                bestDx = dx
                best = i
            }
        }
        return bestDx <= HOVER_SNAP_X_PX ? best : null
    }

    const getSeriesIndexForPoint = (point) => {
        if (!point) return -1
        const pointMs = point.t.getTime()
        if (!Number.isFinite(pointMs)) return -1
        return visibleSeries.findIndex((candidate) => candidate.t.getTime() === pointMs)
    }

    const requestClipForBar = (idx) => {
        const point = visibleSeries[idx]
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
        if (isTileVariant) return
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
        if (isTileVariant) return
        if (e.button !== 0 || visibleSeries.length === 0) return
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
        if (isTileVariant) return
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
        if (isTileVariant) return
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
        if (isTileVariant) return
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

    const saveHumanLabelForPoint = async (point, humanLabel) => {
        const pointKey = audioEventTimeKey(point?.t)
        if (!point || !pointKey || labelSavingKey) return

        setLabelSavingKey(pointKey)
        setAudioEventError(null)

        try {
            let event = getAudioEventForPoint(point)

            if (!event?.id) {
                const createResponse = await fetch(CHICKEN_AUDIO_EVENTS_API, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        recorded_at: formatUtcISOZ(point.t),
                        duration_seconds: String(BIN_MINUTES * 60),
                        max_decibel_level:
                            point.rms != null && Number.isFinite(point.rms)
                                ? Number(point.rms).toFixed(2)
                                : null,
                        source_device_identifier: NOISE_BIN_SOURCE,
                        notes: 'Reviewed from GardenMate chickens noise chart.',
                        nvr_clip_filename: clipPanel?.filename ?? '',
                    }),
                    cache: 'no-store',
                })
                const created = await createResponse.json().catch(() => ({}))
                if (!createResponse.ok) {
                    throw new Error(created.message || created.detail || `HTTP ${createResponse.status}`)
                }
                event = created
            }

            const updateResponse = await fetch(eventLabelUrl(event.id), {
                method: 'PATCH',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    human_label: humanLabel,
                    notes: event.notes || 'Reviewed from GardenMate chickens noise chart.',
                    nvr_clip_filename: clipPanel?.filename ?? '',
                }),
                cache: 'no-store',
            })
            const updated = await updateResponse.json().catch(() => ({}))
            if (!updateResponse.ok) {
                throw new Error(updated.message || updated.detail || `HTTP ${updateResponse.status}`)
            }

            const eventKey = audioEventTimeKey(updated.recorded_at) ?? pointKey
            setAudioEventRows((current) => {
                const existingIndex = current.findIndex((event) => event.id === updated.id)
                if (existingIndex === -1) return [...current, updated]
                return current.map((event, index) => (index === existingIndex ? updated : event))
            })
            setAudioEventsByTimeKey((current) => ({
                ...current,
                [eventKey]: updated,
            }))

            const currentIdx = getSeriesIndexForPoint(point)
            const nextIdx = currentIdx + 1
            if (currentIdx >= 0 && nextIdx < visibleSeries.length) {
                requestClipForBar(nextIdx)
            }
        } catch (e) {
            setAudioEventError(e.message ?? String(e))
        } finally {
            setLabelSavingKey(null)
        }
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

    const handleEventFilterChange = (nextFilter) => {
        resetChartSelection()
        setEventFilter(nextFilter)
    }

    const handleRetrainModel = async () => {
        if (retrainState.status === 'running') return

        setRetrainState({ status: 'running', message: 'Queuing retrain...' })
        try {
            const response = await fetch(CHICKEN_AUDIO_RETRAIN_API, {
                method: 'POST',
                headers: { Accept: 'application/json' },
                cache: 'no-store',
            })
            const json = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(json.message || `HTTP ${response.status}`)
            }
            setRetrainState({
                status: 'queued',
                message: json.task_id ? `Retrain queued (${json.task_id}).` : 'Retrain queued.',
            })
        } catch (e) {
            setRetrainState({
                status: 'error',
                message: e.message ?? String(e),
            })
        }
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

    const timeframeControls = isTileVariant ? null : (
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
                Now
            </button>
        </div>
    )

    const eventFilterControls = isTileVariant ? null : (
        <div
            className="mb-4 flex justify-center"
            role="group"
            aria-label="Noise event filter"
        >
            <div className="grid w-full max-w-md grid-cols-2 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/60">
                {[
                    ['all', 'All noise'],
                    ['detected', 'Detected chicken'],
                ].map(([value, label]) => {
                    const selected = eventFilter === value
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => handleEventFilterChange(value)}
                            aria-pressed={selected}
                            className={`px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${
                                selected
                                    ? 'bg-emerald-400 text-slate-950'
                                    : 'text-slate-200 hover:bg-slate-800'
                            }`}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
        </div>
    )

    const dayNavigationControls = (
        <div className={`${isTileVariant ? 'mb-3' : 'mx-auto mb-3 pt-4'} grid w-full max-w-[28.5rem] grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center justify-center gap-2`}>
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
                onClick={isTileVariant ? undefined : openRangePicker}
                className={`h-9 w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-3 text-center text-sm font-semibold leading-9 text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${
                    isTileVariant ? 'cursor-default bg-slate-900/50' : 'transition-colors hover:bg-slate-700/80'
                }`}
                aria-expanded={rangePickerOpen}
                aria-label={isTileVariant ? 'Selected noise day' : 'Choose date range'}
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

    const rangePicker = !isTileVariant && rangePickerOpen ? (
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

    const containerClass = isTileVariant
        ? 'relative w-full rounded-lg border border-emerald-200/15 bg-gradient-to-br from-stone-900/90 via-slate-950/90 to-emerald-950/55 p-5 shadow-xl'
        : 'relative w-full max-w-none rounded-2xl bg-slate-800/90 p-6 shadow-xl'
    const headingClass = isTileVariant
        ? 'text-sm font-semibold uppercase tracking-wide text-emerald-300/80'
        : 'mb-1 text-lg font-semibold tracking-wide text-slate-100'

    if (loading && !payload) {
        return (
            <div className={containerClass}>
                <h2 className={headingClass}>
                    {isTileVariant ? 'Noise Review' : 'Noise Level'}
                </h2>
                {!isTileVariant && dayNavigationControls}
                {timeframeControls}
                {rangePicker}
                <p className="text-sm text-slate-300">Loading noise levels…</p>
            </div>
        )
    }

    if (error && !payload) {
        return (
            <div className={containerClass}>
                <h2 className={headingClass}>
                    {isTileVariant ? 'Noise Review' : 'Noise Level'}
                </h2>
                {!isTileVariant && dayNavigationControls}
                {timeframeControls}
                {rangePicker}
                <p className="text-sm text-red-300">Could not load noise data: {error}</p>
            </div>
        )
    }

    if (rawSeries.length === 0) {
        return (
            <div className={containerClass}>
                <h2 className={headingClass}>
                    {isTileVariant ? 'Noise Review' : 'Noise Level'}
                </h2>
                {!isTileVariant && dayNavigationControls}
                {timeframeControls}
                {rangePicker}
                <p className="text-sm text-slate-400">No RMS readings in this response.</p>
            </div>
        )
    }

    const selectedPoint =
        clipPanel && visibleSeries[clipPanel.idx] ? visibleSeries[clipPanel.idx] : null
    const selectedAudioEvent = selectedPoint ? getAudioEventForPoint(selectedPoint) : null
    const selectedAudioEventKey = selectedPoint ? audioEventTimeKey(selectedPoint.t) : null
    const selectedHumanLabel = selectedAudioEvent?.human_label ?? null
    const selectedPrediction = selectedPoint ? getBestPredictionForPoint(selectedPoint) : null
    const selectedLabelSaving = selectedAudioEventKey && labelSavingKey === selectedAudioEventKey

    const clipPanelStyle = selectedPoint
        ? (() => {
              const panelWidth = Math.min(CLIP_PANEL_WIDTH_PX, width - CLIP_PANEL_GUTTER_PX * 2)
              const panelHalfWidth = panelWidth / 2
              const rawLeft = margin.left + xScale(selectedPoint.t)
              const clampedLeft = clampNumber(
                  rawLeft,
                  panelHalfWidth + CLIP_PANEL_GUTTER_PX,
                  width - panelHalfWidth - CLIP_PANEL_GUTTER_PX
              )
              const rawTop = margin.top + yScale(selectedPoint.y) - 178
              const clampedTop = Math.max(CLIP_PANEL_GUTTER_PX, rawTop)

              return {
                  left: `${(clampedLeft / width) * 100}%`,
                  top: `${(clampedTop / height) * 100}%`,
              }
          })()
        : null

    const hoverPoint = hoverIdx != null && visibleSeries[hoverIdx] ? visibleSeries[hoverIdx] : null
    const hoverPrediction = hoverPoint ? getBestPredictionForPoint(hoverPoint) : null
    const scoreTone =
        noiseScore?.value >= 8
            ? 'text-red-300'
            : noiseScore?.value >= 5
              ? 'text-amber-300'
              : 'text-emerald-300'
    const scoreMeterValue = Math.max(1, Math.min(10, noiseScore?.value ?? 1))
    const scoreMeterWidth = `${scoreMeterValue * 10}%`
    const scoreMeterBackgroundSize = `${1000 / scoreMeterValue}% 100%`
    const scoreCardClass = isTileVariant
        ? 'mt-3 grid gap-3 rounded-lg border border-slate-700/80 bg-slate-900/70 p-3 sm:grid-cols-2 sm:items-stretch'
        : 'mb-3 grid gap-3 rounded-lg border border-slate-700/80 bg-slate-900/70 p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center'
    const scoreValueClass = `${
        isTileVariant ? 'text-5xl' : 'text-4xl'
    } font-semibold leading-none ${scoreTone}`
    const tooltipClass = `absolute right-6 ${
        isTileVariant ? 'top-36' : 'top-32'
    } z-10 w-44 rounded-lg border border-slate-700/80 bg-slate-950/85 px-3 py-2 text-right shadow-lg ring-1 ring-black/20`
    const svgClass = `block h-auto w-full ${
        isTileVariant ? 'overflow-hidden rounded-md bg-slate-950/25' : 'overflow-visible'
    }`
    const audioClipCount = Number(audioSummary?.audio_clip_count ?? audioSummary?.total)
    const audioClipText = audioSummaryLoading && !audioSummary
        ? 'Loading...'
        : Number.isFinite(audioClipCount)
          ? audioClipCount.toLocaleString()
          : '-'

    return (
        <div className={containerClass}>
            <h2 className={headingClass}>
                {isTileVariant ? 'Noise Review' : 'Noise Level'}
            </h2>
            <div className={scoreCardClass}>
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Chicken noise score
                    </p>
                    <div className={scoreValueClass}>
                        {noiseScore ? noiseScore.value : '—'}
                        <span className="ml-1 text-sm font-medium text-slate-400">/10</span>
                    </div>
                </div>
                <div className="h-2 min-w-0 overflow-hidden rounded-full bg-slate-700">
                    <div
                        className="h-full rounded-full"
                        style={{
                            width: scoreMeterWidth,
                            backgroundImage:
                                'linear-gradient(to right, #34d399 0%, #fbbf24 60%, #fb923c 90%, #ef4444 100%)',
                            backgroundPosition: 'left center',
                            backgroundSize: scoreMeterBackgroundSize,
                        }}
                    />
                </div>
                {isTileVariant && (
                    <div className="border-t border-slate-700/70 pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Chicken noise events today
                        </p>
                        <p className="mt-0.5 text-2xl font-semibold text-slate-100">
                            {noiseScore ? noiseScore.chickenNoiseEventCount : '—'}
                        </p>
                    </div>
                )}
            </div>
            {!isTileVariant && (
                <div className="mb-4 grid gap-3 rounded-lg border border-slate-700/80 bg-slate-900/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Audio clips available
                        </p>
                        <p className="mt-0.5 text-2xl font-semibold text-slate-100">
                            {audioClipText}
                        </p>
                        {audioSummaryError && (
                            <p className="mt-1 text-xs text-red-300">
                                Could not load clip count: {audioSummaryError}
                            </p>
                        )}
                        {retrainState.message && (
                            <p className={`mt-1 text-xs ${
                                retrainState.status === 'error' ? 'text-red-300' : 'text-emerald-300'
                            }`}>
                                {retrainState.message}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleRetrainModel}
                        disabled={retrainState.status === 'running'}
                        className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 disabled:cursor-wait disabled:opacity-60"
                    >
                        {retrainState.status === 'running' ? 'Queuing...' : 'Retrain model'}
                    </button>
                </div>
            )}
            {!isTileVariant && dayNavigationControls}
            {timeframeControls}
            {eventFilterControls}
            {rangePicker}
            {hoverPoint && (
                <div className={tooltipClass}>
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
                    {getAudioEventForPoint(hoverPoint)?.human_label && (
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                            {getAudioEventForPoint(hoverPoint).human_label.replace('_', ' ')}
                        </p>
                    )}
                    {!getAudioEventForPoint(hoverPoint)?.human_label && hoverPrediction && (
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                            AI chicken {Math.round((predictionConfidence(hoverPrediction) ?? 0) * 100)}%
                        </p>
                    )}
                </div>
            )}
            {error && payload && (
                <p className="mb-3 text-sm text-red-300">Could not refresh noise data: {error}</p>
            )}
            {!isTileVariant && audioEventError && (
                <p className="mb-3 text-sm text-red-300">Could not save chicken review: {audioEventError}</p>
            )}
            {!isTileVariant && <div className="relative">
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
                        className="absolute z-20 w-64 max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-950/95 p-3 text-left text-slate-100 shadow-2xl ring-1 ring-black/30"
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
                                ref={clipVideoRef}
                                key={clipPanel.clipUrl}
                                src={clipPanel.clipUrl}
                                autoPlay
                                controls
                                playsInline
                                preload="metadata"
                                className="aspect-video w-full rounded-md bg-black"
                            />
                        )}
                        {!selectedHumanLabel && selectedPrediction && (
                            <p className="mt-2 rounded-md border border-amber-300/25 bg-amber-950/40 px-2 py-1 text-xs text-amber-100">
                                AI suggests chicken at {Math.round((predictionConfidence(selectedPrediction) ?? 0) * 100)}% confidence.
                            </p>
                        )}
                        <div className="mt-3 border-t border-slate-800 pt-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Mark this noise
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    ['chicken', 'Chicken'],
                                    ['not_chicken', 'Not chicken'],
                                    ['unsure', 'Unsure'],
                                    ['ignored', 'Ignore'],
                                ].map(([value, label]) => {
                                    const selected = selectedHumanLabel === value
                                    const isGreyAction = humanLabelColor(value) === HUMAN_LABEL_COLORS.not_chicken
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => saveHumanLabelForPoint(selectedPoint, value)}
                                            disabled={Boolean(selectedLabelSaving)}
                                            aria-pressed={selected}
                                            className={`rounded-md px-2 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-wait disabled:opacity-60 ${
                                                selected
                                                    ? isGreyAction
                                                        ? 'bg-slate-500 text-white'
                                                        : 'bg-red-500 text-white'
                                                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                            }`}
                                        >
                                            {selectedLabelSaving ? 'Saving…' : label}
                                        </button>
                                    )
                                })}
                            </div>
                            {selectedHumanLabel && (
                                <p className="mt-2 text-xs text-slate-400">
                                    Saved as {selectedHumanLabel.replace('_', ' ')}.
                                </p>
                            )}
                        </div>
                    </div>
                )}
                <svg
                    width={width}
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                    className={svgClass}
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
                        {eventFilter === 'detected' && visibleSeries.length === 0 && (
                            <text
                                x={innerW / 2}
                                y={innerH / 2}
                                textAnchor="middle"
                                fill="#94a3b8"
                                fontSize={13}
                                fontWeight={600}
                            >
                                No detected chicken events in this view
                            </text>
                        )}
                        {visibleSeries.map((d, i) => {
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
                                    fill={getBarFill(d)}
                                    rx={2}
                                    opacity={getBarOpacity(d)}
                                    stroke={getBarStroke(d, i)}
                                    strokeWidth={getBarStrokeWidth(d, i)}
                                    strokeOpacity={getBarStrokeOpacity(d, i)}
                                />
                            )
                        })}
                        {hoverIdx != null && visibleSeries[hoverIdx] && (
                            <g pointerEvents="none">
                                <line
                                    x1={xScale(visibleSeries[hoverIdx].t)}
                                    x2={xScale(visibleSeries[hoverIdx].t)}
                                    y1={0}
                                    y2={innerH}
                                    stroke="#94a3b8"
                                    strokeDasharray="4 4"
                                    strokeOpacity={0.9}
                                />
                            </g>
                        )}
                        {!isTileVariant && zoomSelection && (
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
                            cursor={isTileVariant ? 'default' : zoomDrag ? 'col-resize' : 'crosshair'}
                            onMouseMove={handlePlotMouseMove}
                            onMouseLeave={handlePlotMouseLeave}
                            onClick={isTileVariant ? undefined : handlePlotClick}
                            onPointerDown={isTileVariant ? undefined : handlePlotPointerDown}
                            onPointerMove={isTileVariant ? undefined : handlePlotPointerMove}
                            onPointerUp={isTileVariant ? undefined : handlePlotPointerUp}
                            onPointerCancel={isTileVariant ? undefined : handlePlotPointerCancel}
                            style={{ touchAction: 'none' }}
                        />
                        {!isTileVariant &&
                            yScale.ticks(6).map((tick) => (
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
                        {xScale.ticks(isTileVariant ? 4 : 6).map((t, i) => (
                            <g key={i} transform={`translate(${xScale(t)},${innerH})`}>
                                <line y1={0} y2={6} stroke="#64748b" />
                                <text y={22} textAnchor="middle" fill="#94a3b8" fontSize={11}>
                                    {xTickFormatFn(t)}
                                </text>
                            </g>
                        ))}
                        {!isTileVariant && (
                            <text
                                x={innerW / 2}
                                y={innerH + 42}
                                textAnchor="middle"
                                fill="#94a3b8"
                                fontSize={12}
                            >
                                {xAxisLabel}
                            </text>
                        )}
                    </g>
                </svg>
                <div className="mx-auto mt-2 grid max-w-lg grid-cols-4 gap-2 border-t border-slate-700/70 pt-3 text-center text-xs text-slate-300">
                    <div>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                            Chicken
                        </span>
                        {noiseScore.chickenCount}
                    </div>
                    <div>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                            Reviewed
                        </span>
                        {noiseScore.reviewedCount}
                    </div>
                    <div>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                            AI alerts
                        </span>
                        {noiseScore.aiPredictionCount}
                    </div>
                    <div>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                            Visible
                        </span>
                        {noiseScore.visibleCount}
                    </div>
                    <p className="col-span-4 text-[11px] text-slate-500">
                        Score is based on confirmed chicken labels. AI alerts require 90% confidence.
                    </p>
                </div>
            </div>}
        </div>
    )
}
