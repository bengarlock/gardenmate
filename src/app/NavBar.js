'use client'
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from "react";


const NavBar = () => {

    const [plantOptions, setPlantOptions] = useState(false)

    const onClickHandler = (e) => {
        if (e.target.id === 'togglePlant') {
            setPlantOptions(!plantOptions)
        }
    }

    const pathname = usePathname()
    return (
        <div className="w-80 flex flex-col justify-start h-screen bg-gray-900 bg-opacity-75">
            <h1 className="w-full flex justify-center p-3 mb-11 text-amber-700">GardenMate</h1>
            <Link href={"/"}>
                <div className={pathname === '/' ? "navbar-icon selected" : "navbar-icon"}>
                    Home
                </div>
            </Link>
            <Link href={"/plants"}>
                <div className={pathname === '/plants' ? "navbar-icon selected" : "navbar-icon"}>
                    Plants
                </div>

                {pathname === '/plants' ?

                    <div className={"text-white"}>
                        <ol>
                            <li className={"navbar-sub-icon"}>Weather</li>
                            <li className={"navbar-sub-icon"}>Pests</li>
                            <li className={"navbar-sub-icon"}>Degree Days</li>
                        </ol>
                    </div>

                    : null}

            </Link>

            <Link href={"/chickens"}>
                <div className={pathname === '/chickens' ? "navbar-icon selected" : "navbar-icon"}>
                    Chickens
                </div>
            </Link>
        </div>
    )
}

export default NavBar