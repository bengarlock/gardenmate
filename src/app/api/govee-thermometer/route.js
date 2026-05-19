import { NextResponse } from 'next/server'

const GOVEE_THERMOMETER_API_URL =
    process.env.GARDEN_GOVEE_THERMOMETER_API_URL ||
    'https://bengarlock.com/api/v1/garden/govee/thermometer/'
const GARDEN_API_TOKEN = process.env.GARDEN_API_TOKEN || ''

function headers() {
    return {
        Accept: 'application/json',
        ...(GARDEN_API_TOKEN ? { Authorization: `Token ${GARDEN_API_TOKEN}` } : {}),
    }
}

export async function GET(request) {
    const upstreamUrl = new URL(GOVEE_THERMOMETER_API_URL)
    request.nextUrl.searchParams.forEach((value, key) => {
        upstreamUrl.searchParams.set(key, value)
    })

    const response = await fetch(upstreamUrl, {
        headers: headers(),
        cache: 'no-store',
    })

    const data = await response.json().catch(() => ({
        message: `Govee thermometer request failed with HTTP ${response.status}.`,
    }))

    return NextResponse.json(data, { status: response.status })
}
