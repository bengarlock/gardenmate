import * as d3 from "d3";
import {useRef, useEffect, useState} from "react";

export default function LinePlot() {

    const [weatherData, setWeatherData] = useState([])

    useEffect(() => {
        fetch('https://bengarlock.com/api/v1/garden/weather/')
            .then(res => res.json())
            .then(data => setWeatherData(data))
            .catch(err => console.log(err))
    }, []);

    const temps = weatherData.map(record => Number(record.air_temperature) * 9/5 + 32)
    let dates = weatherData.map(record => Date(record.created_at))

    const xScale = d3.scaleBand()
        .domain(dates.map((d, dNdx) => dNdx))
        .range([0, dates.length])
    const yScale = d3.scaleBand()
        .domain([0, 1])
        .range([0, temps.length])

    return (

        <svg overflow='visable'>
            {
                temps.map((t, tNdx) => <rect height="50px" width="50px" x={tNdx} y={dates}></rect>)
            }


        </svg>

    );
}