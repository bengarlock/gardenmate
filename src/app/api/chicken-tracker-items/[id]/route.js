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
        return null
    }
}

export async function PATCH(request, { params }) {
    const { id } = await params
    const payload = await readJson(request)
    if (!payload) {
        return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const response = await fetch(`${CHICKEN_TRACKER_ITEMS_API_URL}${id}/`, {
        method: 'PATCH',
        headers: {
            ...headers(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    })

    const data = await response.json().catch(() => ({
        message: `Chicken tracker item update failed with HTTP ${response.status}.`,
    }))

    return NextResponse.json(data, { status: response.status })
}

export async function DELETE(request, { params }) {
    const { id } = await params
    const response = await fetch(`${CHICKEN_TRACKER_ITEMS_API_URL}${id}/`, {
        method: 'DELETE',
        headers: headers(),
        cache: 'no-store',
    })

    if (response.status === 204) {
        return new NextResponse(null, { status: 204 })
    }

    const data = await response.json().catch(() => ({
        message: `Chicken tracker item delete failed with HTTP ${response.status}.`,
    }))

    return NextResponse.json(data, { status: response.status })
}
