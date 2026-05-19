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

const resourceColors = [
    '#d6d3d1',
    '#facc15',
    '#fb923c',
    '#fda4af',
    '#93c5fd',
    '#c4b5fd',
    '#86efac',
]

const initialForm = {
    name: '',
    tracker_type: 'feed',
    depletion_days: '7',
    color: resourceColors[0],
    last_reset_at: '',
    notes: '',
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

function itemColor(item) {
    return /^#[0-9A-Fa-f]{6}$/.test(item?.color || '') ? item.color : resourceColors[0]
}

function colorWithAlpha(color, alpha) {
    const hex = color.replace('#', '')
    const red = parseInt(hex.slice(0, 2), 16)
    const green = parseInt(hex.slice(2, 4), 16)
    const blue = parseInt(hex.slice(4, 6), 16)
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export default function ChickenResourcesPage() {
    const [items, setItems] = useState([])
    const [form, setForm] = useState(initialForm)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [editingItemId, setEditingItemId] = useState(null)
    const [resetCandidate, setResetCandidate] = useState(null)
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

    function toLocalDateTimeInput(value) {
        if (!value) return ''
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return ''
        const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        return offsetDate.toISOString().slice(0, 16)
    }

    function openCreateForm() {
        setError('')
        setEditingItemId(null)
        setForm(initialForm)
        setShowCreateForm(true)
    }

    function closeForm() {
        setForm(initialForm)
        setEditingItemId(null)
        setShowCreateForm(false)
    }

    function editItem(item) {
        setError('')
        setEditingItemId(item.id)
        setForm({
            name: item.name || '',
            tracker_type: item.tracker_type || 'custom',
            depletion_days: item.depletion_days ?? '7',
            color: itemColor(item),
            last_reset_at: toLocalDateTimeInput(item.last_reset_at),
            notes: item.notes || '',
        })
        setShowCreateForm(false)
    }

    async function createItem(event) {
        event.preventDefault()
        setSaving(true)
        setError('')
        const payload = {
            name: form.name.trim(),
            tracker_type: form.tracker_type,
            depletion_days: Number(form.depletion_days),
            color: form.color,
            notes: form.notes.trim(),
        }
        const resetAt = toIsoFromLocalInput(form.last_reset_at)
        if (resetAt) payload.last_reset_at = resetAt

        try {
            const itemUrl = editingItemId ? `${TRACKER_API}/${editingItemId}` : TRACKER_API
            const response = await fetch(itemUrl, {
                method: editingItemId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.message || `Could not ${editingItemId ? 'update' : 'create'} resource.`)
            }
            closeForm()
            if (editingItemId) {
                setItems((current) => current.map((entry) => (entry.id === data.id ? data : entry)))
            } else {
                await loadItems()
            }
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
            body: JSON.stringify({}),
        })
        const data = await response.json()
        if (!response.ok) {
            setError(data.message || 'Could not reset resource.')
            return
        }
        setItems((current) => current.map((entry) => (entry.id === item.id ? data : entry)))
        setResetCandidate(null)
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
                                if (showCreateForm) {
                                    closeForm()
                                } else {
                                    openCreateForm()
                                }
                            }}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/20 bg-stone-100 text-2xl font-semibold leading-none text-stone-950 shadow-lg transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-200"
                        >
                            {showCreateForm ? 'x' : '+'}
                        </button>
                    </div>

                    {showCreateForm ? (
                        <form
                            onSubmit={createItem}
                            className="rounded-lg border border-white/15 bg-stone-950/75 p-4 shadow-xl"
                        >
                            <div className="grid gap-4">
                                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                                    <h3 className="text-lg font-semibold text-white">New Resource</h3>
                                    <button
                                        type="button"
                                        onClick={closeForm}
                                        className="min-h-10 rounded-md border border-white/15 px-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
                                    <label className="grid gap-1 text-sm font-semibold text-stone-200">
                                        Name
                                        <input
                                            required
                                            value={form.name}
                                            onChange={(event) => updateForm('name', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-stone-300"
                                        />
                                    </label>

                                    <label className="grid gap-1 text-sm font-semibold text-stone-200">
                                        Type
                                        <select
                                            value={form.tracker_type}
                                            onChange={(event) => updateForm('tracker_type', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-stone-300"
                                        >
                                            {trackerTypes.map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="grid gap-1 text-sm font-semibold text-stone-200">
                                        Days
                                        <input
                                            required
                                            min="0.25"
                                            step="0.25"
                                            type="number"
                                            value={form.depletion_days}
                                            onChange={(event) => updateForm('depletion_days', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-stone-300"
                                        />
                                    </label>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[18rem_minmax(14rem,18rem)_minmax(16rem,1fr)_auto] xl:items-end">
                                    <label className="grid gap-1 text-sm font-semibold text-stone-200">
                                        Last reset
                                        <input
                                            type="datetime-local"
                                            value={form.last_reset_at}
                                            onChange={(event) => updateForm('last_reset_at', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-stone-300"
                                        />
                                    </label>

                                    <label className="grid min-w-0 gap-1 text-sm font-semibold text-stone-200">
                                        Color
                                        <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-2 rounded-md border border-white/10 bg-stone-900 px-3 py-2">
                                            {resourceColors.map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    aria-label={`Use color ${color}`}
                                                    onClick={() => updateForm('color', color)}
                                                    className={`h-6 w-6 rounded-full border transition ${
                                                        form.color === color ? 'border-white ring-2 ring-white/40' : 'border-white/20'
                                                    }`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                            <input
                                                type="color"
                                                value={form.color}
                                                onChange={(event) => updateForm('color', event.target.value)}
                                                className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
                                            />
                                        </div>
                                    </label>

                                    <label className="grid min-w-0 gap-1 text-sm font-semibold text-stone-200 md:col-span-2 xl:col-span-1">
                                        Notes
                                        <input
                                            value={form.notes}
                                            onChange={(event) => updateForm('notes', event.target.value)}
                                            className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-stone-300"
                                        />
                                    </label>

                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="min-h-11 rounded-md bg-stone-100 px-5 text-base font-bold text-stone-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 md:justify-self-start xl:justify-self-stretch"
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
                            <div className="rounded-lg border border-white/15 bg-stone-950/70 p-6 text-stone-200">
                                Loading resources
                            </div>
                        ) : sortedItems.length === 0 && !error ? (
                            <div className="rounded-lg border border-white/15 bg-stone-950/70 p-6 text-stone-200">
                                No resources are being tracked yet.
                            </div>
                        ) : sortedItems.length > 0 ? (
                            <div className="grid gap-4">
                                {sortedItems.map((item) => {
                                    const percent = item.percent_remaining ?? 0
                                    const accentColor = itemColor(item)
                                    const daysRemaining = item.days_remaining === null || item.days_remaining === undefined
                                        ? null
                                        : Number(item.days_remaining)

                                    return (
                                        <article
                                            key={item.id}
                                            className="rounded-lg border border-white/15 bg-stone-950/70 p-4 shadow-xl"
                                            style={{
                                                background: `linear-gradient(135deg, ${colorWithAlpha(accentColor, 0.18)}, rgba(12, 10, 9, 0.78) 34%, rgba(12, 10, 9, 0.72))`,
                                                borderColor: colorWithAlpha(accentColor, 0.42),
                                                borderLeftColor: accentColor,
                                                borderLeftWidth: '4px',
                                                boxShadow: `0 18px 40px ${colorWithAlpha(accentColor, 0.08)}`,
                                            }}
                                        >
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <p
                                                        className="text-xs font-semibold uppercase"
                                                        style={{ color: accentColor }}
                                                    >
                                                        {trackerTypes.find(([value]) => value === item.tracker_type)?.[1] || 'Custom'}
                                                    </p>
                                                    <h2 className="mt-1 break-words text-xl font-semibold text-white">
                                                        <span className="inline-flex items-center gap-2">
                                                            <span
                                                                className="h-3 w-3 rounded-full border border-white/40"
                                                                style={{ backgroundColor: accentColor }}
                                                            />
                                                            {item.name}
                                                        </span>
                                                    </h2>
                                                    <p className="mt-1 text-sm text-stone-300">
                                                        Last reset {formatDate(item.last_reset_at)}. Due {formatDate(item.next_depletion_at)}.
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setResetCandidate(item)}
                                                        className="min-h-10 rounded-md px-3 text-sm font-bold text-stone-950 transition"
                                                        style={{
                                                            backgroundColor: accentColor,
                                                            boxShadow: `0 0 0 1px ${colorWithAlpha(accentColor, 0.35)}`,
                                                        }}
                                                    >
                                                        Reset
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => editItem(item)}
                                                        className="min-h-10 rounded-md border border-white/15 px-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                                                    >
                                                        Edit
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

                                            {editingItemId === item.id ? (
                                                <form
                                                    onSubmit={createItem}
                                                    className="mt-4 rounded-md border border-white/10 bg-stone-950/65 p-4"
                                                >
                                                    <div className="grid gap-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <h3 className="text-base font-semibold text-white">Edit Resource</h3>
                                                            <button
                                                                type="button"
                                                                onClick={closeForm}
                                                                className="min-h-10 rounded-md border border-white/15 px-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>

                                                        <div className="grid gap-4 md:grid-cols-3">
                                                            <label className="grid gap-1 text-sm font-semibold text-stone-200">
                                                                Name
                                                                <input
                                                                    required
                                                                    value={form.name}
                                                                    onChange={(event) => updateForm('name', event.target.value)}
                                                                    className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-stone-300"
                                                                />
                                                            </label>

                                                            <label className="grid gap-1 text-sm font-semibold text-stone-200">
                                                                Type
                                                                <select
                                                                    value={form.tracker_type}
                                                                    onChange={(event) => updateForm('tracker_type', event.target.value)}
                                                                    className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-stone-300"
                                                                >
                                                                    {trackerTypes.map(([value, label]) => (
                                                                        <option key={value} value={value}>{label}</option>
                                                                    ))}
                                                                </select>
                                                            </label>

                                                            <label className="grid gap-1 text-sm font-semibold text-stone-200">
                                                                Days
                                                                <input
                                                                    required
                                                                    min="0.25"
                                                                    step="0.25"
                                                                    type="number"
                                                                    value={form.depletion_days}
                                                                    onChange={(event) => updateForm('depletion_days', event.target.value)}
                                                                    className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-stone-300"
                                                                />
                                                            </label>
                                                        </div>

                                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[18rem_minmax(14rem,18rem)_minmax(16rem,1fr)_auto] xl:items-end">
                                                            <label className="grid gap-1 text-sm font-semibold text-stone-200">
                                                                Last reset
                                                                <input
                                                                    type="datetime-local"
                                                                    value={form.last_reset_at}
                                                                    onChange={(event) => updateForm('last_reset_at', event.target.value)}
                                                                    className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-stone-300"
                                                                />
                                                            </label>

                                                            <label className="grid min-w-0 gap-1 text-sm font-semibold text-stone-200">
                                                                Color
                                                                <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-2 rounded-md border border-white/10 bg-stone-900 px-3 py-2">
                                                                    {resourceColors.map((color) => (
                                                                        <button
                                                                            key={color}
                                                                            type="button"
                                                                            aria-label={`Use color ${color}`}
                                                                            onClick={() => updateForm('color', color)}
                                                                            className={`h-6 w-6 rounded-full border transition ${
                                                                                form.color === color ? 'border-white ring-2 ring-white/40' : 'border-white/20'
                                                                            }`}
                                                                            style={{ backgroundColor: color }}
                                                                        />
                                                                    ))}
                                                                    <input
                                                                        type="color"
                                                                        value={form.color}
                                                                        onChange={(event) => updateForm('color', event.target.value)}
                                                                        className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
                                                                    />
                                                                </div>
                                                            </label>

                                                            <label className="grid min-w-0 gap-1 text-sm font-semibold text-stone-200 md:col-span-2 xl:col-span-1">
                                                                Notes
                                                                <input
                                                                    value={form.notes}
                                                                    onChange={(event) => updateForm('notes', event.target.value)}
                                                                    className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-3 text-base text-white outline-none focus:border-stone-300"
                                                                />
                                                            </label>

                                                            <button
                                                                type="submit"
                                                                disabled={saving}
                                                                className="min-h-11 rounded-md bg-stone-100 px-5 text-base font-bold text-stone-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 md:justify-self-start xl:justify-self-stretch"
                                                            >
                                                                {saving ? 'Saving' : 'Save Changes'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </form>
                                            ) : null}

                                            <div className="mt-4 grid gap-2">
                                                <div className="h-3 overflow-hidden rounded-full bg-stone-800">
                                                    <div
                                                        className="h-full"
                                                        style={{
                                                            width: `${Math.max(0, Math.min(100, percent))}%`,
                                                            backgroundColor: accentColor,
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-300">
                                                    <span>{formatDays(daysRemaining)}</span>
                                                    <span>{Math.round(percent)}% remaining</span>
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

            {resetCandidate ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/75 px-4">
                    <section className="w-full max-w-md rounded-lg border border-white/15 bg-stone-950 p-5 shadow-2xl">
                        <h2 className="text-xl font-semibold text-white">Reset Resource</h2>
                        <p className="mt-3 text-sm leading-6 text-stone-200">
                            Are you sure you want to reset {resetCandidate.name}? This will restart its depletion timer from now.
                        </p>
                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setResetCandidate(null)}
                                className="min-h-10 rounded-md border border-white/15 px-4 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => resetItem(resetCandidate)}
                                className="min-h-10 rounded-md bg-stone-100 px-4 text-sm font-bold text-stone-950 transition hover:bg-white"
                            >
                                Reset
                            </button>
                        </div>
                    </section>
                </div>
            ) : null}
        </main>
    )
}
