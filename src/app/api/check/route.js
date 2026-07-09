import {NextResponse} from 'next/server'
import {tokenFromRequest} from '@/app/api/_gardenBackend'

const VERIFY_TOKEN_URL =
    process.env.GARDENMATE_VERIFY_TOKEN_URL || 'https://bengarlock.com/api/login/verify-token/'

export async function GET(request) {
    const token = tokenFromRequest(request)
    if (!token) {
        return NextResponse.json({valid: false}, {status: 401})
    }

    const response = await fetch(VERIFY_TOKEN_URL, {
        method: 'GET',
        headers: {
            Authorization: `Token ${token}`,
        },
        cache: 'no-store',
    })
    const data = await response.json().catch(() => ({valid: false}))
    return NextResponse.json(data, {status: response.status})
}
