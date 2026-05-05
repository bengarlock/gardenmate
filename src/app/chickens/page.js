'use client'

import NoiseLevelChart from "@/app/chickens/NoiseLevelChart";

const Chickens = () => {

    return (
        <div className="flex min-h-screen w-full flex-col bg-gradient-to-b from-slate-700/95 to-slate-800 pb-12">
            <header className="mx-auto w-full max-w-4xl px-4 pt-10 pb-8 text-center">
                <h1 className="text-4xl font-bold tracking-tight text-slate-50 drop-shadow-sm md:text-5xl">
                    Chickens
                </h1>
                <div
                    className="mx-auto mt-5 h-1 w-16 rounded-full bg-gradient-to-r from-amber-300/80 to-amber-500/60"
                    aria-hidden
                />
            </header>
            <div className="flex w-full justify-center px-4">
                <NoiseLevelChart />
            </div>
        </div>
    )
}

export default Chickens