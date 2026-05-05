'use client'
import Weather from "@/app/components/Weather"
import Countdown from "@/app/components/Countdown"

export default function Home() {
    return (
        <main className="flex min-h-[calc(100vh-116px)] w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-8 md:min-h-screen">
            <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">

                {/* Countdown Card */}
                <div className="group w-full rounded-xl bg-blue-900/90 shadow-xl
                        transition-all duration-300 hover:shadow-2xl md:hover:scale-105">
                    <div className="flex h-full min-h-40 flex-col p-5 sm:p-6">
                        <h1 className="text-lg font-semibold text-blue-100 tracking-wide mb-4">
                            🌱 Countdown Till Planting Day
                        </h1>

                        <div className="flex-grow flex items-center justify-center">
                            <div className="text-center font-mono text-xl leading-relaxed text-white sm:text-2xl">
                                <Countdown date={new Date('2026-05-02')} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Weather Card */}
                <div className="group w-full rounded-xl bg-blue-900/90 shadow-xl
                        transition-all duration-300 hover:shadow-2xl md:hover:scale-105">
                    <div className="flex h-full min-h-40 flex-col p-5 sm:p-6">
                        <h1 className="text-lg font-semibold text-blue-100 tracking-wide mb-4">
                            ☁️ Weather
                        </h1>

                        <div className="flex-grow flex items-center justify-center text-2xl text-white">
                            <Weather />
                        </div>
                    </div>
                </div>

            </div>
        </main>
    )
}
