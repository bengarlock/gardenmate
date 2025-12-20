'use client'


import {useEffect, useState} from "react";

const Weather = () => {

    const [currentWeather, setCurrentWeather] = useState(null)

    useEffect(() => {
        fetchWeather()
    }, []);

    const fetchWeather = () => {
        const myHeaders = new Headers();
        const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
        if (csrfToken) {
            myHeaders.append("X-CSRFToken", csrfToken.split('=')[1]);
        }
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
        const temp_f = (currentWeather.obs[0].air_temperature * 9/5) + 32
        return Math.ceil(temp_f) + "\u00B0" + " F"
    }

    return (
        <div>{currentWeather ? renderWeather() : "Loading..."}</div>
    )
}

export default Weather