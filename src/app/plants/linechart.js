import * as d3 from "d3";
import {useRef, useEffect, useState} from "react";

export default function LinePlot({
                                     width = 640,
                                     height = 400,
                                     marginTop = 20,
                                     marginRight = 20,
                                     marginBottom = 30,
                                     marginLeft = 40
                                 }) {

    const [weatherData, setWeatherData] = useState([])

    useEffect(() => {
        fetch('https://bengarlock.com/api/v1/garden/weather/')
            .then(res => res.json())
            .then(data => setWeatherData(data))
            .catch(err => console.log(err))
    }, []);

    const weatherCelsius = weatherData.map(record => Number(record.air_temperature))
    const weatherDate = weatherData.map(record => record.created_at)


    const gx = useRef();
    const gy = useRef();

    const x = d3.scaleLinear([0, weatherDate.length - 1], [marginLeft, width - marginRight]);
    const y = d3.scaleLinear(d3.extent(weatherCelsius), [height - marginBottom, marginTop]);

    console.log(y)


    const line = d3.line((d, i) => x(i), y);

    useEffect(() => void d3.select(gx.current).call(d3.axisBottom(x)), [gx, x]);
    useEffect(() => void d3.select(gy.current).call(d3.axisLeft(y)), [gy, y]);

    return (
        <svg width={width} height={height}>
            <g ref={gx} transform={`translate(0,${height - marginBottom})`}/>
            <g ref={gy} transform={`translate(${marginLeft},0)`}/>
            <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                d={line(weatherCelsius)}
            />
            <g fill="white" stroke="currentColor" strokeWidth="1.5">
                {weatherCelsius.map((d, i) => (
                    <circle key={i} cx={x(i)} cy={y(d)} r="2.5"/>
                ))}
            </g>
        </svg>
    );
}