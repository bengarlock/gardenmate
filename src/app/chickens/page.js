'use client'

import NoiseLevelChart from "@/app/chickens/NoiseLevelChart";

const Chickens = () => {

    return (
        <div className="flex min-h-screen w-full flex-col bg-gradient-to-b from-slate-700/95 to-slate-800 pb-8 md:pb-12">
            <header className="mx-auto w-full max-w-4xl px-4 pb-6 pt-8 text-center md:pb-8 md:pt-10">
                <h1 className="text-3xl font-bold tracking-tight text-slate-50 drop-shadow-sm md:text-5xl">
                    Chickens
                </h1>
                <div
                    className="mx-auto mt-5 h-1 w-16 rounded-full bg-gradient-to-r from-amber-300/80 to-amber-500/60"
                    aria-hidden
                />
            </header>
            <div className="flex w-full justify-center px-3 sm:px-4">
                <NoiseLevelChart />
            </div>
        </div>
    )
}

export default Chickens
