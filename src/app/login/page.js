'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'

const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'

export default function LoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    async function onSubmit(event) {
        event.preventDefault()
        setError('')
        setIsSubmitting(true)

        try {
            const response = await fetch(`${APP_BASE_PATH}/api/login`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({username, password}),
            })
            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                setError(data.message || 'Invalid username or password.')
                return
            }

            router.replace('/')
            router.refresh()
        } catch {
            setError('Network or server error.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-stone-950/85 px-4 py-8 text-stone-50">
            <section className="w-full max-w-sm rounded-lg border border-white/10 bg-stone-900/90 p-6 shadow-2xl">
                <div className="mb-6">
                    <p className="text-sm font-semibold uppercase text-emerald-300">GardenMate</p>
                    <h1 className="mt-2 text-3xl font-semibold text-white">Sign in</h1>
                </div>

                <form onSubmit={onSubmit} className="flex flex-col gap-4">
                    <label className="flex flex-col gap-2" htmlFor="username">
                        <span className="text-sm font-medium text-stone-200">Username</span>
                        <input
                            id="username"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            className="h-11 rounded-md border border-white/10 bg-stone-950 px-3 text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
                            type="text"
                            autoComplete="username"
                            required
                        />
                    </label>

                    <label className="flex flex-col gap-2" htmlFor="password">
                        <span className="text-sm font-medium text-stone-200">Password</span>
                        <input
                            id="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="h-11 rounded-md border border-white/10 bg-stone-950 px-3 text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
                            type="password"
                            autoComplete="current-password"
                            required
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="mt-2 h-11 rounded-md bg-emerald-400 px-4 text-sm font-semibold uppercase text-stone-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting ? 'Signing in' : 'Sign in'}
                    </button>
                </form>

                {error ? (
                    <div className="mt-4 rounded-md border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                        {error}
                    </div>
                ) : null}
            </section>
        </main>
    )
}
