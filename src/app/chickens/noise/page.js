'use client'

import Link from 'next/link'
import NoiseLevelChart from '@/app/chickens/NoiseLevelChart'

const ChickenNoisePage = () => {
    return (
        <main className="min-h-screen w-full bg-stone-950/80 text-stone-50">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-3 border-b border-white/10 pb-5">
                    <Link
                        href="/chickens"
                        className="text-sm font-semibold uppercase tracking-wide text-emerald-300 transition hover:text-emerald-100"
                    >
                        Chickens
                    </Link>
                    <h1 className="text-3xl font-semibold text-white md:text-5xl">
                        Noise level chart
                    </h1>
                </header>

                <NoiseLevelChart />
            </div>
        </main>
    )
}

export default ChickenNoisePage
