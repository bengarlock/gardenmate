'use client'


import {useEffect, useState} from "react";

const APP_BASE_PATH = process.env.NEXT_PUBLIC_GARDENMATE_BASE_PATH || '/gardenmate'
const WEATHER_PROXY_API = `${APP_BASE_PATH}/api/weather`

const Weather = () => {

    const [currentWeather, setCurrentWeather] = useState(null)

    useEffect(() => {
        fetchWeather()
    }, []);

    const fetchWeather = () => {
        const requestOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            redirect: "follow"
        };

        fetch(WEATHER_PROXY_API, requestOptions)
            .then((response) => response.json())
            .then((result) => setCurrentWeather(result))
            .catch((error) => console.error(error));
    }

    const renderWeather = () => {
        const temp_f = (currentWeather.obs[0].air_temperature * 9/5) + 32
        return Math.ceil(temp_f) + "\u00B0" + " F"
    }

    return (
        <div>{currentWeather ? renderWeather() : "Loading..."}</div>
    )
}

export default Weather
