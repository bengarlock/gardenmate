import { NextResponse } from 'next/server'
import {authHeaders, jsonResponse, missingTokenResponse, tokenFromRequest} from '@/app/api/_gardenBackend'

const CHICKEN_AUDIO_EVENTS_API_URL =
    process.env.GARDEN_CHICKEN_AUDIO_EVENTS_API_URL ||
    'https://bengarlock.com/api/v1/garden/chicken-audio-events/'

export async function PATCH(request, { params }) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    const { id } = await params
    let payload
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const response = await fetch(`${CHICKEN_AUDIO_EVENTS_API_URL}${id}/human-label/`, {
        method: 'PATCH',
        headers: authHeaders(request, {'Content-Type': 'application/json'}),
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    return jsonResponse(response, `Chicken audio event label update failed with HTTP ${response.status}.`)
}
