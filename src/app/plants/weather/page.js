'use client'


import {useEffect, useState} from "react";

const Weather = () => {

    const [currentWeather, setCurrentWeather] = useState(null)

    useEffect(() => {
        fetchWeather()
    }, []);


    const fetchWeather = () => {
        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            "request": "get_weather_data"
        });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            redirect: "follow"
        };

        fetch("https://bengarlock.com/api/v1/garden/weather/", requestOptions)
            .then((response) => response.json())
            .then((result) => setCurrentWeather(result))
            .catch((error) => console.error(error));
    }

    const renderWeather = () => {
        if (currentWeather) {
            const temp_f = (currentWeather.obs[0].air_temperature * 9/5) + 32
            return Math.ceil(temp_f) + "\u00B0"
        }
    }

    return (
        <div>{renderWeather()} F</div>
    )
}

export default Weather