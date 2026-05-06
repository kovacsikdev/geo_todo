import type { SharedState } from '../types'

// Messages the server pushes to guests via SSE
export type ServerMessage =
  | { type: 'connected'; connectionId: string }
  | { type: 'tripState'; tripId: string; revision: number; payload: SharedState }
  | { type: 'tripDeleted'; tripId: string; message: string }

export const createTripId = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const randomBytes = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const raw = Array.from(randomBytes, (byte) => alphabet[byte % alphabet.length]).join('')
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}
