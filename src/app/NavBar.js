'use client'
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useRouter} from 'next/navigation';

const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'

const NavBar = () => {

    const pathname = usePathname()
    const router = useRouter()
    const plantsSelected = pathname === '/plants' || pathname.startsWith('/plants/')
    const chickensSelected = pathname === '/chickens' || pathname.startsWith('/chickens/')
    const settingsSelected = pathname === '/settings'

    const onLogout = async () => {
        await fetch(`${APP_BASE_PATH}/api/logout`, {method: 'POST'})
        router.replace('/login')
        router.refresh()
    }

    return (
        <nav className="fixed left-0 top-0 z-50 w-full bg-gray-900/85 text-white md:h-screen md:w-64 lg:w-80">
            <h1 className="flex w-full justify-center p-3 text-xl font-semibold text-amber-600 md:mb-8">
                GardenMate
            </h1>
            <div className="flex flex-wrap justify-center gap-2 px-2 pb-3 md:block md:px-0 md:pb-0">
            <Link href={"/"}>
                <div className={pathname === '/' ? "navbar-icon selected" : "navbar-icon"}>
                    Home
                </div>
            </Link>
            <Link href={"/plants"}>
                <div className={plantsSelected ? "navbar-icon selected" : "navbar-icon"}>
                    Plants
                </div>
            </Link>

            <Link href={"/weather"}>
                <div className={pathname === '/weather' ? "navbar-icon selected" : "navbar-icon"}>
                    Weather
                </div>
            </Link>

            <Link href={"/chickens"}>
                <div className={chickensSelected ? "navbar-icon selected" : "navbar-icon"}>
                    Chickens
                </div>
            </Link>
            </div>
            <div className="fixed bottom-4 left-4 flex flex-col gap-3 md:absolute">
                <Link
                    aria-label="Settings"
                    className={`flex h-11 w-11 items-center justify-center rounded-md border shadow-lg transition focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                        settingsSelected
                            ? 'border-amber-300 bg-amber-500 text-gray-950'
                            : 'border-white/10 bg-gray-950/85 text-stone-200 hover:border-amber-400/60 hover:bg-amber-500 hover:text-gray-950'
                    }`}
                    href="/settings"
                    title="Settings"
                >
                    <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                    >
                        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
                        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2.1 2.1 0 0 1-2.97 2.97l-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66v.17a2.1 2.1 0 0 1-4.2 0v-.09a1.8 1.8 0 0 0-1.18-1.74 1.8 1.8 0 0 0-1.98.36l-.06.06a2.1 2.1 0 1 1-2.97-2.97l.06-.06A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.66-1.1h-.17a2.1 2.1 0 0 1 0-4.2h.09A1.8 1.8 0 0 0 4.6 8.52a1.8 1.8 0 0 0-.36-1.98l-.06-.06A2.1 2.1 0 1 1 7.15 3.5l.06.06a1.8 1.8 0 0 0 1.98.36h.08A1.8 1.8 0 0 0 10.3 2.26v-.17a2.1 2.1 0 0 1 4.2 0v.09a1.8 1.8 0 0 0 1.1 1.66 1.8 1.8 0 0 0 1.98-.36l.06-.06a2.1 2.1 0 1 1 2.97 2.97l-.06.06a1.8 1.8 0 0 0-.36 1.98v.08a1.8 1.8 0 0 0 1.66 1.1h.17a2.1 2.1 0 0 1 0 4.2h-.09A1.8 1.8 0 0 0 19.4 15Z" />
                    </svg>
                </Link>
                <button
                    aria-label="Sign out"
                    className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-gray-950/85 text-stone-200 shadow-lg transition hover:border-amber-400/60 hover:bg-amber-500 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-amber-300"
                    title="Sign out"
                    type="button"
                    onClick={onLogout}
                >
                <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                </svg>
                </button>
            </div>
        </nav>
    )
}

export default NavBar
