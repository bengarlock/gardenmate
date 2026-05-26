import { NextResponse } from 'next/server'
import {authHeaders, jsonResponse, missingTokenResponse, tokenFromRequest} from '@/app/api/_gardenBackend'

const WEATHER_API_URL =
    process.env.GARDEN_WEATHER_API_URL || 'https://bengarlock.com/api/v1/garden/weather/'

export async function POST(request) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    const response = await fetch(WEATHER_API_URL, {
        method: 'POST',
        headers: authHeaders(request, {'Content-Type': 'application/json'}),
        body: JSON.stringify({ request: 'get_weather_data' }),
        cache: 'no-store',
    })

    return jsonResponse(response, `Weather request failed with HTTP ${response.status}.`)
}
