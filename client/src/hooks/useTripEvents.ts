import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { ServerMessage } from '../lib/tripClientProtocol'

type TripStateMessage = Extract<ServerMessage, { type: 'tripState' }>
type TripDeletedMessage = Extract<ServerMessage, { type: 'tripDeleted' }>

type UseTripEventsOptions = {
  serverUrl: string
  activeTripIdRef: MutableRefObject<string>
  activeAccessIdRef: MutableRefObject<string>
  onTripState: (message: TripStateMessage) => void
  onTripDeleted: (message: TripDeletedMessage) => void
  onReconnectJoinError: (error: Error) => void
  onSocketError: (message: string) => void
}

type JoinTripResult = {
  tripId: string
  role: 'owner' | 'guest'
  ownerId?: string
  guestId?: string
}

export const useTripEvents = ({
  serverUrl,
  activeTripIdRef,
  activeAccessIdRef,
  onTripState,
  onTripDeleted,
  onReconnectJoinError,
  onSocketError,
}: UseTripEventsOptions) => {
  const eventSourceRef = useRef<EventSource | null>(null)
  const [connected, setConnected] = useState(false)
  const connectionIdRef = useRef<string>('')
  const baseUrlRef = useRef<string>(serverUrl)
  const hasConnectedRef = useRef(false)

  // Sends a joinTrip POST using the current SSE connectionId.
  // Called both on initial/reconnect and when the user explicitly joins a trip.
  const joinTrip = useCallback(async (accessId: string): Promise<JoinTripResult> => {
    if (!connectionIdRef.current) {
      throw new Error('Not connected to server.')
    }

    const res = await fetch(
      `${baseUrlRef.current}/api/trip?connectionId=${connectionIdRef.current}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'joinTrip', payload: { accessId } }),
      },
    )

    const data = (await res.json()) as {
      ok: boolean
      payload?: JoinTripResult
      error?: string
    }
    if (!data.ok) {
      throw new Error(data.error ?? 'Trip not found.')
    }
    if (!data.payload) {
      throw new Error('Missing join response payload.')
    }

    // tripState arrives via SSE and is handled by onTripState.
    return data.payload
  }, [])

  useEffect(() => {
    baseUrlRef.current = serverUrl

    const eventSource = new EventSource(`${serverUrl}/api/events`)
    eventSourceRef.current = eventSource

    eventSource.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage

        if (message.type === 'connected') {
          connectionIdRef.current = message.connectionId
          hasConnectedRef.current = true
          setConnected(true)

          if (!activeTripIdRef.current || !activeAccessIdRef.current) {
            return
          }

          // Re-join the active trip after a reconnect
          void joinTrip(activeAccessIdRef.current).catch((error: Error) => {
            onReconnectJoinError(error)
          })
          return
        }

        if (message.type === 'tripState') {
          onTripState(message)
          return
        }

        if (message.type === 'tripDeleted') {
          onTripDeleted(message)
          return
        }
      } catch (error) {
        console.error('[useTripEvents] Error parsing SSE message:', error)
      }
    })

    eventSource.addEventListener('error', () => {
      console.error('[useTripEvents] SSE connection error')
      connectionIdRef.current = ''
      setConnected(false)

      // EventSource fires repeated errors while reconnecting; only toast once
      if (hasConnectedRef.current) {
        onSocketError('SSE connection dropped. Reconnecting...')
      }
    })

    return () => {
      connectionIdRef.current = ''
      hasConnectedRef.current = false
      setConnected(false)
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [
    activeAccessIdRef,
    activeTripIdRef,
    joinTrip,
    onReconnectJoinError,
    onSocketError,
    onTripDeleted,
    onTripState,
    serverUrl,
  ])

  return { connected, joinTrip }
}
