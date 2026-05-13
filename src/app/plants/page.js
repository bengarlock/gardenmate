'use client'

import Link from 'next/link';
import WaterUsageChart from "@/app/plants/WaterUsageChart";

const Plants = () => {
    const sections = [
        {
            title: 'Weather',
            href: '/plants',
            metric: 'Live',
            description: 'Temperature, humidity, and rainfall',
        },
        {
            title: 'Pests',
            href: '/plants/pests',
            metric: 'Scout',
            description: 'Pest pressure and watch items',
        },
        {
            title: 'Degree Days',
            href: '/plants/degreedays',
            metric: 'Track',
            description: 'Plant and insect timing',
        },
    ];

    return(
        <main className="min-h-screen w-full bg-stone-950/80 text-stone-50">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-2 border-b border-white/10 pb-5">
                    <p className="text-sm font-semibold uppercase text-emerald-300">
                        Garden dashboard
                    </p>
                    <h1 className="text-3xl font-semibold text-white md:text-5xl">
                        Plants
                    </h1>
                </header>

                <section className="grid gap-3 md:grid-cols-3">
                    {sections.map((section) => (
                        <Link
                            className="group min-h-36 rounded-lg border border-white/10 bg-stone-900/80 p-5 shadow-xl transition hover:border-emerald-300/70 hover:bg-stone-900"
                            href={section.href}
                            key={section.title}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                                <span className="rounded-full border border-emerald-300/40 px-3 py-1 text-xs font-semibold uppercase text-emerald-200">
                                    {section.metric}
                                </span>
                            </div>
                            <p className="mt-4 max-w-sm text-sm leading-6 text-stone-300">
                                {section.description}
                            </p>
                        </Link>
                    ))}
                </section>

                <WaterUsageChart />
            </div>
        </main>
    )
}

export default Plants
