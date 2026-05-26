import { NextResponse } from 'next/server'
import {authHeaders, jsonResponse, missingTokenResponse, tokenFromRequest} from '@/app/api/_gardenBackend'

const CLIP_API_URL =
    process.env.GARDEN_NVR_CLIPS_API_URL || 'https://bengarlock.com/api/v1/garden/nvr-clips/'
const CLIP_LIVE_GUARD_MS = 15 * 1000

function clampClipPayload(payload) {
    if (!payload || typeof payload !== 'object' || typeof payload.at !== 'string') {
        return payload
    }

    const requestedMs = Date.parse(payload.at)
    if (!Number.isFinite(requestedMs)) {
        return payload
    }

    const latestSafeMs = Date.now() - CLIP_LIVE_GUARD_MS
    if (requestedMs <= latestSafeMs) {
        return payload
    }

    return {
        ...payload,
        at: new Date(latestSafeMs).toISOString(),
    }
}

export async function POST(request) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    let payload
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const response = await fetch(CLIP_API_URL, {
        method: 'POST',
        headers: authHeaders(request, {'Content-Type': 'application/json'}),
        body: JSON.stringify(clampClipPayload(payload)),
        cache: 'no-store',
    })

    return jsonResponse(response, `Clip request failed with HTTP ${response.status}.`)
}

export async function DELETE(request) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    let payload
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const response = await fetch(CLIP_API_URL, {
        method: 'DELETE',
        headers: authHeaders(request, {'Content-Type': 'application/json'}),
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    return jsonResponse(response, `Clip deletion failed with HTTP ${response.status}.`)
}
