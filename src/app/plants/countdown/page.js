'use client'
import { useEffect, useState } from 'react'


export default function Countdown(props) {

    const targetDate = typeof props.date === 'string' ? new Date(props.date) : props.date

    const [timeLeft, setTimeLeft] = useState(() => getTimeRemaining(targetDate))

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(getTimeRemaining(targetDate))
        }, 1000)

        return () => clearInterval(interval)
    }, [targetDate])


    return (
        <div>
            {timeLeft.days} Days {timeLeft.hours} Hours {timeLeft.minutes} Minutes {timeLeft.seconds} Seconds
        </div>
    )
}

function getTimeRemaining(targetDate) {
    const totalMs = targetDate.getTime() - Date.now()

    if (totalMs <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    }

    const totalSeconds = Math.floor(totalMs / 1000)

    const days = Math.floor(totalSeconds / (60 * 60 * 24))
    const hours = Math.floor((totalSeconds / (60 * 60)) % 24)
    const minutes = Math.floor((totalSeconds / 60) % 60)
    const seconds = totalSeconds % 60

    return { days, hours, minutes, seconds }
}