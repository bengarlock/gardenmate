'use client'
import Link from 'next/link';
import {usePathname} from 'next/navigation';


const NavBar = () => {

    const pathname = usePathname()
    const plantsSelected = pathname === '/plants' || pathname.startsWith('/plants/')
    const chickensSelected = pathname === '/chickens' || pathname.startsWith('/chickens/')

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
        </nav>
    )
}

export default NavBar
