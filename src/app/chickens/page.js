'use client'

import NoiseLevelChart from "@/app/chickens/NoiseLevelChart";

const Chickens = () => {

    return (
        <main className="min-h-screen w-full bg-stone-950/80 text-stone-50">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-2 border-b border-white/10 pb-5">
                    <p className="text-sm font-semibold uppercase text-emerald-300">
                        Garden dashboard
                    </p>
                    <h1 className="text-3xl font-semibold text-white md:text-5xl">
                        Chickens
                    </h1>
                </header>

                <NoiseLevelChart />
            </div>
        </main>
    )
}

export default Chickens
