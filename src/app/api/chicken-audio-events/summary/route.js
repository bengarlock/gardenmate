import {authHeaders, jsonResponse, missingTokenResponse, tokenFromRequest} from '@/app/api/_gardenBackend'

const CHICKEN_AUDIO_EVENTS_API_URL =
    process.env.GARDEN_CHICKEN_AUDIO_EVENTS_API_URL ||
    'https://bengarlock.com/api/v1/garden/chicken-audio-events/'

export async function GET(request) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    const response = await fetch(`${CHICKEN_AUDIO_EVENTS_API_URL}summary/`, {
        headers: authHeaders(request),
        cache: 'no-store',
    })

    return jsonResponse(response, `Chicken audio summary request failed with HTTP ${response.status}.`)
}
