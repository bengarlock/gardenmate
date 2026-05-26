'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'
const FORECAST_API = `${APP_BASE_PATH}/api/garden/weather/forecast`
const HISTORICAL_WEATHER_API = `${APP_BASE_PATH}/api/garden/weather`
const WEATHER_PROXY_API = `${APP_BASE_PATH}/api/weather`
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TEMP_COLOR_MIN_F = 0
const TEMP_COLOR_MAX_F = 100
const TEMP_COLOR_SWATCH = 'linear-gradient(90deg, hsl(220, 90%, 56%), hsl(170, 90%, 56%), hsl(90, 90%, 56%), hsl(45, 90%, 56%), hsl(0, 90%, 56%))'

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

function temperatureStrokeColor(tempF) {
    if (!Number.isFinite(tempF)) return 'hsl(45, 90%, 56%)'
    const ratio = Math.min(1, Math.max(0, (tempF - TEMP_COLOR_MIN_F) / (TEMP_COLOR_MAX_F - TEMP_COLOR_MIN_F)))
    const hue = Math.round(220 - ratio * 220)
    return `hsl(${hue}, 90%, 56%)`
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

function formatChartTick(value) {
    if (!value) return '--'
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
    }).format(new Date(value))
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

function monthStartLocal(value) {
    const date = new Date(value)
    return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addLocalMonths(value, months) {
    const date = new Date(value)
    return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function monthEndLocal(value) {
    const date = new Date(value)
    return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function isFullCalendarMonth(start, end) {
    return isSameLocalDay(start, monthStartLocal(start)) && isSameLocalDay(end, monthEndLocal(start))
}

function inclusiveDayCount(start, end) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000
    return Math.max(1, Math.round((dayStartLocal(end).getTime() - dayStartLocal(start).getTime()) / millisecondsPerDay) + 1)
}

function currentMonthRange() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
        start,
        end: monthEndLocal(start),
    }
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

function formatDayRange(start, end) {
    const formatter = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
    if (!start || !end) return ''
    if (isSameLocalDay(start, end)) return formatter.format(start)
    return `${formatter.format(start)} - ${formatter.format(end)}`
}

function formatDateParam(value) {
    const date = dayStartLocal(value)
    const pad = (number) => String(number).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function buildHistoricalWeatherUrl(start, end) {
    const params = new URLSearchParams({
        start: formatDateParam(start),
        end: formatDateParam(end),
    })
    return `${HISTORICAL_WEATHER_API}?${params.toString()}`
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

function historicalRecordDate(record) {
    const timestamp = Number(record.timestamp)
    if (Number.isFinite(timestamp)) return new Date(timestamp * 1000)
    return new Date(record.created_at)
}

function linePath(points, xScale, yScale, valueKey) {
    return points
        .filter((point) => Number.isFinite(point[valueKey]))
        .map((point, index) => {
            const command = index === 0 ? 'M' : 'L'
            return `${command}${xScale(point.chartTime ?? point.time)},${yScale(point[valueKey])}`
        })
        .join(' ')
}

function temperatureLineSegments(points, xScale, yScale) {
    const validPoints = points.filter((point) => Number.isFinite(point.temp))
    return validPoints.slice(1).map((point, index) => {
        const previous = validPoints[index]
        const temp = (previous.temp + point.temp) / 2
        return {
            id: `${previous.id ?? index}-${point.id ?? index + 1}`,
            x1: xScale(previous.chartTime ?? previous.time),
            y1: yScale(previous.temp),
            x2: xScale(point.chartTime ?? point.time),
            y2: yScale(point.temp),
            color: temperatureStrokeColor(temp),
        }
    })
}

function HistoricalWeatherChart() {
    const firstFetchRef = useRef(true)
    const firstOverlayFetchRef = useRef(true)
    const [records, setRecords] = useState([])
    const [overlayRecords, setOverlayRecords] = useState([])
    const [loading, setLoading] = useState(true)
    const [overlayLoading, setOverlayLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [overlayRefreshing, setOverlayRefreshing] = useState(false)
    const [error, setError] = useState(null)
    const [overlayError, setOverlayError] = useState(null)
    const [selectedDay, setSelectedDay] = useState(() => dayStartLocal(currentMonthRange().start))
    const [rangeApplied, setRangeApplied] = useState(() => currentMonthRange())
    const [rangeDraft, setRangeDraft] = useState({ start: null, end: null })
    const [rangePickerOpen, setRangePickerOpen] = useState(false)
    const [calendarMonth, setCalendarMonth] = useState(() => monthStartLocal(currentMonthRange().start))
    const [rangeValidationError, setRangeValidationError] = useState(null)
    const [visibleSeries, setVisibleSeries] = useState({
        temperature: true,
        humidity: false,
        rain: true,
    })
    const [showCurrentYearOverlay, setShowCurrentYearOverlay] = useState(false)
    const width = 900
    const height = 320
    const margin = { top: 22, right: 58, bottom: 54, left: 58 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const currentRange = useMemo(() => {
        if (rangeApplied?.start && rangeApplied?.end) {
            return {
                start: dayStartLocal(rangeApplied.start),
                end: dayStartLocal(rangeApplied.end),
            }
        }
        const day = dayStartLocal(selectedDay)
        return { start: day, end: day }
    }, [rangeApplied, selectedDay])

    const currentYear = new Date().getFullYear()
    const isCurrentYearRange = currentRange.start.getFullYear() === currentYear
    const overlayYear = isCurrentYearRange ? currentYear - 1 : currentYear

    const overlayRange = useMemo(() => {
        const currentYear = new Date().getFullYear()
        const isCurrentYearRange = currentRange.start.getFullYear() === currentYear
        const targetYear = isCurrentYearRange ? currentYear - 1 : currentYear
        const start = new Date(targetYear, currentRange.start.getMonth(), currentRange.start.getDate())
        const requestedEnd = new Date(targetYear, currentRange.end.getMonth(), currentRange.end.getDate())
        const today = dayStartLocal(new Date())
        const end = !isCurrentYearRange && isBeforeLocalDay(today, requestedEnd) ? today : requestedEnd
        return { start: dayStartLocal(start), end }
    }, [currentRange])

    const overlayAvailable = currentRange.start.getFullYear() !== overlayYear && !isBeforeLocalDay(overlayRange.end, overlayRange.start)

    useEffect(() => {
        let cancelled = false
        const isFirstFetch = firstFetchRef.current

        if (isFirstFetch) {
            setLoading(true)
        } else {
            setRefreshing(true)
        }
        setError(null)

        const fetchStart = addLocalDays(currentRange.start, -1)
        const fetchEnd = addLocalDays(currentRange.end, 1)

        fetch(buildHistoricalWeatherUrl(fetchStart, fetchEnd), { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return response.json()
            })
            .then((json) => {
                if (cancelled) return
                setRecords(Array.isArray(json) ? json : [])
                firstFetchRef.current = false
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

    useEffect(() => {
        let cancelled = false

        if (!overlayAvailable || !showCurrentYearOverlay) {
            if (!overlayAvailable) setOverlayRecords([])
            setOverlayLoading(false)
            setOverlayRefreshing(false)
            setOverlayError(null)
            return () => {
                cancelled = true
            }
        }

        const isFirstFetch = firstOverlayFetchRef.current

        if (isFirstFetch) {
            setOverlayLoading(true)
        } else {
            setOverlayRefreshing(true)
        }
        setOverlayError(null)

        const fetchStart = addLocalDays(overlayRange.start, -1)
        const fetchEnd = addLocalDays(overlayRange.end, 1)

        fetch(buildHistoricalWeatherUrl(fetchStart, fetchEnd), { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return response.json()
            })
            .then((json) => {
                if (cancelled) return
                setOverlayRecords(Array.isArray(json) ? json : [])
                firstOverlayFetchRef.current = false
            })
            .catch((e) => {
                if (!cancelled) setOverlayError(e.message ?? String(e))
            })
            .finally(() => {
                if (!cancelled) {
                    setOverlayLoading(false)
                    setOverlayRefreshing(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [overlayAvailable, overlayRange, showCurrentYearOverlay])

    const points = useMemo(
        () =>
            records
                .map((record, index) => {
                    const time = historicalRecordDate(record)
                    const temp = celsiusToFahrenheit(record.air_temperature)
                    const humidity = Number(record.relative_humidity)
                    const rain = Number(record.precip_accum_last_1hr)
                    const wind = Number(record.wind_avg)
                    if (Number.isNaN(time.getTime()) || temp == null) return null
                    return {
                        time,
                        chartTime: time,
                        id: record.id ?? `base-${index}`,
                        temp,
                        humidity: Number.isFinite(humidity) ? humidity : null,
                        rain: Number.isFinite(rain) ? Math.max(0, rain) : 0,
                        wind: Number.isFinite(wind) ? wind : null,
                    }
                })
                .filter(Boolean)
                .sort((a, b) => a.time - b.time),
        [records]
    )

    const overlayPoints = useMemo(
        () =>
            overlayRecords
                .map((record, index) => {
                    const time = historicalRecordDate(record)
                    const temp = celsiusToFahrenheit(record.air_temperature)
                    const humidity = Number(record.relative_humidity)
                    const rain = Number(record.precip_accum_last_1hr)
                    const wind = Number(record.wind_avg)
                    if (Number.isNaN(time.getTime()) || temp == null) return null
                    const chartTime = new Date(time)
                    chartTime.setFullYear(currentRange.start.getFullYear())
                    return {
                        time,
                        chartTime,
                        id: record.id ?? `overlay-${index}`,
                        temp,
                        humidity: Number.isFinite(humidity) ? humidity : null,
                        rain: Number.isFinite(rain) ? Math.max(0, rain) : 0,
                        wind: Number.isFinite(wind) ? wind : null,
                    }
                })
                .filter(Boolean)
                .sort((a, b) => a.time - b.time),
        [currentRange.start, overlayRecords]
    )

    const visiblePoints = useMemo(() => {
        if (points.length === 0) return []
        const startTime = dayStartLocal(currentRange.start).getTime()
        const endTime = addLocalDays(dayStartLocal(currentRange.end), 1).getTime()
        return points.filter((point) => {
            const pointTime = point.time.getTime()
            return pointTime >= startTime && pointTime < endTime
        })
    }, [currentRange, points])

    const visibleOverlayPoints = useMemo(() => {
        if (!showCurrentYearOverlay || overlayPoints.length === 0 || !overlayAvailable) return []
        const startTime = dayStartLocal(overlayRange.start).getTime()
        const endTime = addLocalDays(dayStartLocal(overlayRange.end), 1).getTime()
        return overlayPoints.filter((point) => {
            const pointTime = point.time.getTime()
            return pointTime >= startTime && pointTime < endTime
        })
    }, [overlayAvailable, overlayPoints, overlayRange, showCurrentYearOverlay])

    const hasVisibleSeries = visibleSeries.temperature || visibleSeries.humidity || visibleSeries.rain

    const chart = useMemo(() => {
        if (visiblePoints.length === 0) return null

        const firstTime = dayStartLocal(currentRange.start).getTime()
        const lastTime = addLocalDays(dayStartLocal(currentRange.end), 1).getTime()
        const timeSpan = Math.max(1, lastTime - firstTime)
        const chartPoints = [...visiblePoints, ...visibleOverlayPoints]
        const temps = chartPoints.map((point) => point.temp)
        const tempMin = Math.floor(Math.min(...temps) / 5) * 5 - 5
        const tempMax = Math.ceil(Math.max(...temps) / 5) * 5 + 5
        const tempSpan = Math.max(1, tempMax - tempMin)
        const maxRain = Math.max(0.01, ...chartPoints.map((point) => point.rain))
        const xScale = (time) => ((time.getTime() - firstTime) / timeSpan) * innerW
        const tempScale = (temp) => innerH - ((temp - tempMin) / tempSpan) * innerH
        const humidityScale = (humidity) => innerH - (humidity / 100) * innerH
        const rainScale = (rain) => (rain / maxRain) * innerH * 0.32
        const todayDate = dayStartLocal(new Date())
        const todayVisible = !isBeforeLocalDay(todayDate, currentRange.start) && !isBeforeLocalDay(currentRange.end, todayDate)
        const tempTicks = Array.from({ length: 5 }, (_, index) => tempMin + (tempSpan / 4) * index)
        const tickIndexes = Array.from(
            new Set([0, 1, 2, 3, 4].map((index) => Math.round((visiblePoints.length - 1) * (index / 4))))
        )
        const xTicks = tickIndexes.map((index) => visiblePoints[index]).filter(Boolean)
        const barWidth = Math.max(2, Math.min(10, innerW / visiblePoints.length - 1))

        return {
            tempMin,
            tempMax,
            maxRain,
            xScale,
            tempScale,
            humidityScale,
            rainScale,
            tempTicks,
            xTicks,
            barWidth,
            todayMarker: todayVisible
                ? {
                    x: xScale(todayDate),
                    labelX: Math.min(innerW - 28, Math.max(28, xScale(todayDate))),
                    labelAnchor: xScale(todayDate) < 48 ? 'start' : xScale(todayDate) > innerW - 48 ? 'end' : 'middle',
                }
                : null,
            tempSegments: temperatureLineSegments(visiblePoints, xScale, tempScale),
            humidityPath: linePath(visiblePoints, xScale, humidityScale, 'humidity'),
            overlayTempSegments: temperatureLineSegments(visibleOverlayPoints, xScale, tempScale),
            overlayHumidityPath: linePath(visibleOverlayPoints, xScale, humidityScale, 'humidity'),
        }
    }, [currentRange, innerH, innerW, visibleOverlayPoints, visiblePoints])

    const summary = useMemo(() => {
        if (visiblePoints.length === 0) return null
        const temps = visiblePoints.map((point) => point.temp)
        const humidities = visiblePoints.map((point) => point.humidity).filter((value) => value != null)
        const winds = visiblePoints.map((point) => point.wind).filter((value) => value != null)
        const rainTotal = visiblePoints.reduce((total, point) => total + point.rain, 0)
        return {
            high: Math.max(...temps),
            low: Math.min(...temps),
            humidity: humidities.length
                ? humidities.reduce((total, value) => total + value, 0) / humidities.length
                : null,
            wind: winds.length ? winds.reduce((total, value) => total + value, 0) / winds.length : null,
            rainTotal,
        }
    }, [visiblePoints])

    const activeDateLabel = formatDayRange(currentRange.start, currentRange.end)
    const isSelectedDayToday = isSameLocalDay(selectedDay, new Date())
    const navigationUnit = rangeApplied?.start && rangeApplied?.end && !isSameLocalDay(rangeApplied.start, rangeApplied.end)
        ? isFullCalendarMonth(dayStartLocal(rangeApplied.start), dayStartLocal(rangeApplied.end))
            ? 'month'
            : 'range'
        : 'day'
    const showChartLoadingPlaceholder = !error && (loading || refreshing) && (!chart || !summary)
    const chartBusyMessage =
        showChartLoadingPlaceholder
            ? loading
                ? 'Loading chart...'
                : 'Updating...'
            : refreshing
              ? 'Updating...'
              : showCurrentYearOverlay && overlayLoading
                ? 'Loading overlay...'
                : showCurrentYearOverlay && overlayRefreshing
                  ? 'Updating overlay...'
                  : null
    const statusMessage =
        showCurrentYearOverlay && overlayError
            ? { text: `Could not load current-year overlay: ${overlayError}`, className: 'text-red-100' }
            : null

    const calendarCells = useMemo(() => {
        const firstOfMonth = monthStartLocal(calendarMonth)
        const gridStart = addLocalDays(firstOfMonth, -firstOfMonth.getDay())
        return Array.from({ length: 42 }, (_, index) => dayStartLocal(addLocalDays(gridStart, index)))
    }, [calendarMonth])

    const calendarMonthLabel = useMemo(
        () =>
            new Intl.DateTimeFormat(undefined, {
                month: 'long',
                year: 'numeric',
            }).format(calendarMonth),
        [calendarMonth]
    )

    function handleDateStep(direction) {
        setRangePickerOpen(false)
        setRangeValidationError(null)

        if (!rangeApplied?.start || !rangeApplied?.end) {
            setSelectedDay((current) => dayStartLocal(addLocalDays(current, direction)))
            return
        }

        const start = dayStartLocal(rangeApplied.start)
        const end = dayStartLocal(rangeApplied.end)

        if (isSameLocalDay(start, end)) {
            const nextDay = dayStartLocal(addLocalDays(start, direction))
            setRangeApplied(null)
            setSelectedDay(nextDay)
            return
        }

        if (isFullCalendarMonth(start, end)) {
            const nextStart = addLocalMonths(start, direction)
            const nextRange = {
                start: nextStart,
                end: monthEndLocal(nextStart),
            }
            setRangeApplied(nextRange)
            setSelectedDay(dayStartLocal(nextRange.start))
            return
        }

        const days = inclusiveDayCount(start, end) * direction
        const nextRange = {
            start: dayStartLocal(addLocalDays(start, days)),
            end: dayStartLocal(addLocalDays(end, days)),
        }
        setRangeApplied(nextRange)
        setSelectedDay(dayStartLocal(nextRange.start))
    }

    function handleTodayClick() {
        setRangeApplied(null)
        setRangePickerOpen(false)
        setRangeValidationError(null)
        setSelectedDay(dayStartLocal(new Date()))
    }

    function handleCurrentMonthClick() {
        const today = new Date()
        const start = monthStartLocal(today)
        const nextRange = {
            start,
            end: monthEndLocal(start),
        }
        setRangeApplied(nextRange)
        setRangePickerOpen(false)
        setRangeValidationError(null)
        setSelectedDay(dayStartLocal(start))
        setCalendarMonth(start)
    }

    function openRangePicker() {
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

    function handleCalendarDateClick(day) {
        const clicked = dayStartLocal(day)
        setRangeValidationError(null)
        setRangeDraft((current) => {
            if (!current.start || current.end) return { start: clicked, end: null }
            if (isBeforeLocalDay(clicked, current.start)) return { start: clicked, end: current.start }
            return { start: current.start, end: clicked }
        })
    }

    function handleApplyRange() {
        if (!rangeDraft.start || !rangeDraft.end) {
            setRangeValidationError('Select a start day and an end day.')
            return
        }
        setRangeApplied({
            start: dayStartLocal(rangeDraft.start),
            end: dayStartLocal(rangeDraft.end),
        })
        setRangePickerOpen(false)
        setRangeValidationError(null)
    }

    function toggleSeries(seriesKey) {
        setVisibleSeries((current) => ({
            ...current,
            [seriesKey]: !current[seriesKey],
        }))
    }

    const rangePicker = rangePickerOpen ? (
        <div className="absolute left-1/2 top-32 z-30 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-sky-700/80 bg-blue-950/95 p-3 shadow-2xl ring-1 ring-sky-300/20">
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
        <section className="relative rounded-lg border border-sky-200/15 bg-gradient-to-br from-sky-950/85 via-blue-950/80 to-cyan-950/70 p-5 shadow-xl">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
                        History
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">Observed weather</h2>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleTodayClick}
                        className="h-9 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-blue-950 transition-colors hover:bg-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={handleCurrentMonthClick}
                        className="h-9 rounded-lg bg-sky-900/90 px-3 text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                        Month
                    </button>
                </div>
            </div>

            <div className="mb-4 rounded-lg border border-sky-100/15 bg-sky-950/35 p-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-200/70">
                        Baseline
                    </p>
                    <p className="text-sm font-semibold text-sky-50">{activeDateLabel}</p>
                </div>
            </div>

            <div className="mx-auto mb-4 grid w-full max-w-[28.5rem] grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center justify-center gap-2">
                <button
                    type="button"
                    onClick={() => handleDateStep(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-900/90 text-xl leading-none text-sky-100 transition-colors hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    aria-label={`Show previous ${navigationUnit}`}
                    title={`Previous ${navigationUnit}`}
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
                    onClick={() => handleDateStep(1)}
                    disabled={!rangeApplied && isSelectedDayToday}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-900/90 text-xl leading-none text-sky-100 transition-colors hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-sky-900/90"
                    aria-label={`Show next ${navigationUnit}`}
                    title={`Next ${navigationUnit}`}
                >
                    ›
                </button>
            </div>

            {rangePicker}

            <div className="mb-3 min-h-[1.25rem] text-sm font-semibold" aria-live="polite">
                {statusMessage && <span className={statusMessage.className}>{statusMessage.text}</span>}
            </div>
            {error && <div className="text-red-100">Could not load historical weather: {error}</div>}

            {!error && (
                <>
                    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <WeatherMetric
                            label="Observed high"
                            value={summary ? `${Math.round(summary.high)}°F` : '--'}
                            helper={summary ? `Low ${Math.round(summary.low)}°F` : activeDateLabel}
                        />
                        <WeatherMetric
                            label="Avg humidity"
                            value={summary?.humidity == null ? '--' : `${formatNumber(summary.humidity)}%`}
                            helper={summary ? `${visiblePoints.length} observations` : '0 observations'}
                        />
                        <WeatherMetric
                            label="Rain"
                            value={summary ? formatNumber(summary.rainTotal, 2) : '--'}
                            helper="Accumulated last-hour readings"
                        />
                        <WeatherMetric
                            label="Avg wind"
                            value={summary?.wind == null ? '--' : `${formatNumber(summary.wind, 1)} mph`}
                            helper={activeDateLabel}
                        />
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2 text-xs text-sky-100/75">
                        <button
                            type="button"
                            onClick={() => toggleSeries('temperature')}
                            className={`flex items-center gap-2 rounded-md border px-3 py-2 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                                visibleSeries.temperature
                                    ? 'border-amber-200/40 bg-amber-300/15 text-white'
                                    : 'border-sky-100/10 bg-sky-950/40 text-sky-100/45'
                            }`}
                            aria-pressed={visibleSeries.temperature}
                        >
                            <span className="h-1 w-5 rounded-full" style={{ background: TEMP_COLOR_SWATCH }} />
                            Temperature
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleSeries('humidity')}
                            className={`flex items-center gap-2 rounded-md border px-3 py-2 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                                visibleSeries.humidity
                                    ? 'border-cyan-200/40 bg-cyan-300/10 text-white'
                                    : 'border-sky-100/10 bg-sky-950/40 text-sky-100/45'
                            }`}
                            aria-pressed={visibleSeries.humidity}
                        >
                            <span className="h-0.5 w-5 rounded-full border-t border-dashed border-cyan-200" />
                            Humidity
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleSeries('rain')}
                            className={`flex items-center gap-2 rounded-md border px-3 py-2 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                                visibleSeries.rain
                                    ? 'border-sky-300/40 bg-sky-400/15 text-white'
                                    : 'border-sky-100/10 bg-sky-950/40 text-sky-100/45'
                            }`}
                            aria-pressed={visibleSeries.rain}
                        >
                            <span className="h-3 w-3 rounded-sm bg-sky-400/35" />
                            Rain
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowCurrentYearOverlay((current) => !current)}
                            disabled={!overlayAvailable}
                            className={`flex items-center gap-2 rounded-md border px-3 py-2 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-45 ${
                                showCurrentYearOverlay && overlayAvailable
                                    ? 'border-fuchsia-200/30 bg-fuchsia-300/10 text-fuchsia-50'
                                    : 'border-sky-100/10 bg-sky-950/40 text-sky-100/45'
                            }`}
                            aria-pressed={showCurrentYearOverlay && overlayAvailable}
                        >
                            <span className="h-0.5 w-5 border-t border-dashed border-rose-300 opacity-75" />
                            {overlayYear} overlay
                        </button>
                    </div>
                    {showChartLoadingPlaceholder ? (
                        <div
                            className="flex w-full items-center justify-center rounded-lg border border-sky-100/15 bg-sky-950/35 p-5 text-sky-100/75"
                            style={{ aspectRatio: `${width} / ${height}` }}
                        >
                            <span>{chartBusyMessage}</span>
                        </div>
                    ) : !loading && !refreshing && visiblePoints.length === 0 ? (
                        <div
                            className="flex w-full items-center justify-center rounded-lg border border-sky-100/15 bg-sky-950/35 p-5 text-sky-100/75"
                            style={{ aspectRatio: `${width} / ${height}` }}
                        >
                            <span>No historical weather data available.</span>
                        </div>
                    ) : !hasVisibleSeries ? (
                        <div
                            className="flex w-full items-center justify-center rounded-lg border border-sky-100/15 bg-sky-950/45 p-5 text-sky-100/75"
                            style={{ aspectRatio: `${width} / ${height}` }}
                        >
                            <span>Select at least one weather metric to display.</span>
                        </div>
                    ) : chart && summary ? (
                        <div className="relative">
                            <svg
                                width={width}
                                height={height}
                                viewBox={`0 0 ${width} ${height}`}
                                className="block h-auto w-full overflow-visible"
                                role="img"
                                aria-label="Historical weather chart showing selected observed weather metrics"
                            >
                            <g transform={`translate(${margin.left},${margin.top})`}>
                                {(visibleSeries.temperature ? chart.tempTicks : [0, 25, 50, 75, 100]).map((tick) => (
                                    <g key={`history-temp-grid-${tick}`}>
                                        <line
                                            x1={0}
                                            x2={innerW}
                                            y1={visibleSeries.temperature ? chart.tempScale(tick) : chart.humidityScale(tick)}
                                            y2={visibleSeries.temperature ? chart.tempScale(tick) : chart.humidityScale(tick)}
                                            stroke="#7dd3fc"
                                            strokeOpacity="0.16"
                                            strokeDasharray="4 7"
                                        />
                                        {visibleSeries.temperature && (
                                            <text
                                                x={-12}
                                                y={chart.tempScale(tick)}
                                                dy="0.35em"
                                                textAnchor="end"
                                                fill="#bae6fd"
                                                fillOpacity="0.72"
                                                fontSize={12}
                                            >
                                                {Math.round(tick)}°F
                                            </text>
                                        )}
                                    </g>
                                ))}
                                {visibleSeries.rain && visiblePoints.map((point, index) => {
                                    const barHeight = chart.rainScale(point.rain)
                                    return (
                                        <rect
                                            key={`history-rain-${point.id}-${index}`}
                                            x={chart.xScale(point.chartTime) - chart.barWidth / 2}
                                            y={innerH - barHeight}
                                            width={chart.barWidth}
                                            height={barHeight}
                                            fill="#38bdf8"
                                            opacity="0.28"
                                            rx={1}
                                        />
                                    )
                                })}
                                {visibleSeries.rain && showCurrentYearOverlay && visibleOverlayPoints.map((point, index) => {
                                    const barHeight = chart.rainScale(point.rain)
                                    return (
                                        <rect
                                            key={`history-overlay-rain-${point.id}-${index}`}
                                            x={chart.xScale(point.chartTime) + chart.barWidth / 2}
                                            y={innerH - barHeight}
                                            width={Math.max(2, chart.barWidth * 0.72)}
                                            height={barHeight}
                                            fill="#f0abfc"
                                            opacity="0.16"
                                            rx={1}
                                        />
                                    )
                                })}
                                {visibleSeries.temperature && chart.tempSegments.map((segment) => (
                                    <line
                                        key={`history-temp-${segment.id}`}
                                        x1={segment.x1}
                                        y1={segment.y1}
                                        x2={segment.x2}
                                        y2={segment.y2}
                                        stroke={segment.color}
                                        strokeWidth={3}
                                        strokeLinecap="round"
                                    />
                                ))}
                                {visibleSeries.temperature && showCurrentYearOverlay && chart.overlayTempSegments.map((segment) => (
                                    <line
                                        key={`history-overlay-temp-${segment.id}`}
                                        x1={segment.x1}
                                        y1={segment.y1}
                                        x2={segment.x2}
                                        y2={segment.y2}
                                        stroke={segment.color}
                                        strokeWidth={1.75}
                                        strokeDasharray="5 8"
                                        strokeLinecap="round"
                                        opacity="0.42"
                                    />
                                ))}
                                {visibleSeries.humidity && chart.humidityPath && (
                                    <path
                                        d={chart.humidityPath}
                                        fill="none"
                                        stroke="#a5f3fc"
                                        strokeWidth={2}
                                        strokeDasharray="6 7"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )}
                                {visibleSeries.humidity && showCurrentYearOverlay && chart.overlayHumidityPath && (
                                    <path
                                        d={chart.overlayHumidityPath}
                                        fill="none"
                                        stroke="#c084fc"
                                        strokeWidth={1.5}
                                        strokeDasharray="2 6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        opacity="0.45"
                                    />
                                )}
                                {chart.todayMarker && (
                                    <g>
                                        <line
                                            x1={chart.todayMarker.x}
                                            x2={chart.todayMarker.x}
                                            y1={0}
                                            y2={innerH}
                                            stroke="#fef08a"
                                            strokeOpacity="0.58"
                                            strokeDasharray="4 6"
                                        />
                                        <circle
                                            cx={chart.todayMarker.x}
                                            cy={0}
                                            r={4}
                                            fill="#fef08a"
                                            stroke="#0f172a"
                                            strokeWidth={1.5}
                                        />
                                        <text
                                            x={chart.todayMarker.labelX}
                                            y={-9}
                                            textAnchor={chart.todayMarker.labelAnchor}
                                            fill="#fef9c3"
                                            fontSize={12}
                                            fontWeight={700}
                                        >
                                            Today
                                        </text>
                                    </g>
                                )}
                                {chart.xTicks.map((point) => (
                                    <g
                                        key={`history-x-${point.time.toISOString()}`}
                                        transform={`translate(${chart.xScale(point.time)},${innerH})`}
                                    >
                                        <line y2={6} stroke="#bae6fd" strokeOpacity="0.35" />
                                        <text y={24} textAnchor="middle" fill="#bae6fd" fillOpacity="0.72" fontSize={12}>
                                            {formatChartTick(point.time)}
                                        </text>
                                    </g>
                                ))}
                                {visibleSeries.humidity && [0, 50, 100].map((tick) => (
                                    <text
                                        key={`history-humidity-${tick}`}
                                        x={innerW + 12}
                                        y={chart.humidityScale(tick)}
                                        dy="0.35em"
                                        fill="#a5f3fc"
                                        fillOpacity="0.72"
                                        fontSize={12}
                                    >
                                        {tick}%
                                    </text>
                                ))}
                            </g>
                            </svg>
                            {chartBusyMessage && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <span className="rounded-md border border-sky-100/15 bg-sky-950/80 px-3 py-2 text-sm font-semibold text-cyan-100 shadow-lg">
                                        {chartBusyMessage}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : null}
                </>
            )}
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

                <HistoricalWeatherChart />
            </div>
        </main>
    )
}
