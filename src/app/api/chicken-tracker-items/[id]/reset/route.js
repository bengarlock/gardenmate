import { NextResponse } from 'next/server'

const CHICKEN_TRACKER_ITEMS_API_URL =
    process.env.GARDEN_CHICKEN_TRACKER_ITEMS_API_URL ||
    'https://bengarlock.com/api/v1/garden/chicken-tracker-items/'
const GARDEN_API_TOKEN = process.env.GARDEN_API_TOKEN || ''

function headers() {
    return {
        Accept: 'application/json',
        ...(GARDEN_API_TOKEN ? { Authorization: `Token ${GARDEN_API_TOKEN}` } : {}),
    }
}

async function readJson(request) {
    try {
        return await request.json()
    } catch {
        return {}
    }
}

export async function PATCH(request, { params }) {
    const { id } = await params
    const payload = await readJson(request)

    const response = await fetch(`${CHICKEN_TRACKER_ITEMS_API_URL}${id}/reset/`, {
        method: 'PATCH',
        headers: {
            ...headers(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    const data = await response.json().catch(() => ({
        message: `Chicken tracker item reset failed with HTTP ${response.status}.`,
    }))

    return NextResponse.json(data, { status: response.status })
}
