const ACTIVE_ACCESS_ID_STORAGE_KEY = 'geo-todo-active-access-id'

const normalizeAccessId = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

export const loadActiveAccessId = (): string => {
  const current = window.localStorage.getItem(ACTIVE_ACCESS_ID_STORAGE_KEY)
  return normalizeAccessId(current)
}

export const saveActiveAccessId = (accessId: string): void => {
  const normalizedAccessId = normalizeAccessId(accessId)
  if (!normalizedAccessId) {
    return
  }

  window.localStorage.setItem(ACTIVE_ACCESS_ID_STORAGE_KEY, normalizedAccessId)
}

export const clearActiveAccessId = (): void => {
  window.localStorage.removeItem(ACTIVE_ACCESS_ID_STORAGE_KEY)
}
