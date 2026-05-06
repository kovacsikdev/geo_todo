import type { IncomingMessage, ServerResponse } from 'node:http'

const CORS_ALLOWED_METHODS = 'GET,POST,OPTIONS'
const CORS_DEFAULT_ALLOWED_HEADERS = 'content-type'

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, '')
  try {
    return new URL(trimmed).origin
  } catch {
    return trimmed
  }
}

function resolveAllowedOrigin(origin: string | undefined, allowedOrigins: Set<string>): string | null {
  if (!origin) {
    return null
  }

  const normalizedOrigin = normalizeOrigin(origin)
  if (allowedOrigins.has(origin) || allowedOrigins.has(normalizedOrigin)) {
    return origin
  }

  return null
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: Set<string>): boolean {
  if (!origin) {
    return true
  }

  if (allowedOrigins.has('*')) {
    return true
  }

  return resolveAllowedOrigin(origin, allowedOrigins) !== null
}

export function applyCorsHeaders(
  res: ServerResponse,
  origin: string | undefined,
  allowedOrigins: Set<string>,
): void {
  res.setHeader('vary', 'origin')
  if (allowedOrigins.has('*')) {
    res.setHeader('access-control-allow-origin', '*')
    return
  }

  const allowedOrigin = resolveAllowedOrigin(origin, allowedOrigins)
  if (allowedOrigin) {
    res.setHeader('access-control-allow-origin', allowedOrigin)
  }
}

export function handleCorsPreflight(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== 'OPTIONS') {
    return false
  }

  const requestedHeaders = req.headers['access-control-request-headers']
  const allowedHeaders =
    typeof requestedHeaders === 'string' && requestedHeaders.trim().length > 0
      ? requestedHeaders
      : CORS_DEFAULT_ALLOWED_HEADERS

  res.writeHead(204, {
    'access-control-allow-methods': CORS_ALLOWED_METHODS,
    'access-control-allow-headers': allowedHeaders,
    'access-control-max-age': '86400',
  })
  res.end()
  return true
}
