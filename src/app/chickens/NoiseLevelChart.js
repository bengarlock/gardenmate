'use client'

import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'

const NOISE_API = 'https://bengarlock.com/api/v1/garden/noise/'
const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'
const NVR_CLIPS_API = `${APP_BASE_PATH}/api/nvr-clips`
const DEFAULT_CAMERA_ID =
    process.env.NEXT_PUBLIC_GARDEN_CAMERA_ID || '677930230377fe03e4001fa9'

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

/** `datetime-local` value in local time (`YYYY-MM-DDTHH:mm`). */
function toDatetimeLocalValue(d) {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse `datetime-local` string to a local Date (seconds default to 0). */
function fromDatetimeLocalValue(s) {
    if (!s || typeof s !== 'string') return null
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    const hh = Number(m[4])
    const mm = Number(m[5])
    const ss = m[6] != null ? Number(m[6]) : 0
    const dt = new Date(y, mo - 1, d, hh, mm, ss, 0)
    return Number.isNaN(dt.getTime()) ? null : dt
}

/** Presets; `getRange()` is called on each fetch so `end` stays current for polling. */
const PRESETS = [
    {
        id: 'today',
        label: 'Today',
        getRange: () => {
            const end = new Date()
            return { start: dayStartLocal(end), end }
        },
    },
    {
        id: '24h',
        label: '24 hours',
        getRange: () => {
            const end = new Date()
            return { start: new Date(end.getTime() - 24 * 60 * 60 * 1000), end }
        },
    },
    {
        id: '7d',
        label: '7 days',
        getRange: () => {
            const end = new Date()
            return { start: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000), end }
        },
    },
]

const TIMEFRAME_OPTIONS = [...PRESETS, { id: 'custom', label: 'Custom' }]

/** Snap hover to the nearest time bucket when within this many SVG units on the x-axis */
const HOVER_SNAP_X_PX = 36

export default function NoiseLevelChart() {
    const [payload, setPayload] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState(null)
    const [hoverIdx, setHoverIdx] = useState(null)
    const [timeframe, setTimeframe] = useState('today')
    const [customStartInput, setCustomStartInput] = useState('')
    const [customEndInput, setCustomEndInput] = useState('')
    const [customApplied, setCustomApplied] = useState({ start: '', end: '' })
    const [rangeValidationError, setRangeValidationError] = useState(null)
    const [clipPanel, setClipPanel] = useState(null)
    const firstFetchEverRef = useRef(true)
    const clipRequestRef = useRef(null)

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

            if (timeframe === 'custom') {
                if (!customApplied.start || !customApplied.end) {
                    return
                }
                start = fromDatetimeLocalValue(customApplied.start)
                end = fromDatetimeLocalValue(customApplied.end)
                if (!start || !end || start.getTime() >= end.getTime()) {
                    return
                }
            } else {
                const preset = PRESETS.find((t) => t.id === timeframe)
                if (!preset) return
                ;({ start, end } = preset.getRange())
            }

            const isFirstEver = firstFetchEverRef.current
            if (isFirstEver) setLoading(true)
            else setIsRefreshing(true)

            const url = buildNoiseUrl(start, end)

            fetch(url)
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    return res.json()
                })
                .then((json) => {
                    if (!cancelled) {
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
    }, [timeframe, customApplied.start, customApplied.end])

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

    const handlePlotMouseMove = (e) => {
        if (series.length === 0) return
        const [innerX, innerY] = d3.pointer(e, e.currentTarget)
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

    const handlePlotMouseLeave = () => setHoverIdx(null)

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
        const requestedAt = point.t.toISOString()

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
        const [innerX, innerY] = d3.pointer(e, e.currentTarget)
        const idx = getNearestSeriesIndex(innerX, innerY)
        if (idx == null) return
        requestClipForBar(idx)
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

    const seedCustomRangeFromNow = () => {
        const end = new Date()
        const startStr = toDatetimeLocalValue(dayStartLocal(end))
        const endStr = toDatetimeLocalValue(end)
        setCustomStartInput(startStr)
        setCustomEndInput(endStr)
        setCustomApplied({ start: startStr, end: endStr })
    }

    const handleApplyCustom = () => {
        if (!customStartInput || !customEndInput) {
            setRangeValidationError('Choose both start and end.')
            return
        }
        const start = fromDatetimeLocalValue(customStartInput)
        const end = fromDatetimeLocalValue(customEndInput)
        if (!start || !end) {
            setRangeValidationError('Invalid date or time.')
            return
        }
        if (start.getTime() >= end.getTime()) {
            setRangeValidationError('Start must be before end.')
            return
        }
        setRangeValidationError(null)
        setError(null)
        setCustomApplied({ start: customStartInput, end: customEndInput })
    }

    const handleTimeframeClick = (tfId) => {
        setError(null)
        if (tfId === 'custom') {
            seedCustomRangeFromNow()
            setRangeValidationError(null)
            setTimeframe('custom')
            return
        }
        setTimeframe(tfId)
    }

    const datetimeLocalInputClass =
        'mt-1 min-h-[42px] w-full min-w-[11rem] rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-amber-500/70 focus:outline-none focus:ring-2 focus:ring-amber-400/50 sm:w-auto'

    const timeframeControls = (
        <div
            className="mb-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Time range for noise data"
        >
            {TIMEFRAME_OPTIONS.map((tf) => (
                <button
                    key={tf.id}
                    type="button"
                    onClick={() => handleTimeframeClick(tf.id)}
                    aria-pressed={timeframe === tf.id}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${
                        timeframe === tf.id
                            ? 'bg-amber-500/90 text-slate-900 shadow-sm'
                            : 'bg-slate-700/80 text-slate-200 hover:bg-slate-600/90'
                    }`}
                >
                    {tf.label}
                </button>
            ))}
        </div>
    )

    const customRangePickers =
        timeframe === 'custom' ? (
            <div className="mb-4 flex flex-col gap-3 border-t border-slate-700/80 pt-4 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="flex min-w-[11rem] flex-1 flex-col text-sm text-slate-300">
                    Start
                    <input
                        type="datetime-local"
                        value={customStartInput}
                        onChange={(e) => setCustomStartInput(e.target.value)}
                        className={datetimeLocalInputClass}
                        aria-invalid={rangeValidationError ? true : undefined}
                    />
                </label>
                <label className="flex min-w-[11rem] flex-1 flex-col text-sm text-slate-300">
                    End
                    <input
                        type="datetime-local"
                        value={customEndInput}
                        onChange={(e) => setCustomEndInput(e.target.value)}
                        className={datetimeLocalInputClass}
                    />
                </label>
                <button
                    type="button"
                    onClick={handleApplyCustom}
                    className="mb-1 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 sm:shrink-0"
                >
                    Apply range
                </button>
                {rangeValidationError && (
                    <p className="basis-full text-sm text-red-300" role="alert">
                        {rangeValidationError}
                    </p>
                )}
                <p className="basis-full text-xs text-slate-500">
                    Times use your device&apos;s local timezone. Polling repeats this same window.
                </p>
            </div>
        ) : null

    if (loading && !payload) {
        return (
            <div className="w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 shadow-xl">
                <h2 className="mb-1 text-lg font-semibold tracking-wide text-slate-100">
                    Noise Level
                </h2>
                {timeframeControls}
                {customRangePickers}
                <p className="text-slate-300">Loading noise levels…</p>
            </div>
        )
    }

    if (error && !payload) {
        return (
            <div className="w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 shadow-xl">
                <h2 className="mb-1 text-lg font-semibold tracking-wide text-slate-100">
                    Noise Level
                </h2>
                {timeframeControls}
                {customRangePickers}
                <p className="text-red-300">Could not load noise data: {error}</p>
            </div>
        )
    }

    if (rawSeries.length === 0) {
        return (
            <div className="w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 shadow-xl">
                <h2 className="mb-1 text-lg font-semibold tracking-wide text-slate-100">
                    Noise Level
                </h2>
                {timeframeControls}
                {customRangePickers}
                <p className="text-slate-400">No RMS readings in this response.</p>
            </div>
        )
    }

    const sampleNote =
        Array.isArray(payload?.bins) && payload.bins.length > 0
            ? `${payload.bin_count != null ? payload.bin_count : payload.bins.length} bins`
            : payload?.count != null
              ? `${payload.count} samples`
              : `${(payload?.results ?? []).length} samples`

    const selectedPoint =
        clipPanel && series[clipPanel.idx] ? series[clipPanel.idx] : null

    const clipPanelStyle = selectedPoint
        ? {
              left: `${((margin.left + xScale(selectedPoint.t)) / width) * 100}%`,
              top: `${(Math.max(8, margin.top + yScale(selectedPoint.y) - 178) / height) * 100}%`,
          }
        : null

    return (
        <div className="w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold tracking-wide text-slate-100">
                Noise Level
            </h2>
            {timeframeControls}
            {customRangePickers}
            {error && payload && (
                <p className="mb-3 text-sm text-red-300">Could not refresh noise data: {error}</p>
            )}
            <p className="mb-4 text-sm text-slate-400">
                {payload?.date ? `${payload.date} · ` : ''}
                {sampleNote}
                {` · ${BIN_MINUTES}-minute bins`}
            </p>
            <div className="relative">
                {isRefreshing && (
                    <div
                        className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end rounded-lg pt-2 pr-2"
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
                            <g
                                transform={`translate(${xScale(series[hoverIdx].t)}, ${yScale(series[hoverIdx].y) - 14})`}
                            >
                                <rect
                                    x={-56}
                                    y={-40}
                                    width={112}
                                    height={34}
                                    rx={6}
                                    fill="#0f172a"
                                    stroke="#475569"
                                    strokeWidth={1}
                                />
                                <text
                                    x={0}
                                    y={-22}
                                    textAnchor="middle"
                                    fill="#f1f5f9"
                                    fontSize={12}
                                    fontWeight={600}
                                >
                                    RMS{' '}
                                    {series[hoverIdx].rms != null && Number.isFinite(series[hoverIdx].rms)
                                        ? `${Number(series[hoverIdx].rms).toFixed(2)} dB`
                                        : '—'}
                                </text>
                                <text
                                    x={0}
                                    y={-8}
                                    textAnchor="middle"
                                    fill="#94a3b8"
                                    fontSize={10}
                                >
                                    {xTickFormatFn(series[hoverIdx].t)}
                                </text>
                            </g>
                        </g>
                    )}
                    <rect
                        x={0}
                        y={0}
                        width={innerW}
                        height={innerH}
                        fill="transparent"
                        cursor="pointer"
                        onMouseMove={handlePlotMouseMove}
                        onMouseLeave={handlePlotMouseLeave}
                        onClick={handlePlotClick}
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
