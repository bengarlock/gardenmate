'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
    { href: '/chickens', label: 'Home' },
    { href: '/chickens/noise', label: 'Noise Management' },
]

export default function ChickenSubNav() {
    const pathname = usePathname()

    return (
        <nav className="flex w-full overflow-hidden rounded-lg border border-emerald-200/15 bg-stone-950/60 shadow-xl">
            {links.map((link) => {
                const selected = pathname === link.href

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`flex flex-1 items-center justify-center px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                            selected
                                ? 'bg-emerald-400 text-stone-950'
                                : 'text-emerald-100 hover:bg-emerald-900/50 hover:text-white'
                        }`}
                    >
                        {link.label}
                    </Link>
                )
            })}
        </nav>
    )
}
