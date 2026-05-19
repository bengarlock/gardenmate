'use client'

import Link from 'next/link'

const eyebrowClass = 'text-sm font-semibold uppercase tracking-wide text-amber-200 transition hover:text-stone-100'

export default function ChickenPageHeader({ title, eyebrow = 'Garden dashboard', eyebrowHref }) {
    return (
        <header className="flex min-h-[7.75rem] flex-col justify-end gap-2 border-b border-white/10 pb-5">
            {eyebrowHref ? (
                <Link href={eyebrowHref} className={eyebrowClass}>
                    {eyebrow}
                </Link>
            ) : (
                <p className={eyebrowClass}>
                    {eyebrow}
                </p>
            )}
            <h1 className="text-3xl font-semibold text-white md:text-5xl">
                {title}
            </h1>
        </header>
    )
}
