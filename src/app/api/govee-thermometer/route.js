import { NextResponse } from 'next/server'
import {authHeaders, jsonResponse, missingTokenResponse, tokenFromRequest} from '@/app/api/_gardenBackend'

const GOVEE_THERMOMETER_API_URL =
    process.env.GARDEN_GOVEE_THERMOMETER_API_URL ||
    'https://bengarlock.com/api/v1/garden/govee/thermometer/'

export async function GET(request) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    const upstreamUrl = new URL(GOVEE_THERMOMETER_API_URL)
    request.nextUrl.searchParams.forEach((value, key) => {
        upstreamUrl.searchParams.set(key, value)
    })

    const response = await fetch(upstreamUrl, {
        headers: authHeaders(request),
        cache: 'no-store',
    })

    return jsonResponse(response, `Govee thermometer request failed with HTTP ${response.status}.`)
}
