import {NextResponse} from 'next/server'

const BASE_PATH = '/gardenmate'
const LOGIN_PATH = '/login'
const HOME_PATH = '/'
const VERIFY_TOKEN_URL =
    process.env.GARDENMATE_VERIFY_TOKEN_URL || 'https://bengarlock.com/api/login/verify-token/'
const AUTH_COOKIE_NAME = 'portfolioAuthToken'
const LEGACY_AUTH_COOKIE_NAMES = ['gardenMateToken']

function pathWithoutBase(pathname) {
    if (pathname === BASE_PATH) return '/'
    if (pathname.startsWith(`${BASE_PATH}/`)) {
        return pathname.slice(BASE_PATH.length)
    }
    return pathname
}

function redirectTo(req, pathname) {
    const url = req.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    return NextResponse.redirect(url)
}

function clearAuthCookie(response) {
    ;[AUTH_COOKIE_NAME, ...LEGACY_AUTH_COOKIE_NAMES].forEach((name) => response.cookies.set(name, '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        ...(process.env.NODE_ENV === 'production' ? {domain: '.bengarlock.com'} : {}),
    }))
    return response
}

async function isValidToken(token) {
    try {
        const response = await fetch(VERIFY_TOKEN_URL, {
            method: 'GET',
            headers: {
                Authorization: `Token ${token}`,
            },
            cache: 'no-store',
        })

        if (!response.ok) return false

        const data = await response.json().catch(() => null)
        return data?.valid === true || data?.Message === 'Token is valid'
    } catch (error) {
        console.error('GardenMate token verification failed:', error)
        return false
    }
}

export async function proxy(req) {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
        || LEGACY_AUTH_COOKIE_NAMES.map((name) => req.cookies.get(name)?.value).find(Boolean)
    const pathname = pathWithoutBase(req.nextUrl.pathname)
    const isLogin = pathname === LOGIN_PATH
    const isApi = pathname === '/api' || pathname.startsWith('/api/')
    const isAsset = pathname === '/favicon.ico' || pathname.startsWith('/_next/')

    if (isAsset) {
        return NextResponse.next()
    }

    if (!token && !isLogin && !isApi) {
        return redirectTo(req, LOGIN_PATH)
    }

    if (token && !isApi) {
        const validToken = await isValidToken(token)

        if (!validToken) {
            const response = isLogin ? NextResponse.next() : redirectTo(req, LOGIN_PATH)
            return clearAuthCookie(response)
        }

        if (isLogin) {
            return redirectTo(req, HOME_PATH)
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/',
        '/gardenmate',
        '/login',
        '/gardenmate/login',
        '/plants/:path*',
        '/gardenmate/plants/:path*',
        '/weather/:path*',
        '/gardenmate/weather/:path*',
        '/chickens/:path*',
        '/gardenmate/chickens/:path*',
    ],
}
