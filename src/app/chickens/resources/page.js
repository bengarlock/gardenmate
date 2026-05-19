'use client'

import { useEffect, useMemo, useState } from 'react'
import ChickenPageHeader from '@/app/chickens/ChickenPageHeader'
import ChickenSubNav from '@/app/chickens/ChickenSubNav'

const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'
const TRACKER_API = `${APP_BASE_PATH}/api/chicken-tracker-items`

const trackerTypes = [
    ['feed', 'Feed'],
    ['water', 'Water'],
    ['cleaning', 'Cleaning'],
    ['bedding', 'Bedding'],
    ['supply', 'Supply'],
    ['medication', 'Medication'],
    ['custom', 'Custom'],
]

const initialForm = {
    name: '',
    tracker_type: 'feed',
    location: '',
    unit: '',
    target_amount: '',
    current_amount: '',
    depletion_days: '7',
    last_reset_at: '',
    notes: '',
}

function asNumberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

function toIsoFromLocalInput(value) {
    if (!value) return undefined
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function formatDate(value) {
    if (!value) return 'Not set'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Not set'
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date)
}

function formatDays(days) {
    if (days === null || days === undefined) return 'Unknown'
    if (days <= 0) return 'Depleted'
    if (days < 1) return `${Math.max(1, Math.round(days * 24))} hr left`
    return `${days.toFixed(days < 10 ? 1 : 0)} days left`
}

function trackerTone(percent) {
    if (percent === null || percent === undefined) return 'bg-stone-500'
    if (percent <= 20) return 'bg-red-400'
    if (percent <= 45) return 'bg-amber-300'
    return 'bg-emerald-300'
}

export default function ChickenResourcesPage() {
    const [items, setItems] = useState([])
    const [form, setForm] = useState(initialForm)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            const aRemaining = a.percent_remaining ?? -1
            const bRemaining = b.percent_remaining ?? -1
            return aRemaining - bRemaining || a.name.localeCompare(b.name)
        })
    }, [items])

    async function loadItems() {
        setError('')
        setLoading(true)
        try {
            const response = await fetch(TRACKER_API, { cache: 'no-store' })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || 'Could not load resources.')
            setItems(Array.isArray(data.results) ? data.results : [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadItems()
    }, [])

    function updateForm(field, value) {
        setForm((current) => ({ ...current, [field]: value }))
    }

    async function createItem(event) {
        event.preventDefault()
        setSaving(true)
        setError('')
        const payload = {
            name: form.name.trim(),
            tracker_type: form.tracker_type,
            location: form.location.trim(),
            unit: form.unit.trim(),
            target_amount: asNumberOrNull(form.target_amount),
            current_amount: asNumberOrNull(form.current_amount),
            depletion_days: Number(form.depletion_days),
            notes: form.notes.trim(),
        }
        const resetAt = toIsoFromLocalInput(form.last_reset_at)
        if (resetAt) payload.last_reset_at = resetAt

        try {
            const response = await fetch(TRACKER_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || 'Could not create resource.')
            setForm(initialForm)
            setShowCreateForm(false)
            await loadItems()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function resetItem(item) {
        setError('')
        const response = await fetch(`${TRACKER_API}/${item.id}/reset`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_amount: item.target_amount }),
        })
        const data = await response.json()
        if (!response.ok) {
            setError(data.message || 'Could not reset resource.')
            return
        }
        setItems((current) => current.map((entry) => (entry.id === item.id ? data : entry)))
    }

    async function archiveItem(item) {
        setError('')
        const response = await fetch(`${TRACKER_API}/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'archived' }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
            setError(data.message || 'Could not archive resource.')
            return
        }
        setItems((current) => current.filter((entry) => entry.id !== item.id))
    }

    return (
        <main className="min-h-screen w-full bg-stone-950/80 text-stone-50">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <ChickenPageHeader
                    title="Resources"
                    eyebrow="Chickens"
                    eyebrowHref="/chickens"
                />

                <ChickenSubNav />

                <section className="grid gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-xl font-semibold text-white">Tracked Resources</h2>
                            <p className="mt-1 text-sm text-stone-300">
                                {loading ? 'Loading' : `${sortedItems.length} active`}
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-label={showCreateForm ? 'Close resource form' : 'Create resource'}
                            title={showCreateForm ? 'Close' : 'Create resource'}
                            onClick={() => {
                                setError('')
                                setShowCreateForm((current) => !current)
                            }}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-3xl font-semibold leading-none text-stone-950 shadow-xl transition hover:bg-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
                        >
                            {showCreateForm ? 'x' : '+'}
                        </button>
                    </div>

                    {showCreateForm ? (
                        <form
                            onSubmit={createItem}
                            className="rounded-lg border border-emerald-200/15 bg-stone-950/75 p-4 shadow-xl"
                        >
                            <div className="grid gap-4">
                                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                                    <h3 className="text-lg font-semibold text-white">New Resource</h3>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForm(initialForm)
                                            setShowCreateForm(false)
                                        }}
                                        className="min-h-10 rounded-md border border-white/15 px-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
                                    <label className="grid gap-1 text-sm font-semibold text-emerald-100">
                                        Name
                                        <input
                                            required
                                            value={form.name}
                                            onChange={(event) => updateForm('name', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-emerald-300"
                                        />
                                    </label>

                                    <label className="grid gap-1 text-sm font-semibold text-emerald-100">
                                        Type
                                        <select
                                            value={form.tracker_type}
                                            onChange={(event) => updateForm('tracker_type', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-emerald-300"
                                        >
                                            {trackerTypes.map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="grid gap-1 text-sm font-semibold text-emerald-100">
                                        Days
                                        <input
                                            required
                                            min="0.25"
                                            step="0.25"
                                            type="number"
                                            value={form.depletion_days}
                                            onChange={(event) => updateForm('depletion_days', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-emerald-300"
                                        />
                                    </label>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <label className="grid gap-1 text-sm font-semibold text-emerald-100">
                                        Current
                                        <input
                                            step="0.01"
                                            type="number"
                                            value={form.current_amount}
                                            onChange={(event) => updateForm('current_amount', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-emerald-300"
                                        />
                                    </label>
                                    <label className="grid gap-1 text-sm font-semibold text-emerald-100">
                                        Target
                                        <input
                                            step="0.01"
                                            type="number"
                                            value={form.target_amount}
                                            onChange={(event) => updateForm('target_amount', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-emerald-300"
                                        />
                                    </label>
                                    <label className="grid gap-1 text-sm font-semibold text-emerald-100">
                                        Unit
                                        <input
                                            value={form.unit}
                                            onChange={(event) => updateForm('unit', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-emerald-300"
                                        />
                                    </label>
                                    <label className="grid gap-1 text-sm font-semibold text-emerald-100">
                                        Location
                                        <input
                                            value={form.location}
                                            onChange={(event) => updateForm('location', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-emerald-300"
                                        />
                                    </label>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-[18rem_1fr_auto] lg:items-end">
                                    <label className="grid gap-1 text-sm font-semibold text-emerald-100">
                                        Last reset
                                        <input
                                            type="datetime-local"
                                            value={form.last_reset_at}
                                            onChange={(event) => updateForm('last_reset_at', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-emerald-300"
                                        />
                                    </label>

                                    <label className="grid gap-1 text-sm font-semibold text-emerald-100">
                                        Notes
                                        <input
                                            value={form.notes}
                                            onChange={(event) => updateForm('notes', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-emerald-300"
                                        />
                                    </label>

                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="min-h-11 rounded-md bg-emerald-300 px-5 text-base font-bold text-stone-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {saving ? 'Saving' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : null}

                    <section className="min-w-0">
                        {error ? (
                            <p className="mb-4 rounded-md border border-red-300/30 bg-red-950/50 px-4 py-3 text-sm text-red-100">
                                {error}
                            </p>
                        ) : null}

                        {loading ? (
                            <div className="rounded-lg border border-emerald-200/15 bg-stone-950/70 p-6 text-emerald-100">
                                Loading resources
                            </div>
                        ) : sortedItems.length === 0 && !error ? (
                            <div className="rounded-lg border border-emerald-200/15 bg-stone-950/70 p-6 text-emerald-100">
                                No resources are being tracked yet.
                            </div>
                        ) : sortedItems.length > 0 ? (
                            <div className="grid gap-4">
                                {sortedItems.map((item) => {
                                    const percent = item.percent_remaining ?? 0
                                    const amountLabel = item.current_amount || item.target_amount
                                        ? `${item.current_amount ?? '-'} / ${item.target_amount ?? '-'} ${item.unit || ''}`.trim()
                                        : ''
                                    const daysRemaining = item.days_remaining === null || item.days_remaining === undefined
                                        ? null
                                        : Number(item.days_remaining)

                                    return (
                                        <article
                                            key={item.id}
                                            className="rounded-lg border border-emerald-200/15 bg-stone-950/70 p-4 shadow-xl"
                                        >
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold uppercase text-emerald-300">
                                                        {trackerTypes.find(([value]) => value === item.tracker_type)?.[1] || 'Custom'}
                                                        {item.location ? ` / ${item.location}` : ''}
                                                    </p>
                                                    <h2 className="mt-1 break-words text-xl font-semibold text-white">
                                                        {item.name}
                                                    </h2>
                                                    <p className="mt-1 text-sm text-stone-300">
                                                        Last reset {formatDate(item.last_reset_at)}. Due {formatDate(item.next_depletion_at)}.
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => resetItem(item)}
                                                        className="min-h-10 rounded-md bg-emerald-300 px-3 text-sm font-bold text-stone-950 transition hover:bg-emerald-200"
                                                    >
                                                        Reset
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => archiveItem(item)}
                                                        className="min-h-10 rounded-md border border-white/15 px-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                                                    >
                                                        Archive
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-2">
                                                <div className="h-3 overflow-hidden rounded-full bg-stone-800">
                                                    <div
                                                        className={`h-full ${trackerTone(item.percent_remaining)}`}
                                                        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                                                    />
                                                </div>
                                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-300">
                                                    <span>{formatDays(daysRemaining)}</span>
                                                    <span>{Math.round(percent)}% remaining</span>
                                                    {amountLabel ? <span>{amountLabel}</span> : null}
                                                </div>
                                            </div>

                                            {item.notes ? (
                                                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-stone-300">
                                                    {item.notes}
                                                </p>
                                            ) : null}
                                        </article>
                                    )
                                })}
                            </div>
                        ) : null}
                    </section>
                </section>
            </div>
        </main>
    )
}
