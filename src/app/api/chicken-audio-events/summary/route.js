import { NextResponse } from 'next/server'

const CHICKEN_AUDIO_EVENTS_API_URL =
    process.env.GARDEN_CHICKEN_AUDIO_EVENTS_API_URL ||
    'https://bengarlock.com/api/v1/garden/chicken-audio-events/'
const GARDEN_API_TOKEN = process.env.GARDEN_API_TOKEN || ''

function headers() {
    return {
        Accept: 'application/json',
        ...(GARDEN_API_TOKEN ? { Authorization: `Token ${GARDEN_API_TOKEN}` } : {}),
    }
}

export async function GET() {
    const response = await fetch(`${CHICKEN_AUDIO_EVENTS_API_URL}summary/`, {
        headers: headers(),
        cache: 'no-store',
    })

    const data = await response.json().catch(() => ({
        message: `Chicken audio summary request failed with HTTP ${response.status}.`,
    }))

    return NextResponse.json(data, { status: response.status })
}
