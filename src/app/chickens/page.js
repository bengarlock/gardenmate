'use client'

import Link from 'next/link'
import ChickenPageHeader from '@/app/chickens/ChickenPageHeader'
import ChickenSubNav from '@/app/chickens/ChickenSubNav'

const Chickens = () => {

    return (
        <main className="min-h-screen w-full bg-stone-950/80 text-stone-50">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <ChickenPageHeader title="Chickens" />

                <ChickenSubNav />

                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Link
                        href="/chickens/noise"
                        className="group rounded-lg border border-emerald-200/15 bg-gradient-to-br from-stone-900/85 via-slate-950/85 to-emerald-950/55 p-5 shadow-xl transition hover:border-emerald-200/40 hover:bg-emerald-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                    >
                        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300/80">
                            Noise Review
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                            Noise level chart
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-stone-300">
                            Review chicken noise events, classify clips, and inspect daily noise scores.
                        </p>
                        <span className="mt-5 inline-flex text-sm font-semibold text-emerald-200 transition group-hover:text-emerald-100">
                            Open chart
                        </span>
                    </Link>
                </section>
            </div>
        </main>
    )
}

export default Chickens
