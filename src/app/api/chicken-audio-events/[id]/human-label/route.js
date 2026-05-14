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

export async function PATCH(request, { params }) {
    const { id } = await params
    let payload
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const response = await fetch(`${CHICKEN_AUDIO_EVENTS_API_URL}${id}/human-label/`, {
        method: 'PATCH',
        headers: {
            ...headers(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    const data = await response.json().catch(() => ({
        message: `Chicken audio event label update failed with HTTP ${response.status}.`,
    }))

    return NextResponse.json(data, { status: response.status })
}
