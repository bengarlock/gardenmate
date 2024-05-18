'use client'

import Tile from "@/app/chickens/tile";

const Chickens = () => {

    return (
        <div className="w-full flex flex-col justify-center bg-gray-500 bg-opacity-90">
            <h1>
                Chickens
            </h1>
            <div className="w-full flex flex-row justify-evenly flex-wrap h-screen bg-gray-500 bg-opacity-90">
                <Tile id={1} title="Nutrition" />
                <Tile id={1} title="Nutrition" />
                <Tile id={1} title="Nutrition" />
                <Tile id={1} title="Nutrition" />
            </div>
        </div>
    )
}

export default Chickens