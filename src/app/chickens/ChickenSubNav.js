'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
    { href: '/chickens', label: 'Home' },
    { href: '/chickens/noise', label: 'Noise Management' },
    { href: '/chickens/resources', label: 'Resources' },
]

export default function ChickenSubNav() {
    const pathname = usePathname()

    return (
        <nav className="flex w-full overflow-hidden rounded-lg border border-white/15 bg-stone-950/60 shadow-xl">
            {links.map((link) => {
                const selected = pathname === link.href

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`flex flex-1 items-center justify-center px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-200 ${
                            selected
                                ? 'bg-stone-100 text-stone-950'
                                : 'text-stone-200 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        {link.label}
                    </Link>
                )
            })}
        </nav>
    )
}
