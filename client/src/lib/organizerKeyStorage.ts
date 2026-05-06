const OWNER_TRIPS_STORAGE_KEY = 'geo-todo-owner-trips'

let ownerTripsCache: Set<string> | null = null

const loadOwnerTrips = (): Set<string> => {
  if (ownerTripsCache) {
    return ownerTripsCache
  }

  const raw = window.localStorage.getItem(OWNER_TRIPS_STORAGE_KEY)
  if (!raw) {
    ownerTripsCache = new Set()
    return ownerTripsCache
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      ownerTripsCache = new Set()
      return ownerTripsCache
    }

    ownerTripsCache = new Set(
      parsed
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    )
    return ownerTripsCache
  } catch {
    ownerTripsCache = new Set()
    return ownerTripsCache
  }
}

const persistOwnerTrips = (trips: Set<string>): void => {
  window.localStorage.setItem(OWNER_TRIPS_STORAGE_KEY, JSON.stringify([...trips]))
}

export const saveOwnerTrip = (tripId: string): void => {
  const normalizedTripId = tripId.trim()
  if (!normalizedTripId) {
    return
  }

  const existing = loadOwnerTrips()
  if (existing.has(normalizedTripId)) {
    return
  }

  existing.add(normalizedTripId)
  persistOwnerTrips(existing)
}

export const isOwnerTrip = (tripId: string): boolean => {
  const normalizedTripId = tripId.trim()
  if (!normalizedTripId) {
    return false
  }

  return loadOwnerTrips().has(normalizedTripId)
}

export const removeOwnerTrip = (tripId: string): void => {
  const normalizedTripId = tripId.trim()
  if (!normalizedTripId) {
    return
  }

  const existing = loadOwnerTrips()
  existing.delete(normalizedTripId)
  persistOwnerTrips(existing)
}
