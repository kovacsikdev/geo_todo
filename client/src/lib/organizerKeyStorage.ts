const OWNER_TRIPS_STORAGE_KEY = 'geo-todo-owner-trips'

type OwnerTripMap = Record<string, string>

let ownerTripsCache: OwnerTripMap | null = null

const loadOwnerTrips = (): OwnerTripMap => {
  if (ownerTripsCache) {
    return ownerTripsCache
  }

  const raw = window.localStorage.getItem(OWNER_TRIPS_STORAGE_KEY)
  if (!raw) {
    ownerTripsCache = {}
    return ownerTripsCache
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      ownerTripsCache = {}
      return ownerTripsCache
    }

    ownerTripsCache = Object.entries(parsed).reduce<OwnerTripMap>((acc, [tripId, ownerId]) => {
      const normalizedTripId = typeof tripId === 'string' ? tripId.trim() : ''
      const normalizedOwnerId = typeof ownerId === 'string' ? ownerId.trim() : ''
      if (normalizedTripId && normalizedOwnerId) {
        acc[normalizedTripId] = normalizedOwnerId
      }
      return acc
    }, {})

    return ownerTripsCache
  } catch {
    ownerTripsCache = {}
    return ownerTripsCache
  }
}

const persistOwnerTrips = (trips: OwnerTripMap): void => {
  window.localStorage.setItem(OWNER_TRIPS_STORAGE_KEY, JSON.stringify(trips))
}

export const saveOwnerTrip = (tripId: string, ownerId: string): void => {
  const normalizedTripId = tripId.trim()
  const normalizedOwnerId = ownerId.trim()
  if (!normalizedTripId || !normalizedOwnerId) {
    return
  }

  const existing = loadOwnerTrips()
  if (existing[normalizedTripId] === normalizedOwnerId) {
    return
  }

  existing[normalizedTripId] = normalizedOwnerId
  persistOwnerTrips(existing)
}

export const getOwnerIdForTrip = (tripId: string): string | null => {
  const normalizedTripId = tripId.trim()
  if (!normalizedTripId) {
    return null
  }

  const ownerId = loadOwnerTrips()[normalizedTripId]
  return typeof ownerId === 'string' && ownerId.trim().length > 0 ? ownerId : null
}

export const isOwnerTrip = (tripId: string): boolean => {
  return getOwnerIdForTrip(tripId) !== null
}

export const removeOwnerTrip = (tripId: string): void => {
  const normalizedTripId = tripId.trim()
  if (!normalizedTripId) {
    return
  }

  const existing = loadOwnerTrips()
  delete existing[normalizedTripId]
  persistOwnerTrips(existing)
}
