'use client'

import { useEffect, useMemo, useState } from 'react'

const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'
const COOP_TEMPERATURE_API = `${APP_BASE_PATH}/api/govee-thermometer`
const REFRESH_MS = 5 * 60 * 1000

function formatTemperature(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '—'
    return Math.round(numeric).toString()
}

function formatHumidity(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '—'
    return `${Math.round(numeric)}%`
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
}

function interpolateColor(start, end, pct) {
    const value = clamp(pct, 0, 1)
    const rgb = start.map((channel, index) => Math.round(channel + (end[index] - channel) * value))
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

function temperatureColor(tempF) {
    if (!Number.isFinite(tempF)) return 'rgb(186, 230, 253)'
    const stops = [
        { temp: 20, color: [59, 130, 246] },
        { temp: 45, color: [34, 211, 238] },
        { temp: 65, color: [52, 211, 153] },
        { temp: 75, color: [250, 204, 21] },
        { temp: 85, color: [251, 146, 60] },
        { temp: 95, color: [239, 68, 68] },
    ]
    const boundedTemp = clamp(tempF, stops[0].temp, stops[stops.length - 1].temp)
    for (let i = 0; i < stops.length - 1; i += 1) {
        const current = stops[i]
        const next = stops[i + 1]
        if (boundedTemp >= current.temp && boundedTemp <= next.temp) {
            return interpolateColor(
                current.color,
                next.color,
                (boundedTemp - current.temp) / (next.temp - current.temp)
            )
        }
    }
    return 'rgb(239, 68, 68)'
}

function temperatureGradientStyle(tempF) {
    const current = temperatureColor(tempF)
    return {
        backgroundImage: `linear-gradient(90deg, ${current}, rgb(254, 240, 138))`,
    }
}

export default function CoopTemperatureTile() {
    const [reading, setReading] = useState(null)
    const [fetchedAt, setFetchedAt] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false

        async function fetchReading() {
            try {
                const response = await fetch(COOP_TEMPERATURE_API, { cache: 'no-store' })
                const data = await response.json().catch(() => null)
                if (!response.ok) {
                    throw new Error(data?.message || `HTTP ${response.status}`)
                }
                if (!cancelled) {
                    setReading(data)
                    setFetchedAt(new Date())
                    setError('')
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || 'Could not load coop temperature.')
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchReading()
        const interval = window.setInterval(fetchReading, REFRESH_MS)
        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [])

    const tempF = Number(reading?.temperature?.fahrenheit)
    const tempC = Number(reading?.temperature?.celsius)
    const humidity = Number(reading?.humidity?.percent)
    const temperatureStyle = temperatureGradientStyle(tempF)
    const detailText = useMemo(() => {
        if (!fetchedAt) return 'Live Govee reading'
        return `Updated ${fetchedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    }, [fetchedAt])

    return (
        <article className="relative flex min-h-[360px] w-full flex-col rounded-lg border border-emerald-200/15 bg-gradient-to-br from-stone-900/90 via-slate-950/90 to-emerald-950/55 p-5 shadow-xl">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-300/80">
                Coop Temperature
            </h2>

            <div className="mt-3 grid gap-3 rounded-lg border border-slate-700/80 bg-slate-900/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Chicken coop now
                </p>
                <div className="flex items-end gap-2">
                    <span
                        className="bg-clip-text text-6xl font-semibold leading-none text-transparent"
                        style={temperatureStyle}
                    >
                        {loading && !reading ? '—' : formatTemperature(tempF)}
                    </span>
                    <span
                        className="bg-clip-text pb-2 text-xl font-medium text-transparent"
                        style={temperatureStyle}
                    >
                        °F
                    </span>
                </div>
                <p className="text-sm text-slate-400">
                    {Number.isFinite(tempC) ? `${tempC.toFixed(1)} °C` : 'Waiting for sensor data'}
                </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800/90 bg-slate-950/45 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Humidity
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-100">
                        {loading && !reading ? '—' : formatHumidity(humidity)}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-800/90 bg-slate-950/45 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Sensor
                    </p>
                    <p className={`mt-1 text-sm font-semibold ${reading?.online ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {reading?.online ? 'Online' : loading ? 'Checking' : 'Check'}
                    </p>
                </div>
            </div>

            <div className="mt-auto pt-4">
                {error ? (
                    <p className="text-sm text-red-300">Could not load coop temperature: {error}</p>
                ) : (
                    <p className="text-sm text-slate-400">{detailText}</p>
                )}
            </div>
        </article>
    )
}
