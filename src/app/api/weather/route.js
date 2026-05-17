import { NextResponse } from 'next/server'

const WEATHER_API_URL =
    process.env.GARDEN_WEATHER_API_URL || 'https://bengarlock.com/api/v1/garden/weather/'
const GARDEN_API_TOKEN = process.env.GARDEN_API_TOKEN || ''

export async function POST() {
    const response = await fetch(WEATHER_API_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            ...(GARDEN_API_TOKEN ? { Authorization: `Token ${GARDEN_API_TOKEN}` } : {}),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request: 'get_weather_data' }),
        cache: 'no-store',
    })

    const data = await response.json().catch(() => ({
        message: `Weather request failed with HTTP ${response.status}.`,
    }))

    return NextResponse.json(data, { status: response.status })
}
