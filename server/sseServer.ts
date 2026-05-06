import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  createTrip,
  deleteTrip,
  joinTrip,
  removeConnectionId,
  updateTripData,
} from './tripStore.js'
import { asTrimmedString, isRecord } from './utils.js'
import type {
  CreateTripPayload,
  DeleteTripPayload,
  JoinTripPayload,
  TripRecord,
  TripState,
  UpdateTripPayload,
} from './types.js'

type ConnectionContext = {
  connectionId: string
  tripId: string | null
  response: ServerResponse
  heartbeat: NodeJS.Timeout | null
}

const clientsByConnectionId = new Map<string, ConnectionContext>()
const connectionIdsByTripId = new Map<string, Set<string>>()

type ServerMessage =
  | { type: 'connected'; connectionId: string }
  | { type: 'tripState'; tripId: string; revision: number; payload: TripState }
  | { type: 'tripDeleted'; tripId: string; message: string }
  | {
      type: 'response'
      requestId: string | null
      action: 'createTrip' | 'joinTrip' | 'updateTrip' | 'deleteTrip'
      ok: boolean
      payload?: unknown
      error?: string
    }

function sendSSEMessage(response: ServerResponse, message: ServerMessage): void {
  if (!isResponseWritable(response)) {
    return
  }

  const data = JSON.stringify(message)
  response.write(`data: ${data}\n\n`)
}

function isResponseWritable(response: ServerResponse): boolean {
  return !response.writableEnded && !response.destroyed
}

function sendSSEKeepAlive(response: ServerResponse): void {
  if (!isResponseWritable(response)) {
    return
  }

  // SSE comment frame used as a heartbeat to keep proxies from closing idle streams.
  response.write(': keepalive\n\n')
}

function parseTripState(data: string): TripState {
  const parsed = JSON.parse(data)
  if (!isRecord(parsed) || !isRecord(parsed.trip)) {
    throw new Error('Trip data must be a valid serialized trip state.')
  }

  if (asTrimmedString(parsed.trip.id) === null || asTrimmedString(parsed.trip.name) === null) {
    throw new Error('Trip data must include trip.id and trip.name.')
  }

  return parsed as TripState
}

function normalizeTripStateData(tripId: string, rawData: string): string {
  const state = parseTripState(rawData)
  if (state.trip.id !== tripId) {
    throw new Error('Trip data trip.id must match the provided tripId.')
  }

  return JSON.stringify(state)
}

function parseJoinTripPayload(payload: unknown): JoinTripPayload {
  if (!isRecord(payload)) {
    throw new Error('joinTrip payload is required.')
  }

  const tripId = asTrimmedString(payload.tripId)
  if (!tripId) {
    throw new Error('tripId is required.')
  }

  return { tripId }
}

function parseCreateTripPayload(payload: unknown): CreateTripPayload {
  if (!isRecord(payload)) {
    throw new Error('createTrip payload is required.')
  }

  const tripId = asTrimmedString(payload.tripId)
  const data = asTrimmedString(payload.data)
  if (!tripId || !data) {
    throw new Error('tripId and data are required.')
  }

  return { tripId, data }
}

function parseUpdateTripPayload(payload: unknown): UpdateTripPayload {
  if (!isRecord(payload)) {
    throw new Error('updateTrip payload is required.')
  }

  const tripId = asTrimmedString(payload.tripId)
  const data = asTrimmedString(payload.data)
  if (!tripId || !data) {
    throw new Error('tripId and data are required.')
  }

  return { tripId, data }
}

function parseDeleteTripPayload(payload: unknown): DeleteTripPayload {
  if (!isRecord(payload)) {
    throw new Error('deleteTrip payload is required.')
  }

  const tripId = asTrimmedString(payload.tripId)
  if (!tripId) {
    throw new Error('tripId is required.')
  }

  return { tripId }
}

async function detachFromPreviousTrip(
  currentTripId: string | null,
  nextTripId: string,
  connectionId: string,
): Promise<void> {
  if (!currentTripId || currentTripId === nextTripId) {
    return
  }

  await removeConnectionId(currentTripId, connectionId)
  const connections = connectionIdsByTripId.get(currentTripId)
  if (connections) {
    connections.delete(connectionId)
    if (connections.size === 0) {
      connectionIdsByTripId.delete(currentTripId)
    }
  }
}

function sendResponse(
  response: ServerResponse,
  response_: Extract<ServerMessage, { type: 'response' }>,
): void {
  sendSSEMessage(response, response_)
}

function emitTripState(record: TripRecord, connectionIds?: string[]): void {
  const payload = parseTripState(record.data)
  const targets = connectionIds ?? record.connectionIds

  targets.forEach((connectionId) => {
    const context = clientsByConnectionId.get(connectionId)
    if (!context) {
      return
    }

    sendSSEMessage(context.response, {
      type: 'tripState',
      tripId: record.tripId,
      revision: record.revision,
      payload,
    })
  })
}

function emitTripDeleted(record: TripRecord): void {
  record.connectionIds.forEach((connectionId) => {
    const context = clientsByConnectionId.get(connectionId)
    if (!context) {
      return
    }

    sendSSEMessage(context.response, {
      type: 'tripDeleted',
      tripId: record.tripId,
      message: 'Trip was deleted.',
    })
  })
}

function clearTripFromContexts(tripId: string): void {
  clientsByConnectionId.forEach((context) => {
    if (context.tripId === tripId) {
      context.tripId = null
    }
  })
}

function resolveRequestId(value: unknown): string | null {
  const requestId = asTrimmedString(value)
  return requestId ?? null
}

async function handleClientMessage(
  connectionId: string,
  action: string,
  payload: unknown,
  requestId: string | null,
): Promise<{ ok: boolean; payload?: unknown; error?: string }> {
  const context = clientsByConnectionId.get(connectionId)
  if (!context) {
    return { ok: false, error: 'Connection not found.' }
  }

  if (action !== 'createTrip' && action !== 'joinTrip' && action !== 'updateTrip' && action !== 'deleteTrip') {
    return { ok: false, error: 'Unsupported action.' }
  }

  try {
    switch (action) {
      case 'createTrip': {
        const parsed = parseCreateTripPayload(payload)
        const normalizedData = normalizeTripStateData(parsed.tripId, parsed.data)
        await detachFromPreviousTrip(context.tripId, parsed.tripId, context.connectionId)

        const record = await createTrip(parsed.tripId, context.connectionId, normalizedData)
        context.tripId = parsed.tripId
        
        if (!connectionIdsByTripId.has(parsed.tripId)) {
          connectionIdsByTripId.set(parsed.tripId, new Set())
        }
        connectionIdsByTripId.get(parsed.tripId)?.add(context.connectionId)

        emitTripState(record, [context.connectionId])
        return { ok: true, payload: { tripId: parsed.tripId } }
      }

      case 'joinTrip': {
        const parsed = parseJoinTripPayload(payload)
        await detachFromPreviousTrip(context.tripId, parsed.tripId, context.connectionId)

        const record = await joinTrip(parsed.tripId, context.connectionId)
        if (!record) {
          return { ok: false, error: 'Trip not found.' }
        }

        context.tripId = parsed.tripId
        
        if (!connectionIdsByTripId.has(parsed.tripId)) {
          connectionIdsByTripId.set(parsed.tripId, new Set())
        }
        connectionIdsByTripId.get(parsed.tripId)?.add(context.connectionId)

        emitTripState(record, [context.connectionId])
        return { ok: true, payload: { tripId: parsed.tripId } }
      }

      case 'updateTrip': {
        const parsed = parseUpdateTripPayload(payload)
        const normalizedData = normalizeTripStateData(parsed.tripId, parsed.data)
        if (context.tripId && context.tripId !== parsed.tripId) {
          return { ok: false, error: 'Join the trip before updating it.' }
        }

        const record = await updateTripData(parsed.tripId, normalizedData)
        if (!record) {
          return { ok: false, error: 'Trip not found.' }
        }

        context.tripId = parsed.tripId
        
        if (!connectionIdsByTripId.has(parsed.tripId)) {
          connectionIdsByTripId.set(parsed.tripId, new Set())
        }
        connectionIdsByTripId.get(parsed.tripId)?.add(context.connectionId)

        emitTripState(record)
        return { ok: true, payload: { tripId: parsed.tripId } }
      }

      case 'deleteTrip': {
        const parsed = parseDeleteTripPayload(payload)
        if (context.tripId && context.tripId !== parsed.tripId) {
          return { ok: false, error: 'Join the trip before deleting it.' }
        }

        const record = await deleteTrip(parsed.tripId)
        if (!record) {
          return { ok: false, error: 'Trip not found.' }
        }

        emitTripDeleted(record)
        clearTripFromContexts(parsed.tripId)
        connectionIdsByTripId.delete(parsed.tripId)
        context.tripId = null
        return { ok: true, payload: { tripId: parsed.tripId } }
      }

      default:
        return { ok: false, error: 'Unknown action.' }
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function handleSSEConnection(req: IncomingMessage, res: ServerResponse): void {
  const connectionId = globalThis.crypto.randomUUID()
  const context: ConnectionContext = {
    connectionId,
    tripId: null,
    response: res,
    heartbeat: null,
  }

  clientsByConnectionId.set(connectionId, context)

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  // Send initial connected message
  sendSSEMessage(res, {
    type: 'connected',
    connectionId,
  })

  context.heartbeat = setInterval(() => {
    sendSSEKeepAlive(res)
  }, 20_000)

  let cleanedUp = false
  const cleanup = async (): Promise<void> => {
    if (cleanedUp) {
      return
    }
    cleanedUp = true

    if (context.heartbeat) {
      clearInterval(context.heartbeat)
      context.heartbeat = null
    }

    clientsByConnectionId.delete(connectionId)

    if (context.tripId) {
      await removeConnectionId(context.tripId, connectionId)
      const connections = connectionIdsByTripId.get(context.tripId)
      if (connections) {
        connections.delete(connectionId)
        if (connections.size === 0) {
          connectionIdsByTripId.delete(context.tripId)
        }
      }
    }
  }

  // Handle client disconnect
  req.on('close', () => {
    void cleanup()
  })

  res.on('error', () => {
    void cleanup()
  })
}

async function handleOwnerAction(
  action: string,
  payload: unknown,
): Promise<{ ok: boolean; payload?: unknown; error?: string }> {
  if (action === 'joinTrip') {
    return { ok: false, error: 'Guests must open an SSE connection before joining a trip.' }
  }

  if (action !== 'createTrip' && action !== 'updateTrip' && action !== 'deleteTrip') {
    return { ok: false, error: 'Unsupported action.' }
  }

  try {
    switch (action) {
      case 'createTrip': {
        const parsed = parseCreateTripPayload(payload)
        const normalizedData = normalizeTripStateData(parsed.tripId, parsed.data)
        await createTrip(parsed.tripId, null, normalizedData)
        return { ok: true, payload: { tripId: parsed.tripId } }
      }

      case 'updateTrip': {
        const parsed = parseUpdateTripPayload(payload)
        const normalizedData = normalizeTripStateData(parsed.tripId, parsed.data)
        const record = await updateTripData(parsed.tripId, normalizedData)
        if (!record) {
          return { ok: false, error: 'Trip not found.' }
        }
        // Notify all connected guests
        emitTripState(record)
        return { ok: true, payload: { tripId: parsed.tripId } }
      }

      case 'deleteTrip': {
        const parsed = parseDeleteTripPayload(payload)
        const record = await deleteTrip(parsed.tripId)
        if (!record) {
          return { ok: false, error: 'Trip not found.' }
        }
        emitTripDeleted(record)
        clearTripFromContexts(parsed.tripId)
        connectionIdsByTripId.delete(parsed.tripId)
        return { ok: true, payload: { tripId: parsed.tripId } }
      }

      default:
        return { ok: false, error: 'Unknown action.' }
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function handleTripAction(
  body: string | unknown,
  connectionId: string | null,
): Promise<{ ok: boolean; payload?: unknown; error?: string; action?: string; requestId?: string | null }> {
  try {
    const data = typeof body === 'string' ? JSON.parse(body) : body

    if (!isRecord(data)) {
      return { ok: false, error: 'Request body must be valid JSON.' }
    }

    const action = asTrimmedString(data.action)
    if (!action) {
      return { ok: false, error: 'Action is required.' }
    }

    const requestId = resolveRequestId(data.requestId)
    const payload = data.payload

    if (!connectionId) {
      const result = await handleOwnerAction(action, payload)
      return { ...result, action, requestId: null }
    }

    const result = await handleClientMessage(connectionId, action, payload, requestId)

    return {
      ...result,
      action,
      requestId,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid request.',
    }
  }
}
