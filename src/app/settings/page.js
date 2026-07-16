'use client'

import {useEffect, useState} from 'react'

const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'
const SETTINGS_API = `${APP_BASE_PATH}/api/garden/user-settings`

const DEFAULT_SETTINGS = {
    notification_email: '',
    resource_depletion_email_enabled: false,
}

function fieldErrorText(error) {
    if (!error) return ''
    if (Array.isArray(error)) return error.join(' ')
    return String(error)
}

export default function SettingsPage() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [fieldErrors, setFieldErrors] = useState({})
    const [statusMessage, setStatusMessage] = useState('')

    useEffect(() => {
        let isMounted = true

        async function loadSettings() {
            setLoading(true)
            setError('')
            try {
                const response = await fetch(SETTINGS_API, {cache: 'no-store'})
                const data = await response.json().catch(() => ({}))
                if (!response.ok) {
                    throw new Error(data.message || data.detail || 'Unable to load settings.')
                }
                if (isMounted) {
                    setSettings({
                        notification_email: data.notification_email || '',
                        resource_depletion_email_enabled: Boolean(data.resource_depletion_email_enabled),
                    })
                }
            } catch (loadError) {
                if (isMounted) {
                    setError(loadError.message || 'Unable to load settings.')
                }
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        loadSettings()
        return () => {
            isMounted = false
        }
    }, [])

    async function onSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setError('')
        setFieldErrors({})
        setStatusMessage('')

        try {
            const response = await fetch(SETTINGS_API, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    notification_email: settings.notification_email.trim(),
                    resource_depletion_email_enabled: settings.resource_depletion_email_enabled,
                }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                if (response.status === 400) {
                    setFieldErrors(data)
                    throw new Error('Check the highlighted settings.')
                }
                throw new Error(data.message || data.detail || 'Unable to save settings.')
            }
            setSettings({
                notification_email: data.notification_email || '',
                resource_depletion_email_enabled: Boolean(data.resource_depletion_email_enabled),
            })
            setStatusMessage('Settings saved.')
        } catch (saveError) {
            setError(saveError.message || 'Unable to save settings.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <main className="min-h-screen w-full bg-stone-950/80 text-stone-50">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-2 border-b border-white/10 pb-5">
                    <p className="text-sm font-semibold uppercase text-emerald-300">
                        GardenMate
                    </p>
                    <h1 className="text-3xl font-semibold text-white md:text-5xl">
                        Settings
                    </h1>
                </header>

                <section className="rounded-lg border border-white/10 bg-stone-900/85 p-5 shadow-xl">
                    <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                        <h2 className="text-xl font-semibold text-white">
                            Resource Notifications
                        </h2>
                        <p className="text-sm text-stone-300">
                            Send an email when a tracked resource reaches its warning threshold.
                        </p>
                    </div>

                    {loading ? (
                        <div className="py-10 text-sm text-stone-300">
                            Loading settings...
                        </div>
                    ) : (
                        <form className="mt-5 flex flex-col gap-5" onSubmit={onSubmit}>
                            {error ? (
                                <div className="rounded-md border border-rose-400/30 bg-rose-950/50 px-4 py-3 text-sm text-rose-100">
                                    {error}
                                </div>
                            ) : null}
                            {statusMessage ? (
                                <div className="rounded-md border border-emerald-300/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
                                    {statusMessage}
                                </div>
                            ) : null}

                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-medium text-stone-200">
                                    Notification email
                                </span>
                                <input
                                    className="min-h-11 rounded-md border border-white/10 bg-stone-950 px-3 py-2 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
                                    inputMode="email"
                                    type="email"
                                    value={settings.notification_email}
                                    onChange={event => {
                                        setSettings(current => ({
                                            ...current,
                                            notification_email: event.target.value,
                                        }))
                                        setFieldErrors(current => ({...current, notification_email: undefined}))
                                    }}
                                />
                                {fieldErrors.notification_email ? (
                                    <span className="text-sm text-rose-200">
                                        {fieldErrorText(fieldErrors.notification_email)}
                                    </span>
                                ) : null}
                            </label>

                            <label className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-stone-950/70 px-4 py-3">
                                <span className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-white">
                                        Email me when a resource is depleted
                                    </span>
                                    <span className="text-sm text-stone-400">
                                        Applies to chicken resources and plant pest resources.
                                    </span>
                                </span>
                                <input
                                    checked={settings.resource_depletion_email_enabled}
                                    className="h-5 w-5 accent-amber-500"
                                    type="checkbox"
                                    onChange={event => {
                                        setSettings(current => ({
                                            ...current,
                                            resource_depletion_email_enabled: event.target.checked,
                                        }))
                                        setFieldErrors({})
                                    }}
                                />
                            </label>

                            <div className="flex justify-end">
                                <button
                                    className="min-h-11 rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-gray-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
                                    disabled={saving}
                                    type="submit"
                                >
                                    {saving ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
                    )}
                </section>
            </div>
        </main>
    )
}
