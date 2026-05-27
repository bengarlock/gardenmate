'use client'
import Weather from "@/app/components/Weather"
import Countdown from "@/app/components/Countdown"
import DangerousHeatAdvisory from '@/app/chickens/DangerousHeatAdvisory'
import ChickenResourceWarningTile from '@/app/ChickenResourceWarningTile'

export default function Home() {
    return (
        <main className="min-h-screen w-full bg-stone-950/80 text-stone-50">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-2 border-b border-white/10 pb-5">
                    <p className="text-sm font-semibold uppercase text-emerald-300">
                        Garden dashboard
                    </p>
                    <h1 className="text-3xl font-semibold text-white md:text-5xl">
                        Home
                    </h1>
                </header>

                <DangerousHeatAdvisory />

                <section className="grid gap-3 md:grid-cols-2">
                    <ChickenResourceWarningTile />

                    <div className="group min-h-36 rounded-lg border border-white/10 bg-stone-900/80 p-5 shadow-xl transition hover:border-emerald-300/70 hover:bg-stone-900">
                        <div className="flex items-start justify-between gap-4">
                            <h2 className="text-xl font-semibold text-white">
                                Countdown Till Planting Day
                            </h2>
                            <span className="rounded-full border border-emerald-300/40 px-3 py-1 text-xs font-semibold uppercase text-emerald-200">
                                Track
                            </span>
                        </div>

                        <div className="mt-6 flex min-h-16 items-center">
                            <div className="font-mono text-xl leading-relaxed text-white sm:text-2xl">
                                <Countdown date={new Date('2026-05-02')} />
                            </div>
                        </div>
                    </div>

                    <div className="group min-h-36 rounded-lg border border-white/10 bg-stone-900/80 p-5 shadow-xl transition hover:border-emerald-300/70 hover:bg-stone-900">
                        <div className="flex items-start justify-between gap-4">
                            <h2 className="text-xl font-semibold text-white">
                                Weather
                            </h2>
                            <span className="rounded-full border border-emerald-300/40 px-3 py-1 text-xs font-semibold uppercase text-emerald-200">
                                Live
                            </span>
                        </div>

                        <div className="mt-6 min-h-16 text-2xl text-white">
                            <Weather />
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
