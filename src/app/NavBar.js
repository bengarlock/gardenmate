'use client'
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';


const NavBar = () => {

    const pathname = usePathname()
    const router = useRouter();


    return (
        <div className="w-1/6 min-w-44 flex flex-col justify-start h-screen bg-gray-900 bg-opacity-75">

            <h1 className="w-full flex justify-center p-3 mb-11 text-amber-700">GardenMate</h1>

            <Link href={"/"}>
                <div className={"w-full mb-5 p-3 text-white select-none hover:bg-amber-500 transition-colors " +
                    "duration-300 ease-in-out"}>
                    Home
                </div>
            </Link>

            <Link href={"/plants"}>
                <div className={"w-full mb-5 p-3 text-white select-none hover:bg-amber-500 transition-colors " +
                    "duration-300 ease-in-out"}>
                    Plants
                </div>
            </Link>
            <Link href={"/chickens"}>
                <div className={"w-full mb-5 p-3 text-white select-none hover:bg-amber-500 transition-colors " +
                    "duration-300 ease-in-out"}>
                    Chickens
                </div>
            </Link>
        </div>
    )
}

export default NavBar