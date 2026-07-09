import {NextResponse} from 'next/server'

export const AUTH_COOKIE_NAME = 'portfolioAuthToken'
export const LEGACY_AUTH_COOKIE_NAMES = ['gardenMateToken']
export const GARDEN_API_BASE_URL =
    process.env.GARDEN_API_BASE_URL || 'https://bengarlock.com/api/v1/garden/'

export function tokenFromRequest(request) {
    return request.cookies.get(AUTH_COOKIE_NAME)?.value
        || LEGACY_AUTH_COOKIE_NAMES.map((name) => request.cookies.get(name)?.value).find(Boolean)
        || ''
}

export function authHeaders(request, extra = {}) {
    const token = tokenFromRequest(request)
    return {
        Accept: 'application/json',
        ...(token ? {Authorization: `Token ${token}`} : {}),
        ...extra,
    }
}

export function missingTokenResponse() {
    return NextResponse.json(
        {message: 'Authentication credentials were not provided.'},
        {status: 401},
    )
}

export async function jsonResponse(response, fallbackMessage) {
    const data = await response.json().catch(() => ({
        message: fallbackMessage,
    }))
    return NextResponse.json(data, {status: response.status})
}

export function gardenUrl(path, searchParams) {
    const base = GARDEN_API_BASE_URL.endsWith('/') ? GARDEN_API_BASE_URL : `${GARDEN_API_BASE_URL}/`
    const url = new URL(path, base)
    if (searchParams) {
        searchParams.forEach((value, key) => {
            url.searchParams.set(key, value)
        })
    }
    return url
}
