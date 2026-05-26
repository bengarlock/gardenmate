import {NextResponse} from 'next/server'
import {AUTH_COOKIE_NAME} from '@/app/api/_gardenBackend'

export async function POST() {
    const response = NextResponse.json({success: true})
    response.cookies.set(AUTH_COOKIE_NAME, '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        sameSite: 'strict',
    })
    return response
}
