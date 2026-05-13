import type { ClientAction, SharedState } from '../types'

const createId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const locateLocation = (state: SharedState, locationId: string) => {
  const location = state.locations.find((entry) => entry.id === locationId)
  if (!location) {
    throw new Error('Location not found.')
  }

  return location
}

const locateItem = (state: SharedState, locationId: string, itemId: string) => {
  const location = locateLocation(state, locationId)
  const item = location.items.find((entry) => entry.id === itemId)
  if (!item) {
    throw new Error('Item not found.')
  }

  return { location, item }
}

export const applyTripAction = (state: SharedState, action: ClientAction): SharedState => {
  const nextState = structuredClone(state)

  switch (action.type) {
    case 'create_location': {
      nextState.locations.unshift({
        id: createId(),
        name: action.name,
        latitude: action.latitude,
        longitude: action.longitude,
        items: [],
      })
      break
    }
    case 'rename_location': {
      const location = locateLocation(nextState, action.locationId)
      location.name = action.name
      break
    }
    case 'delete_location': {
      nextState.locations = nextState.locations.filter((location) => location.id !== action.locationId)
      break
    }
    case 'add_item': {
      const location = locateLocation(nextState, action.locationId)
      location.items.push({
        id: createId(),
        text: action.text,
        done: false,
      })
      break
    }
    case 'update_item': {
      const { item } = locateItem(nextState, action.locationId, action.itemId)
      item.text = action.text
      break
    }
    case 'toggle_item': {
      const { item } = locateItem(nextState, action.locationId, action.itemId)
      item.done = action.done
      break
    }
    case 'delete_item': {
      const location = locateLocation(nextState, action.locationId)
      location.items = location.items.filter((item) => item.id !== action.itemId)
      break
    }
  }

  nextState.updatedAt = new Date().toISOString()
  return nextState
}