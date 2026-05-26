import { NextResponse } from 'next/server'
import {authHeaders, jsonResponse, missingTokenResponse, tokenFromRequest} from '@/app/api/_gardenBackend'

const CHICKEN_TRACKER_ITEMS_API_URL =
    process.env.GARDEN_CHICKEN_TRACKER_ITEMS_API_URL ||
    'https://bengarlock.com/api/v1/garden/chicken-tracker-items/'

async function readJson(request) {
    try {
        return await request.json()
    } catch {
        return null
    }
}

export async function PATCH(request, { params }) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    const { id } = await params
    const payload = await readJson(request)
    if (!payload) {
        return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const response = await fetch(`${CHICKEN_TRACKER_ITEMS_API_URL}${id}/`, {
        method: 'PATCH',
        headers: authHeaders(request, {'Content-Type': 'application/json'}),
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    return jsonResponse(response, `Chicken tracker item update failed with HTTP ${response.status}.`)
}

export async function DELETE(request, { params }) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    const { id } = await params
    const response = await fetch(`${CHICKEN_TRACKER_ITEMS_API_URL}${id}/`, {
        method: 'DELETE',
        headers: authHeaders(request),
        cache: 'no-store',
    })

    if (response.status === 204) {
        return new NextResponse(null, { status: 204 })
    }

    return jsonResponse(response, `Chicken tracker item delete failed with HTTP ${response.status}.`)
}
