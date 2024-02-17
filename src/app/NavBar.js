'use client'


const NavBar = () => {

    return (
            <div className="w-1/6 flex flex-col items-center justify-center h-screen bg-gray-900 bg-opacity-75">
                <div
                    className={"w-full mb-5 p-3 text-white select-none hover:bg-amber-500 transition-colors duration-300 ease-in-out"}
                >
                    Plants
                </div>
                <div
                    className={"w-full mb-5 p-3 text-white select-none hover:bg-amber-500 transition-colors duration-300 ease-in-out"}
                >
                    Chickens
                </div>
            </div>
    )
}

export default NavBar