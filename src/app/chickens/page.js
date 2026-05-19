import ChickenPageHeader from '@/app/chickens/ChickenPageHeader'
import ChickenSubNav from '@/app/chickens/ChickenSubNav'
import DangerousHeatAdvisory from '@/app/chickens/DangerousHeatAdvisory'
import NoiseLevelChart from '@/app/chickens/NoiseLevelChart'

const Chickens = () => {

    return (
        <main className="min-h-screen w-full bg-stone-950/80 text-stone-50">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <ChickenPageHeader title="Chickens" />

                <ChickenSubNav />

                <DangerousHeatAdvisory />

                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <NoiseLevelChart variant="tile" />
                </section>
            </div>
        </main>
    )
}

export default Chickens
