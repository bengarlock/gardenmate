'use client'

import ChickenPageHeader from '@/app/chickens/ChickenPageHeader'
import ChickenSubNav from '@/app/chickens/ChickenSubNav'
import NoiseLevelChart from '@/app/chickens/NoiseLevelChart'

const ChickenNoisePage = () => {
    return (
        <main className="min-h-screen w-full bg-stone-950/80 text-stone-50">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <ChickenPageHeader
                    eyebrow="Chickens"
                    eyebrowHref="/chickens"
                    title="Noise level chart"
                />

                <ChickenSubNav />

                <NoiseLevelChart />
            </div>
        </main>
    )
}

export default ChickenNoisePage
