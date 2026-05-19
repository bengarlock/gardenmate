'use client'

import { useEffect, useMemo, useState } from 'react'

const FORECAST_API = 'https://bengarlock.com/api/v1/garden/weather/forecast/'
const HEAT_THRESHOLD_F = 90
const OUTLOOK_DAYS = 7

function celsiusToFahrenheit(value) {
    return value == null || Number.isNaN(Number(value)) ? null : (Number(value) * 9) / 5 + 32
}

function dayStartLocal(value) {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date
}

function addLocalDays(value, days) {
    const date = new Date(value)
    date.setDate(date.getDate() + days)
    return date
}

function formatDay(value) {
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }).format(new Date(value))
}

function formatTemperature(tempF) {
    return tempF == null ? '--' : `${Math.round(tempF)}°F`
}

function heatSeverity(tempF) {
    if (tempF >= 100) return 'Extreme'
    if (tempF >= 95) return 'High'
    return 'Elevated'
}

export default function DangerousHeatAdvisory() {
    const [forecast, setForecast] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false

        fetch(FORECAST_API, { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return response.json()
            })
            .then((json) => {
                if (cancelled) return
                setForecast(Array.isArray(json) ? json : [])
                setError(null)
            })
            .catch((e) => {
                if (!cancelled) setError(e.message ?? String(e))
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [])

    const hotDays = useMemo(() => {
        const today = dayStartLocal(new Date())
        const outlookEnd = addLocalDays(today, OUTLOOK_DAYS)

        return forecast
            .filter((day) => {
                if (day.forecast_type !== 'daily') return false
                const forecastDay = dayStartLocal(day.forecasted_at)
                const forecastTime = forecastDay.getTime()
                return (
                    Number.isFinite(forecastTime) &&
                    forecastTime >= today.getTime() &&
                    forecastTime < outlookEnd.getTime()
                )
            })
            .map((day) => ({
                id: day.id,
                conditions: day.conditions ?? 'Forecast',
                forecastedAt: day.forecasted_at,
                highF: celsiusToFahrenheit(day.air_temperature_high),
                lowF: celsiusToFahrenheit(day.air_temperature_low),
            }))
            .filter((day) => day.highF != null && day.highF >= HEAT_THRESHOLD_F)
            .sort((a, b) => new Date(a.forecastedAt) - new Date(b.forecastedAt))
    }, [forecast])

    const hottestDay = hotDays.reduce(
        (hottest, day) => (!hottest || day.highF > hottest.highF ? day : hottest),
        null
    )

    if (loading || error || hotDays.length === 0) return null

    return (
        <section className="rounded-lg border border-amber-300/30 bg-gradient-to-br from-amber-950/85 via-red-950/75 to-slate-950/80 p-5 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-amber-200">
                        Dangerous Heat Advisory
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">
                        {`${hotDays.length} hot ${hotDays.length === 1 ? 'day' : 'days'} ahead`}
                    </h2>
                </div>
                {hottestDay && (
                    <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-100/70">
                            Peak
                        </p>
                        <p className="text-4xl font-semibold leading-none text-amber-100">
                            {formatTemperature(hottestDay.highF)}
                        </p>
                    </div>
                )}
            </div>

            <div className="mt-4 divide-y divide-amber-100/10 border-t border-amber-100/10">
                {hotDays.map((day) => (
                    <div key={day.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                        <div>
                            <p className="font-semibold text-white">{formatDay(day.forecastedAt)}</p>
                            <p className="text-sm text-amber-100/70">{day.conditions}</p>
                        </div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-amber-200">
                            {heatSeverity(day.highF)}
                        </p>
                        <p className="text-lg font-semibold text-white">
                            {formatTemperature(day.highF)}
                            <span className="ml-2 text-sm font-medium text-amber-100/60">
                                / {formatTemperature(day.lowF)}
                            </span>
                        </p>
                    </div>
                ))}
            </div>
        </section>
    )
}
