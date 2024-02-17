'use client'

import LinePlot from "@/app/plants/linechart";

const Plants = () => {

    return(
        <div className="w-full flex flex-row justify-center h-screen bg-gray-500 bg-opacity-90">
            Plants
            <LinePlot />
        </div>
    )
}

export default Plants