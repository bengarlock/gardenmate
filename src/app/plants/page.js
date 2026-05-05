'use client'

import LinePlot from "@/app/plants/linechart";

const Plants = () => {

    return(
        <div className="flex min-h-screen w-full flex-col items-center bg-gray-500/90 px-4 py-8 text-white">
            <h1 className="mb-6 text-3xl font-bold tracking-tight md:text-5xl">Plants</h1>
            <div className="w-full max-w-4xl overflow-x-auto rounded-xl bg-slate-900/70 p-4 shadow-xl">
                <LinePlot />
            </div>
        </div>
    )
}

export default Plants
