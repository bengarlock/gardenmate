import { NextResponse } from 'next/server'

const CLIP_API_URL =
    process.env.GARDEN_NVR_CLIPS_API_URL || 'https://bengarlock.com/api/v1/garden/nvr-clips/'
const GARDEN_API_TOKEN = process.env.GARDEN_API_TOKEN || ''

export async function POST(request) {
    let payload
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const response = await fetch(CLIP_API_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            ...(GARDEN_API_TOKEN ? { Authorization: `Token ${GARDEN_API_TOKEN}` } : {}),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    const data = await response.json().catch(() => ({
        message: `Clip request failed with HTTP ${response.status}.`,
    }))

    return NextResponse.json(data, { status: response.status })
}
