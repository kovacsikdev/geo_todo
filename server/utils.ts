import type { IncomingMessage } from 'node:http'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export function parseTripIdFromRequestUrl(reqUrl: string | undefined): string | null {
  if (!reqUrl) {
    return null
  }

  const parsed = new URL(reqUrl, 'http://localhost')
  return asTrimmedString(parsed.searchParams.get('tripId'))
}
