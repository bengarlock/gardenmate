import { NextResponse } from 'next/server'
import {authHeaders, jsonResponse, missingTokenResponse, tokenFromRequest} from '@/app/api/_gardenBackend'

const CHICKEN_TRACKER_ITEMS_API_URL =
    process.env.GARDEN_CHICKEN_TRACKER_ITEMS_API_URL ||
    'https://bengarlock.com/api/v1/garden/chicken-tracker-items/'

async function readJson(request) {
    try {
        return await request.json()
    } catch {
        return {}
    }
}

export async function PATCH(request, { params }) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    const { id } = await params
    const payload = await readJson(request)

    const response = await fetch(`${CHICKEN_TRACKER_ITEMS_API_URL}${id}/reset/`, {
        method: 'PATCH',
        headers: authHeaders(request, {'Content-Type': 'application/json'}),
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    return jsonResponse(response, `Chicken tracker item reset failed with HTTP ${response.status}.`)
}
