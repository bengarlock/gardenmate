'use client'
import Weather from "@/app/plants/weather/page"
import Countdown from "@/app/plants/countdown/page"

export default function Home() {
    return (
        <main className="min-h-screen w-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="flex flex-wrap justify-center gap-6 max-w-5xl">

                {/* Countdown Card */}
                <div className="group w-80 rounded-2xl bg-blue-900/90 shadow-xl
                        transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className="p-6 flex flex-col h-full">
                        <h1 className="text-lg font-semibold text-blue-100 tracking-wide mb-4">
                            🌱 Countdown Till Planting Day
                        </h1>

                        <div className="flex-grow flex items-center justify-center">
                            <div className="text-2xl font-mono text-white">
                                <Countdown date={new Date('2026-05-02')} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Weather Card */}
                <div className="group w-80 rounded-2xl bg-blue-900/90 shadow-xl
                        transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className="p-6 flex flex-col h-full">
                        <h1 className="text-lg font-semibold text-blue-100 tracking-wide mb-4">
                            ☁️ Weather
                        </h1>

                        <div className="flex-grow flex items-center justify-center text-white">
                            <Weather />
                        </div>
                    </div>
                </div>

            </div>
        </main>
    )
}
