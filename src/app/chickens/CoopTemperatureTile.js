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

function temperatureTone(tempF) {
    if (!Number.isFinite(tempF)) return 'text-slate-100'
    if (tempF >= 90 || tempF <= 35) return 'text-red-300'
    if (tempF >= 82 || tempF <= 45) return 'text-amber-300'
    return 'text-emerald-300'
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
    const toneClass = temperatureTone(tempF)
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
                <div className={`flex items-end gap-2 text-6xl font-semibold leading-none ${toneClass}`}>
                    {loading && !reading ? '—' : formatTemperature(tempF)}
                    <span className="pb-2 text-xl font-medium text-slate-400">°F</span>
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
