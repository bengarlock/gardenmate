'use client'

import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'

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

function formatHour(value) {
    if (!value) return '--'
    return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
    }).format(new Date(value))
}

function dayStartLocal(value) {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date
}

function localDayKey(value) {
    const day = dayStartLocal(value)
    return Number.isNaN(day.getTime()) ? null : day.toISOString()
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

function WindArrow({ degrees }) {
    const rotation = Number.isFinite(Number(degrees)) ? Number(degrees) : 0

    return (
        <svg
            className="h-4 w-4 shrink-0 text-sky-100"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            style={{ transform: `rotate(${rotation}deg)` }}
        >
            <path d="M12 2 4 22l8-4 8 4L12 2Z" />
        </svg>
    )
}

function HourlyDayForecast({ day, hourly }) {
    const scrollRef = useRef(null)
    const dragRef = useRef({
        pointerId: null,
        startX: 0,
        startScrollLeft: 0,
        lastTime: 0,
        lastScrollLeft: 0,
        velocity: 0,
    })
    const glideFrameRef = useRef(null)
    const hours = hourly
        .map((row) => ({
            ...row,
            forecastDate: new Date(row.forecasted_at),
            temp: celsiusToFahrenheit(row.air_temperature),
            precipProbability: Number(row.precip_probability),
            windAvg: Number(row.wind_avg),
            windDirection: Number(row.wind_direction),
        }))
        .filter((row) => !Number.isNaN(row.forecastDate.getTime()))
        .sort((a, b) => a.forecastDate - b.forecastDate)

    function centerCurrentHour(behavior = 'auto') {
        const scroller = scrollRef.current
        if (!scroller || hours.length === 0) return

        const now = new Date()
        const selectedDay = dayStartLocal(day?.forecasted_at)
        const targetTime = new Date(selectedDay)
        targetTime.setHours(now.getHours(), now.getMinutes(), 0, 0)

        const targetIndex = hours.reduce((closestIndex, hour, index) => {
            const closestDistance = Math.abs(hours[closestIndex].forecastDate - targetTime)
            const distance = Math.abs(hour.forecastDate - targetTime)
            return distance < closestDistance ? index : closestIndex
        }, 0)
        const targetCard = scroller.querySelector(`[data-hour-index="${targetIndex}"]`)
        if (!targetCard) return

        const targetLeft = targetCard.offsetLeft - scroller.offsetLeft - (scroller.clientWidth / 2) + (targetCard.offsetWidth / 2)
        const scrollLeft = Math.max(0, targetLeft)
        if (typeof scroller.scrollTo === 'function') {
            scroller.scrollTo({ left: scrollLeft, behavior })
        } else {
            scroller.scrollLeft = scrollLeft
        }
    }

    useEffect(() => {
        centerCurrentHour()
    }, [day?.forecasted_at, hours])

    useEffect(() => {
        return () => {
            if (glideFrameRef.current) cancelAnimationFrame(glideFrameRef.current)
        }
    }, [])

    function stopGlide() {
        if (!glideFrameRef.current) return
        cancelAnimationFrame(glideFrameRef.current)
        glideFrameRef.current = null
    }

    function startGlide(initialVelocity) {
        const scroller = scrollRef.current
        if (!scroller || Math.abs(initialVelocity) < 0.02) return

        let velocity = initialVelocity
        let lastFrameTime = performance.now()

        function glide(frameTime) {
            const elapsed = frameTime - lastFrameTime
            lastFrameTime = frameTime

            scroller.scrollLeft += velocity * elapsed
            velocity *= Math.pow(0.94, elapsed / 16)

            const atStart = scroller.scrollLeft <= 0
            const atEnd = scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 1
            if (Math.abs(velocity) < 0.02 || (velocity < 0 && atStart) || (velocity > 0 && atEnd)) {
                glideFrameRef.current = null
                return
            }

            glideFrameRef.current = requestAnimationFrame(glide)
        }

        glideFrameRef.current = requestAnimationFrame(glide)
    }

    function handlePointerDown(event) {
        if (!scrollRef.current) return
        stopGlide()
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: scrollRef.current.scrollLeft,
            lastTime: performance.now(),
            lastScrollLeft: scrollRef.current.scrollLeft,
            velocity: 0,
        }
        scrollRef.current.setPointerCapture(event.pointerId)
    }

    function handlePointerMove(event) {
        const scroller = scrollRef.current
        if (!scroller || dragRef.current.pointerId !== event.pointerId) return
        const nextScrollLeft = dragRef.current.startScrollLeft - (event.clientX - dragRef.current.startX)
        const now = performance.now()
        const elapsed = Math.max(1, now - dragRef.current.lastTime)

        dragRef.current.velocity = (nextScrollLeft - dragRef.current.lastScrollLeft) / elapsed
        dragRef.current.lastTime = now
        dragRef.current.lastScrollLeft = nextScrollLeft
        scroller.scrollLeft = nextScrollLeft
    }

    function handlePointerEnd(event) {
        if (scrollRef.current?.hasPointerCapture(event.pointerId)) {
            scrollRef.current.releasePointerCapture(event.pointerId)
        }
        startGlide(dragRef.current.velocity)
        dragRef.current.pointerId = null
    }

    function handleCurrentClick() {
        stopGlide()
        centerCurrentHour('smooth')
    }

    if (!day || hours.length === 0) {
        return (
            <div className="mt-4 rounded-lg border border-sky-100/15 bg-sky-950/45 p-4 text-sky-100/75">
                Hourly forecast data is not available for this day yet.
            </div>
        )
    }

    return (
        <div className="mt-4 overflow-hidden rounded-lg border border-sky-100/15 bg-gradient-to-br from-sky-950/70 via-blue-950/70 to-cyan-950/60">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-sky-100/10 p-4">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-sky-200/70">
                        {formatDay(day.forecasted_at)}
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold text-white">{day.conditions ?? 'Forecast'}</h3>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-sky-100">
                    <WeatherIcon icon={day.icon} className="h-14 w-14 shrink-0" />
                    <span>Rain {formatNumber(day.precip_probability)}%</span>
                    <span>Low {formatTemperature(day.air_temperature_low)}</span>
                    <span>High {formatTemperature(day.air_temperature_high)}</span>
                    <button
                        type="button"
                        onClick={handleCurrentClick}
                        className="rounded-md border border-sky-100/20 bg-sky-100/10 px-3 py-2 text-sm font-semibold text-white transition hover:border-sky-100/40 hover:bg-sky-100/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    >
                        Current
                    </button>
                </div>
            </div>
            <div
                ref={scrollRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                className="cursor-grab select-none overflow-x-auto active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <div className="grid min-w-[64rem] grid-flow-col auto-cols-[7.5rem]">
                    {hours.map((hour, index) => (
                        <div
                            key={hour.id}
                            data-hour-index={index}
                            className="border-r border-sky-100/10 p-4 text-center last:border-r-0"
                        >
                            <p className="text-lg font-semibold text-white">{formatHour(hour.forecasted_at)}</p>
                            <div className="mt-4 flex justify-center">
                                <WeatherIcon icon={hour.icon} className="h-12 w-12" />
                            </div>
                            <p className="mt-4 text-2xl font-semibold text-white">
                                {hour.temp == null ? '--' : `${Math.round(hour.temp)}°`}
                            </p>
                            <p className="mt-3 text-sm text-sky-100">
                                Rain {Number.isFinite(hour.precipProbability) ? formatNumber(hour.precipProbability) : '--'}%
                            </p>
                            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-sky-100/80">
                                <WindArrow degrees={hour.windDirection} />
                                <span>{Number.isFinite(hour.windAvg) ? formatNumber(hour.windAvg) : '--'} mph</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
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
    const [selectedDailyKey, setSelectedDailyKey] = useState(null)

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
        () => {
            const todayStart = dayStartLocal(new Date()).getTime()
            return forecast
                .filter((row) => {
                    if (row.forecast_type !== 'daily') return false
                    const forecastDayStart = dayStartLocal(row.forecasted_at).getTime()
                    return Number.isFinite(forecastDayStart) && forecastDayStart >= todayStart
                })
                .sort((a, b) => new Date(a.forecasted_at) - new Date(b.forecasted_at))
        },
        [forecast]
    )
    const selectedDailyForecast = useMemo(
        () => dailyForecast.find((day) => localDayKey(day.forecasted_at) === selectedDailyKey) ?? null,
        [dailyForecast, selectedDailyKey]
    )
    const selectedHourlyForecast = useMemo(
        () => {
            if (!selectedDailyKey) return []
            return hourlyForecast.filter((hour) => localDayKey(hour.forecasted_at) === selectedDailyKey)
        },
        [hourlyForecast, selectedDailyKey]
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

    useEffect(() => {
        if (dailyForecast.length === 0) {
            if (selectedDailyKey !== null) setSelectedDailyKey(null)
            return
        }

        const hasSelectedDay = dailyForecast.some((day) => localDayKey(day.forecasted_at) === selectedDailyKey)
        if (!hasSelectedDay) setSelectedDailyKey(localDayKey(dailyForecast[0].forecasted_at))
    }, [dailyForecast, selectedDailyKey])

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
                            {dailyForecast.map((day) => {
                                const dayKey = localDayKey(day.forecasted_at)
                                const isSelected = dayKey === selectedDailyKey

                                return (
                                    <button
                                        key={day.id}
                                        type="button"
                                        onClick={() => setSelectedDailyKey(dayKey)}
                                        className={`flex h-full flex-col rounded-lg border bg-gradient-to-br p-4 text-left shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                                            isSelected
                                                ? 'border-sky-200/70 from-sky-700/85 via-blue-800/80 to-cyan-800/65 shadow-sky-500/20'
                                                : 'border-sky-100/15 from-sky-800/70 via-blue-900/70 to-cyan-900/50 hover:border-sky-200/45'
                                        }`}
                                    >
                                        <div className="flex min-h-[6.75rem] items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-sky-100/65">
                                                    {formatDay(day.forecasted_at)}
                                                </p>
                                                <p className="mt-2 min-h-[2.75rem] text-lg font-semibold leading-tight text-white">
                                                    {day.conditions ?? 'Forecast'}
                                                </p>
                                            </div>
                                            <WeatherIcon icon={day.icon} className="h-10 w-10 shrink-0" />
                                        </div>
                                        <div className="mt-auto flex items-baseline gap-2">
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
                                    </button>
                                )
                            })}
                        </div>
                        <HourlyDayForecast day={selectedDailyForecast} hourly={selectedHourlyForecast} />
                    </section>
                )}

                {!forecastLoading && !forecastError && (
                    <ForecastGraph hourly={hourlyForecast} />
                )}
            </div>
        </main>
    )
}
