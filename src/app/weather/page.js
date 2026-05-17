'use client'

import * as d3 from 'd3'
import { useEffect, useMemo, useState } from 'react'

const FORECAST_API = 'https://bengarlock.com/api/v1/garden/weather/forecast/'
const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'
const WEATHER_PROXY_API = `${APP_BASE_PATH}/api/weather`

function celsiusToFahrenheit(value) {
    return value == null || Number.isNaN(Number(value)) ? null : (Number(value) * 9) / 5 + 32
}

function formatNumber(value, digits = 0) {
    if (value == null || Number.isNaN(Number(value))) return '--'
    return Number(value).toFixed(digits)
}

function formatTemperature(value) {
    const temp = celsiusToFahrenheit(value)
    return temp == null ? '--' : `${Math.round(temp)}°F`
}

function formatTime(epochSeconds) {
    if (!epochSeconds) return '--'
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(epochSeconds * 1000))
}

function formatDateTime(value) {
    if (!value) return '--'
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
    }).format(new Date(value))
}

function formatDay(value) {
    if (!value) return '--'
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }).format(new Date(value))
}

function windDirectionLabel(degrees) {
    if (degrees == null || Number.isNaN(Number(degrees))) return '--'
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    return labels[Math.round(Number(degrees) / 45) % labels.length]
}

function WeatherMetric({ label, value, helper }) {
    return (
        <div className="rounded-lg border border-sky-200/15 bg-gradient-to-br from-sky-950/85 via-blue-950/80 to-cyan-950/70 p-4 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-200/70">
                {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
            {helper && <p className="mt-1 text-sm text-sky-100/65">{helper}</p>}
        </div>
    )
}

function WeatherIcon({ icon, className = 'h-10 w-10' }) {
    const name = String(icon || '').toLowerCase()
    const isRain = name.includes('rain') || name.includes('shower') || name.includes('storm')
    const isCloud = name.includes('cloud') || isRain
    const isNight = name.includes('night')

    if (isRain) {
        return (
            <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path
                    d="M15 29h19a8 8 0 0 0 .5-16 12 12 0 0 0-22.9 3A7 7 0 0 0 15 29Z"
                    fill="#94a3b8"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                    strokeLinejoin="round"
                />
                <path d="M17 35v5M25 34v6M33 35v5" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
            </svg>
        )
    }

    if (isCloud) {
        return (
            <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="18" cy="18" r="8" fill={isNight ? '#bfdbfe' : '#fcd34d'} />
                <path
                    d="M16 32h19a7 7 0 0 0 .4-14 11 11 0 0 0-21.1 2.5A6 6 0 0 0 16 32Z"
                    fill="#94a3b8"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                    strokeLinejoin="round"
                />
            </svg>
        )
    }

    return (
        <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="10" fill={isNight ? '#bfdbfe' : '#fcd34d'} />
            <path
                d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M37.4 10.6l-4.2 4.2M14.8 33.2l-4.2 4.2"
                stroke={isNight ? '#dbeafe' : '#fde68a'}
                strokeWidth="3"
                strokeLinecap="round"
            />
        </svg>
    )
}

function ForecastGraph({ hourly }) {
    const width = 900
    const height = 320
    const margin = { top: 22, right: 64, bottom: 54, left: 58 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const points = useMemo(
        () =>
            hourly
                .map((row) => {
                    const t = new Date(row.forecasted_at)
                    const temp = celsiusToFahrenheit(row.air_temperature)
                    const feelsLike = celsiusToFahrenheit(row.feels_like)
                    const precipProbability = Number(row.precip_probability)
                    if (Number.isNaN(t.getTime()) || temp == null) return null
                    return {
                        t,
                        temp,
                        feelsLike,
                        precipProbability: Number.isFinite(precipProbability) ? precipProbability : 0,
                        conditions: row.conditions,
                    }
                })
                .filter(Boolean)
                .sort((a, b) => a.t - b.t),
        [hourly]
    )

    const xDomain = useMemo(() => {
        if (points.length === 0) return [new Date(), new Date()]
        return [points[0].t, points[points.length - 1].t]
    }, [points])

    const tempDomain = useMemo(() => {
        const values = points.flatMap((point) =>
            point.feelsLike == null ? [point.temp] : [point.temp, point.feelsLike]
        )
        if (values.length === 0) return [30, 90]
        const min = Math.floor(Math.min(...values) / 5) * 5 - 5
        const max = Math.ceil(Math.max(...values) / 5) * 5 + 5
        return [min, max]
    }, [points])

    const xScale = useMemo(
        () => d3.scaleTime().domain(xDomain).range([0, innerW]),
        [xDomain, innerW]
    )
    const tempScale = useMemo(
        () => d3.scaleLinear().domain(tempDomain).range([innerH, 0]),
        [tempDomain, innerH]
    )
    const precipScale = useMemo(
        () => d3.scaleLinear().domain([0, 100]).range([innerH, 0]),
        [innerH]
    )

    const tempPath = useMemo(
        () =>
            d3
                .line()
                .x((point) => xScale(point.t))
                .y((point) => tempScale(point.temp))
                .curve(d3.curveMonotoneX)(points),
        [points, xScale, tempScale]
    )

    const feelsPath = useMemo(
        () =>
            d3
                .line()
                .defined((point) => point.feelsLike != null)
                .x((point) => xScale(point.t))
                .y((point) => tempScale(point.feelsLike))
                .curve(d3.curveMonotoneX)(points),
        [points, xScale, tempScale]
    )

    if (points.length === 0) {
        return (
            <div className="rounded-lg border border-sky-200/15 bg-gradient-to-br from-sky-950/85 via-blue-950/80 to-cyan-950/70 p-5 text-sky-100/75 shadow-xl">
                No hourly forecast data available.
            </div>
        )
    }

    const barWidth = Math.max(2, innerW / points.length - 1)
    const xTicks = xScale.ticks(6)

    return (
        <section className="rounded-lg border border-sky-200/15 bg-gradient-to-br from-sky-950/85 via-blue-950/80 to-cyan-950/70 p-5 shadow-xl">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                        Forecast
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">Hourly outlook</h2>
                </div>
                <div className="flex gap-4 text-xs text-stone-300">
                    <span className="flex items-center gap-2">
                        <span className="h-0.5 w-5 rounded-full bg-amber-300" />
                        Temp
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="h-0.5 w-5 rounded-full border-t border-dashed border-sky-300" />
                        Feels
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-sky-400/40" />
                        Rain %
                    </span>
                </div>
            </div>
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className="block h-auto w-full overflow-visible"
                role="img"
                aria-label="Hourly forecast chart showing temperature, feels-like temperature, and precipitation probability"
            >
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {tempScale.ticks(5).map((tick) => (
                        <g key={`temp-grid-${tick}`}>
                            <line
                                x1={0}
                                x2={innerW}
                                y1={tempScale(tick)}
                                y2={tempScale(tick)}
                                stroke="#3f3f46"
                                strokeDasharray="4 6"
                            />
                            <text
                                x={-12}
                                y={tempScale(tick)}
                                dy="0.35em"
                                textAnchor="end"
                                fill="#a8a29e"
                                fontSize={12}
                            >
                                {tick}°F
                            </text>
                        </g>
                    ))}
                    {points.map((point, i) => {
                        const h = innerH - precipScale(point.precipProbability)
                        return (
                            <rect
                                key={`precip-${point.t.toISOString()}`}
                                x={xScale(point.t) - barWidth / 2}
                                y={precipScale(point.precipProbability)}
                                width={barWidth}
                                height={h}
                                fill="#38bdf8"
                                opacity={0.26}
                                rx={1}
                            />
                        )
                    })}
                    {tempPath && (
                        <path
                            d={tempPath}
                            fill="none"
                            stroke="#fcd34d"
                            strokeWidth={3}
                            strokeLinecap="round"
                        />
                    )}
                    {feelsPath && (
                        <path
                            d={feelsPath}
                            fill="none"
                            stroke="#7dd3fc"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            strokeLinecap="round"
                        />
                    )}
                    {points.filter((_, i) => i % Math.ceil(points.length / 14) === 0).map((point) => (
                        <circle
                            key={`temp-dot-${point.t.toISOString()}`}
                            cx={xScale(point.t)}
                            cy={tempScale(point.temp)}
                            r={3}
                            fill="#fef3c7"
                            stroke="#92400e"
                            strokeWidth={1}
                        />
                    ))}
                    {xTicks.map((tick) => (
                        <g key={`x-${tick.toISOString()}`} transform={`translate(${xScale(tick)},${innerH})`}>
                            <line y2={6} stroke="#78716c" />
                            <text y={24} textAnchor="middle" fill="#a8a29e" fontSize={12}>
                                {formatDateTime(tick)}
                            </text>
                        </g>
                    ))}
                    {[0, 50, 100].map((tick) => (
                        <text
                            key={`precip-axis-${tick}`}
                            x={innerW + 12}
                            y={precipScale(tick)}
                            dy="0.35em"
                            fill="#7dd3fc"
                            fontSize={12}
                        >
                            {tick}%
                        </text>
                    ))}
                </g>
            </svg>
        </section>
    )
}

export default function WeatherPage() {
    const [weather, setWeather] = useState(null)
    const [forecast, setForecast] = useState([])
    const [loading, setLoading] = useState(true)
    const [forecastLoading, setForecastLoading] = useState(true)
    const [error, setError] = useState(null)
    const [forecastError, setForecastError] = useState(null)

    useEffect(() => {
        let cancelled = false

        fetch(WEATHER_PROXY_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return response.json()
            })
            .then((json) => {
                if (cancelled) return
                setWeather(json)
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

    useEffect(() => {
        let cancelled = false

        fetch(FORECAST_API)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return response.json()
            })
            .then((json) => {
                if (cancelled) return
                setForecast(Array.isArray(json) ? json : [])
                setForecastError(null)
            })
            .catch((e) => {
                if (!cancelled) setForecastError(e.message ?? String(e))
            })
            .finally(() => {
                if (!cancelled) setForecastLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [])

    const observation = weather?.obs?.[0] ?? null
    const hourlyForecast = useMemo(
        () => forecast.filter((row) => row.forecast_type === 'hourly'),
        [forecast]
    )
    const dailyForecast = useMemo(
        () => forecast.filter((row) => row.forecast_type === 'daily'),
        [forecast]
    )
    const metrics = useMemo(() => {
        if (!observation) return []

        return [
            {
                label: 'Feels like',
                value: formatTemperature(observation.feels_like),
                helper: `Air ${formatTemperature(observation.air_temperature)}`,
            },
            {
                label: 'Humidity',
                value: `${formatNumber(observation.relative_humidity)}%`,
                helper: `Dew point ${formatTemperature(observation.dew_point)}`,
            },
            {
                label: 'Wind',
                value: `${formatNumber(observation.wind_avg, 1)} mph`,
                helper: `${windDirectionLabel(observation.wind_direction)} gust ${formatNumber(observation.wind_gust, 1)} mph`,
            },
            {
                label: 'Rain today',
                value: `${formatNumber(observation.precip_accum_local_day, 2)} in`,
                helper: `${formatNumber(observation.precip_minutes_local_day)} min`,
            },
            {
                label: 'Pressure',
                value: `${formatNumber(observation.barometric_pressure, 1)} hPa`,
                helper: observation.pressure_trend ?? 'steady',
            },
            {
                label: 'UV',
                value: formatNumber(observation.uv, 1),
                helper: `${formatNumber(observation.solar_radiation)} W/m² solar`,
            },
        ]
    }, [observation])

    return (
        <main className="min-h-screen w-full bg-gradient-to-br from-sky-950/90 via-blue-950/85 to-cyan-950/80 text-stone-50">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-2 border-b border-white/10 pb-5">
                    <p className="text-sm font-semibold uppercase text-sky-300">
                        Garden dashboard
                    </p>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <h1 className="text-3xl font-semibold text-white md:text-5xl">
                            Weather
                        </h1>
                        {weather?.station_name && (
                            <div className="text-right text-sm text-stone-300">
                                <p className="font-semibold text-white">{weather.station_name}</p>
                                <p>{formatTime(observation?.timestamp)}</p>
                            </div>
                        )}
                    </div>
                </header>

                {forecastLoading && (
                    <section className="rounded-lg border border-sky-200/15 bg-gradient-to-br from-sky-950/85 via-blue-950/80 to-cyan-950/70 p-5 text-sky-100/75 shadow-xl">
                        Loading forecast...
                    </section>
                )}

                {forecastError && (
                    <section className="rounded-lg border border-red-400/30 bg-gradient-to-br from-red-950/70 via-blue-950/60 to-sky-950/70 p-5 text-red-100 shadow-xl">
                        Could not load forecast: {forecastError}
                    </section>
                )}

                {!forecastLoading && !forecastError && dailyForecast.length > 0 && (
                    <section className="rounded-lg border border-sky-200/15 bg-gradient-to-br from-sky-900/85 via-blue-950/85 to-cyan-950/75 p-5 shadow-xl">
                        <div className="mb-4 flex items-end justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
                                    Daily
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold text-white">10-day outlook</h2>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            {dailyForecast.map((day) => (
                                <div
                                    key={day.id}
                                    className="rounded-lg border border-sky-100/15 bg-gradient-to-br from-sky-800/70 via-blue-900/70 to-cyan-900/50 p-4 shadow-lg"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-sky-100/65">
                                                {formatDay(day.forecasted_at)}
                                            </p>
                                            <p className="mt-2 text-lg font-semibold leading-tight text-white">
                                                {day.conditions ?? 'Forecast'}
                                            </p>
                                        </div>
                                        <WeatherIcon icon={day.icon} className="h-10 w-10 shrink-0" />
                                    </div>
                                    <div className="mt-4 flex items-baseline gap-2">
                                        <span className="text-2xl font-semibold text-white">
                                            {formatTemperature(day.air_temperature_high)}
                                        </span>
                                        <span className="text-sm text-sky-100/60">
                                            / {formatTemperature(day.air_temperature_low)}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-xs text-sky-100">
                                        Rain {formatNumber(day.precip_probability)}%
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {loading && (
                    <section className="rounded-lg border border-sky-200/15 bg-gradient-to-br from-sky-950/85 via-blue-950/80 to-cyan-950/70 p-5 text-sky-100/75 shadow-xl">
                        Loading weather...
                    </section>
                )}

                {error && (
                    <section className="rounded-lg border border-red-400/30 bg-red-950/60 p-5 text-red-100 shadow-xl">
                        Could not load weather: {error}
                    </section>
                )}

                {observation && (
                    <>
                        <section className="rounded-lg border border-sky-200/15 bg-gradient-to-br from-sky-950/85 via-blue-950/80 to-cyan-950/70 p-5 shadow-xl">
                            <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
                                Current
                            </p>
                            <div className="mt-3 flex flex-wrap items-end gap-4">
                                <p className="text-7xl font-semibold leading-none text-white">
                                    {formatTemperature(observation.air_temperature)}
                                </p>
                                <div className="pb-2 text-sky-100/75">
                                    <p>Feels like {formatTemperature(observation.feels_like)}</p>
                                    <p>{formatNumber(observation.relative_humidity)}% humidity</p>
                                </div>
                            </div>
                        </section>

                        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {metrics.map((metric) => (
                                <WeatherMetric
                                    key={metric.label}
                                    label={metric.label}
                                    value={metric.value}
                                    helper={metric.helper}
                                />
                            ))}
                        </section>
                    </>
                )}

                {!forecastLoading && !forecastError && (
                    <ForecastGraph hourly={hourlyForecast} />
                )}
            </div>
        </main>
    )
}
