import {NextResponse} from 'next/server'
import {AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAMES} from '@/app/api/_gardenBackend'

function clearCookieOptions() {
    return {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        ...(process.env.NODE_ENV === 'production' ? {domain: '.bengarlock.com'} : {}),
    }
}

export async function POST() {
    const response = NextResponse.json({success: true})
    ;[AUTH_COOKIE_NAME, ...LEGACY_AUTH_COOKIE_NAMES].forEach((name) => {
        response.cookies.set(name, '', clearCookieOptions())
    })
    return response
}
