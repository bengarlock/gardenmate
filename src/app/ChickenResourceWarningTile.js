'use client'

import Link from 'next/link'
import {useEffect, useMemo, useState} from 'react'
import {isPlantPestResource} from '@/app/ResourceTrackerPage'

const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'
const TRACKER_API = `${APP_BASE_PATH}/api/chicken-tracker-items`

function warningThreshold(item) {
    const threshold = Number(item.warning_threshold_percent)
    if (!Number.isFinite(threshold)) return 25
    return Math.max(0, Math.min(100, threshold))
}

function formatDays(days) {
    if (days === null || days === undefined) return 'timeline unknown'
    const numericDays = Number(days)
    if (!Number.isFinite(numericDays)) return 'timeline unknown'
    if (numericDays <= 0) return 'depleted'
    if (numericDays < 1) return `${Math.max(1, Math.round(numericDays * 24))} hr left`
    return `${numericDays.toFixed(numericDays < 10 ? 1 : 0)} days left`
}

export function ResourceWarningTile({
    href,
    eyebrow,
    itemFilter = () => true,
}) {
    const [items, setItems] = useState([])

    useEffect(() => {
        let cancelled = false

        async function loadItems() {
            try {
                const response = await fetch(TRACKER_API, {cache: 'no-store'})
                const data = await response.json()
                if (!response.ok || cancelled) return
                setItems(Array.isArray(data.results) ? data.results.filter(itemFilter) : [])
            } catch {
                if (!cancelled) setItems([])
            }
        }

        loadItems()

        return () => {
            cancelled = true
        }
    }, [])

    const warnings = useMemo(() => {
        return items
            .filter((item) => {
                const percentRemaining = Number(item.percent_remaining)
                return item.status !== 'paused' && Number.isFinite(percentRemaining) && percentRemaining <= warningThreshold(item)
            })
            .sort((a, b) => Number(a.percent_remaining) - Number(b.percent_remaining))
    }, [items])

    if (warnings.length === 0) return null

    const criticalCount = warnings.filter((item) => Number(item.percent_remaining) <= 0).length

    return (
        <Link
            href={href}
            aria-live="polite"
            className="group block min-h-36 rounded-lg border border-amber-300/50 bg-amber-950/85 p-5 shadow-xl shadow-amber-950/30 transition hover:border-amber-200 hover:bg-amber-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 md:col-span-2"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase text-amber-200">
                        {eyebrow}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-white">
                        {criticalCount > 0 ? 'Resource depleted' : 'Resource running low'}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-amber-50/90">
                        {warnings.length === 1
                            ? `${warnings[0].name} is at or below ${warningThreshold(warnings[0])}%.`
                            : `${warnings.length} tracked resources are at or below their warning thresholds.`}
                    </p>
                </div>

                <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200/50 px-3 py-1 text-xs font-semibold uppercase text-amber-100">
                    Warning
                </span>
            </div>

            <div className="mt-5 grid gap-2">
                {warnings.slice(0, 3).map((item) => {
                    const percentRemaining = Math.max(0, Math.min(100, Number(item.percent_remaining)))
                    const threshold = warningThreshold(item)

                    return (
                        <div key={item.id} className="grid gap-1">
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="min-w-0 truncate font-semibold text-white">{item.name}</span>
                                <span className="shrink-0 text-amber-100">
                                    {Math.round(percentRemaining)}% / {threshold}% - {formatDays(item.days_remaining)}
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-stone-950/60">
                                <div
                                    className="h-full rounded-full bg-amber-300"
                                    style={{width: `${percentRemaining}%`}}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {warnings.length > 3 ? (
                <p className="mt-3 text-sm font-semibold text-amber-100">
                    +{warnings.length - 3} more
                </p>
            ) : null}
        </Link>
    )
}

export function PlantPestResourceWarningTile() {
    return (
        <ResourceWarningTile
            href="/plants/pests"
            eyebrow="Plant pest resources"
            itemFilter={isPlantPestResource}
        />
    )
}

export default function ChickenResourceWarningTile() {
    return (
        <ResourceWarningTile
            href="/chickens/resources"
            eyebrow="Chicken resources"
            itemFilter={(item) => !isPlantPestResource(item)}
        />
    )
}
