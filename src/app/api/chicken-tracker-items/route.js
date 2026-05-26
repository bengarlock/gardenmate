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

export async function GET(request) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    const upstreamUrl = new URL(CHICKEN_TRACKER_ITEMS_API_URL)
    request.nextUrl.searchParams.forEach((value, key) => {
        upstreamUrl.searchParams.set(key, value)
    })

    const response = await fetch(upstreamUrl, {
        headers: authHeaders(request),
        cache: 'no-store',
    })

    return jsonResponse(response, `Chicken tracker items request failed with HTTP ${response.status}.`)
}

export async function POST(request) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    const payload = await readJson(request)
    if (!payload) {
        return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const response = await fetch(CHICKEN_TRACKER_ITEMS_API_URL, {
        method: 'POST',
        headers: authHeaders(request, {'Content-Type': 'application/json'}),
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    return jsonResponse(response, `Chicken tracker item creation failed with HTTP ${response.status}.`)
}
