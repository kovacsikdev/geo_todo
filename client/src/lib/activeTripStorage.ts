const ACTIVE_TRIP_STORAGE_KEY = 'geo-todo-active-trip-id'

const normalizeTripId = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

export const loadActiveTripId = (): string => {
  const raw = window.localStorage.getItem(ACTIVE_TRIP_STORAGE_KEY)
  return normalizeTripId(raw)
}

export const saveActiveTripId = (tripId: string): void => {
  const normalizedTripId = normalizeTripId(tripId)
  if (!normalizedTripId) {
    return
  }

  window.localStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, normalizedTripId)
}

export const clearActiveTripId = (): void => {
  window.localStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY)
}
