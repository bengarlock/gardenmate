import {NextResponse} from 'next/server'
import {AUTH_COOKIE_NAME} from '@/app/api/_gardenBackend'

const LOGIN_URL = process.env.GARDENMATE_LOGIN_URL || 'https://bengarlock.com/api/v1/login/'
const LOGIN_AUTH_TOKEN = process.env.GARDENMATE_LOGIN_AUTH_TOKEN || ''

export async function POST(request) {
    let payload
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({message: 'Invalid JSON body.'}, {status: 400})
    }

    const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(LOGIN_AUTH_TOKEN ? {Authorization: `Token ${LOGIN_AUTH_TOKEN}`} : {}),
        },
        body: JSON.stringify({
            username: payload.username,
            password: payload.password,
        }),
        cache: 'no-store',
    })

    const data = await response.json().catch(() => ({
        message: `Login failed with HTTP ${response.status}.`,
    }))

    if (!response.ok || !data.token) {
        return NextResponse.json(data, {status: response.status})
    }

    const nextResponse = NextResponse.json({valid: true})
    nextResponse.cookies.set(AUTH_COOKIE_NAME, data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24,
    })
    return nextResponse
}
