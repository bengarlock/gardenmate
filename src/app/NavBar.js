'use client'
import Link from 'next/link';
import {usePathname} from 'next/navigation';


const NavBar = () => {

    const pathname = usePathname()
    return (
        <nav className="w-full bg-gray-900/85 text-white md:min-h-screen md:w-64 md:shrink-0 lg:w-80">
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
                <div className={pathname === '/plants' ? "navbar-icon selected" : "navbar-icon"}>
                    Plants
                </div>
            </Link>

                {pathname.includes('/plants') ?

                    <div className={"w-full text-white md:w-auto"}>
                        <ol className="flex flex-wrap justify-center gap-2 px-1 md:block md:px-0">
                            <Link href={"/plants/weather"}>
                                <li className={"navbar-sub-icon"}>Weather</li>
                            </Link>
                            <Link href={"/plants/pests"}>
                                <li className={"navbar-sub-icon"}>Pests</li>
                            </Link>
                            <Link href={"/plants/degreedays"}>
                                <li className={"navbar-sub-icon"}>Degree Days</li>
                            </Link>
                        </ol>
                    </div>

                    : null}

            <Link href={"/chickens"}>
                <div className={pathname === '/chickens' ? "navbar-icon selected" : "navbar-icon"}>
                    Chickens
                </div>
            </Link>
            </div>
        </nav>
    )
}

export default NavBar
