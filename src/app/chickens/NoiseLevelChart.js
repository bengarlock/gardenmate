'use client'

import * as d3 from 'd3'
import { useEffect, useMemo, useState } from 'react'

const NOISE_API = 'https://bengarlock.com/api/v1/garden/noise/'

/** Poll interval for live updates */
const REFRESH_MS = 60 * 1000

/** Bin width for trend smoothing (local time) */
const BIN_MS = 60 * 1000

/** Low → high intensity */
const LEVEL_RANK = {
    Quiet: 0,
    Moderate: 1,
    Loud: 2,
    'Very Loud': 3,
}

/** Stroke colors by rank: Quiet → Moderate → Loud → Very Loud */
const LEVEL_COLORS = ['#22c55e', '#eab308', '#ef4444', '#a855f7']

function rankForLevel(level) {
    const key = level ?? 'Unknown'
    if (Object.prototype.hasOwnProperty.call(LEVEL_RANK, key)) {
        return LEVEL_RANK[key]
    }
    return 1
}

function dayStartLocal(d) {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
}

function labelForRank(rk) {
    const entry = Object.entries(LEVEL_RANK).find(([, v]) => v === rk)
    return entry ? entry[0] : String(rk)
}

function binAndAverage(rawPts, dayAnchor) {
    if (rawPts.length === 0) return []
    const groups = d3.group(rawPts, (d) =>
        Math.floor((d.t.getTime() - dayAnchor.getTime()) / BIN_MS)
    )
    const bins = []
    for (const [binKey, pts] of groups) {
        const ys = pts.map((p) => p.y)
        const meanY = d3.mean(ys) ?? 0
        const rmsVals = pts.map((p) => p.rms).filter((v) => v != null && Number.isFinite(v))
        const meanRms = rmsVals.length ? d3.mean(rmsVals) : null
        const tMid = new Date(dayAnchor.getTime() + (Number(binKey) + 0.5) * BIN_MS)
        bins.push({ t: tMid, y: meanY, n: pts.length, rms: meanRms })
    }
    bins.sort((a, b) => a.t - b.t)
    return bins
}

function segmentStrokeColor(y0, y1) {
    const mid = Math.round((y0 + y1) / 2)
    return LEVEL_COLORS[Math.min(LEVEL_COLORS.length - 1, Math.max(0, mid))]
}

/** Split averaged series into contiguous runs by rounded level (for coloring). */
function runsByRoundedRank(points) {
    const runs = []
    let cur = []
    let rank = null
    for (const p of points) {
        const r = Math.min(LEVEL_COLORS.length - 1, Math.max(0, Math.round(p.y)))
        if (rank === null) {
            rank = r
            cur.push(p)
            continue
        }
        if (r === rank) {
            cur.push(p)
        } else {
            runs.push({ rank, points: [...cur] })
            cur = [p]
            rank = r
        }
    }
    if (cur.length) runs.push({ rank, points: cur })
    return runs
}

/** Snap hover to the nearest time bucket when within this many px on the x-axis */
const HOVER_SNAP_X_PX = 36

export default function NoiseLevelChart() {
    const [payload, setPayload] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [hoverIdx, setHoverIdx] = useState(null)

    useEffect(() => {
        let cancelled = false

        const fetchNoise = () => {
            fetch(NOISE_API)
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    return res.json()
                })
                .then((json) => {
                    if (!cancelled) {
                        setPayload(json)
                        setError(null)
                        setLoading(false)
                    }
                })
                .catch((e) => {
                    if (!cancelled) {
                        setError(e.message ?? String(e))
                        setLoading(false)
                    }
                })
        }

        fetchNoise()
        const intervalId = setInterval(fetchNoise, REFRESH_MS)

        return () => {
            cancelled = true
            clearInterval(intervalId)
        }
    }, [])

    const rows = payload?.results ?? []

    const rawSeries = useMemo(() => {
        const pts = rows
            .map((row) => {
                const t = new Date(row.timestamp)
                if (Number.isNaN(t.getTime())) return null
                const level = row.level ?? 'Unknown'
                const y = rankForLevel(level)
                const rmsRaw = row.rms != null && row.rms !== '' ? Number(row.rms) : NaN
                const rms = Number.isFinite(rmsRaw) ? rmsRaw : null
                return { t, y, level, rms }
            })
            .filter(Boolean)
        pts.sort((a, b) => a.t - b.t)
        return pts
    }, [rows])

    const series = useMemo(() => {
        if (rawSeries.length === 0) return []
        const anchor = dayStartLocal(rawSeries[0].t)
        return binAndAverage(rawSeries, anchor)
    }, [rawSeries])

    const coloredRuns = useMemo(() => runsByRoundedRank(series), [series])

    const margin = { top: 28, right: 28, bottom: 52, left: 96 }
    const width = 720
    const height = 340
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const yAxisRanks = [0, 1, 2, 3]

    const yDomain = useMemo(() => {
        if (series.length === 0) return [-0.2, 3.2]
        const ys = series.map((d) => d.y)
        const lo = Math.min(d3.min(ys) ?? 0, 0)
        const hi = Math.max(d3.max(ys) ?? 3, 3)
        const span = hi - lo
        const pad = Math.max(0.15, span * 0.08)
        return [lo - pad, hi + pad]
    }, [series])

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

    const xScale = useMemo(
        () => d3.scaleTime().domain(xDomain).range([0, innerW]),
        [xDomain, innerW]
    )

    const yScale = useMemo(
        () => d3.scaleLinear().domain(yDomain).nice().range([innerH, 0]),
        [yDomain, innerH]
    )

    const lineGenerator = useMemo(
        () =>
            d3
                .line()
                .x((d) => xScale(d.t))
                .y((d) => yScale(d.y))
                .curve(d3.curveCatmullRom.alpha(0.65)),
        [xScale, yScale]
    )

    const { runPaths, connectorPaths } = useMemo(() => {
        const paths = coloredRuns.map((run, i) => {
            const pts = run.points
            if (pts.length >= 2) {
                return {
                    key: `run-${i}-${run.rank}`,
                    d: lineGenerator(pts),
                    stroke: LEVEL_COLORS[run.rank],
                    kind: 'path',
                }
            }
            const p = pts[0]
            return {
                key: `dot-${i}-${run.rank}`,
                cx: xScale(p.t),
                cy: yScale(p.y),
                fill: LEVEL_COLORS[run.rank],
                kind: 'dot',
            }
        })
        const connectors = []
        for (let j = 0; j < coloredRuns.length - 1; j++) {
            const a = coloredRuns[j].points[coloredRuns[j].points.length - 1]
            const b = coloredRuns[j + 1].points[0]
            const d = `M${xScale(a.t)},${yScale(a.y)}L${xScale(b.t)},${yScale(b.y)}`
            connectors.push({
                key: `conn-${j}`,
                d,
                stroke: segmentStrokeColor(a.y, b.y),
            })
        }
        return { runPaths: paths, connectorPaths: connectors }
    }, [coloredRuns, lineGenerator, xScale, yScale])

    const xTickFormat = d3.timeFormat('%-I:%M %p')

    const handlePlotMouseMove = (e) => {
        const svg = e.currentTarget.ownerSVGElement
        if (!svg || series.length === 0) return
        const b = svg.getBoundingClientRect()
        const innerX = e.clientX - b.left - margin.left
        const innerY = e.clientY - b.top - margin.top
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

    if (loading) {
        return (
            <div className="w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 text-slate-300 shadow-xl">
                Loading noise levels…
            </div>
        )
    }

    if (error) {
        return (
            <div className="w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 text-red-300 shadow-xl">
                Could not load noise data: {error}
            </div>
        )
    }

    if (rawSeries.length === 0) {
        return (
            <div className="w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 text-slate-400 shadow-xl">
                No noise readings in this response.
            </div>
        )
    }

    if (series.length === 0) {
        return (
            <div className="w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 text-slate-400 shadow-xl">
                Could not build averages from readings.
            </div>
        )
    }

    const sampleNote =
        payload?.count != null ? `${payload.count} samples` : `${rows.length} samples`

    return (
        <div className="w-full max-w-4xl rounded-2xl bg-slate-800/90 p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold tracking-wide text-slate-100">
                Noise Level
            </h2>
            <p className="mb-4 text-sm text-slate-400">
                {payload?.date ? `${payload.date} · ` : ''}
                {sampleNote}
            </p>
            <svg
                width={width}
                height={height}
                className="overflow-visible"
                role="img"
                aria-label="Line chart of averaged noise level versus time of day"
            >
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {yAxisRanks.map((rk) => (
                        <line
                            key={`grid-${rk}`}
                            x1={0}
                            x2={innerW}
                            y1={yScale(rk)}
                            y2={yScale(rk)}
                            stroke="#334155"
                            strokeDasharray="4 6"
                            strokeOpacity={0.85}
                        />
                    ))}
                    {connectorPaths.map((c) => (
                        <path
                            key={c.key}
                            d={c.d}
                            fill="none"
                            stroke={c.stroke}
                            strokeWidth={2.25}
                            strokeLinecap="round"
                        />
                    ))}
                    {runPaths.map((item) =>
                        item.kind === 'path' ? (
                            <path
                                key={item.key}
                                d={item.d}
                                fill="none"
                                stroke={item.stroke}
                                strokeWidth={2.25}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        ) : (
                            <circle
                                key={item.key}
                                cx={item.cx}
                                cy={item.cy}
                                r={5}
                                fill={item.fill}
                            />
                        )
                    )}
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
                            <circle
                                cx={xScale(series[hoverIdx].t)}
                                cy={yScale(series[hoverIdx].y)}
                                r={6}
                                fill="#0f172a"
                                stroke="#f8fafc"
                                strokeWidth={2}
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
                                    {' '}
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
                                    {xTickFormat(series[hoverIdx].t)}
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
                        cursor="crosshair"
                        onMouseMove={handlePlotMouseMove}
                        onMouseLeave={handlePlotMouseLeave}
                    />
                    {yAxisRanks.map((rk) => (
                        <text
                            key={`yt-${rk}`}
                            x={-12}
                            y={yScale(rk)}
                            dy="0.35em"
                            textAnchor="end"
                            fill="#cbd5e1"
                            fontSize={13}
                        >
                            {labelForRank(rk)}
                        </text>
                    ))}
                    {xScale.ticks(6).map((t, i) => (
                        <g key={i} transform={`translate(${xScale(t)},${innerH})`}>
                            <line y1={0} y2={6} stroke="#64748b" />
                            <text y={22} textAnchor="middle" fill="#94a3b8" fontSize={11}>
                                {xTickFormat(t)}
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
                        Time of day
                    </text>
                </g>
            </svg>
        </div>
    )
}
