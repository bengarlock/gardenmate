'use client';
import {usePathname} from 'next/navigation';
import Weather from "@/app/plants/weather/page";

export default function Home() {

    return (
        <div className="w-full flex flex-row flex-wrap justify-center h-screen bg-gray-500 bg-opacity-90">
            <div className="group m-2 w-48 h-48 overflow-hidden rounded-xl bg-blue-900 bg-opacity-90 shadow-lg
            transform transition-transform duration-300 hover:scale-105">
                <div className="p-10">
                    <h1>Weather</h1>
                    <Weather />
                </div>
            </div>
        </div>
    );
}
