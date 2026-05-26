import {NextResponse} from 'next/server'
import {
    authHeaders,
    gardenUrl,
    jsonResponse,
    missingTokenResponse,
    tokenFromRequest,
} from '@/app/api/_gardenBackend'

async function proxyGardenRequest(request, params, method) {
    if (!tokenFromRequest(request)) return missingTokenResponse()

    const resolvedParams = await params
    const path = `${resolvedParams.path.join('/')}/`
    const upstreamUrl = gardenUrl(path, request.nextUrl.searchParams)
    const init = {
        method,
        headers: authHeaders(request),
        cache: 'no-store',
    }

    if (!['GET', 'HEAD'].includes(method)) {
        init.body = await request.text()
        init.headers = authHeaders(request, {'Content-Type': request.headers.get('Content-Type') || 'application/json'})
    }

    const response = await fetch(upstreamUrl, init)

    if (response.status === 204) {
        return new NextResponse(null, {status: 204})
    }

    return jsonResponse(response, `Garden API request failed with HTTP ${response.status}.`)
}

export async function GET(request, context) {
    return proxyGardenRequest(request, context.params, 'GET')
}

export async function POST(request, context) {
    return proxyGardenRequest(request, context.params, 'POST')
}

export async function PATCH(request, context) {
    return proxyGardenRequest(request, context.params, 'PATCH')
}

export async function PUT(request, context) {
    return proxyGardenRequest(request, context.params, 'PUT')
}

export async function DELETE(request, context) {
    return proxyGardenRequest(request, context.params, 'DELETE')
}
