export type TodoItem = {
  id: string
  text: string
  done: boolean
}

export type LocationTodo = {
  id: string
  name: string
  latitude: number
  longitude: number
  items: TodoItem[]
}

export type Trip = {
  id: string
  name: string
}

export type SharedState = {
  trip: Trip
  locations: LocationTodo[]
  updatedAt: string
}

export type ClientAction =
  | { type: 'create_location'; name: string; latitude: number; longitude: number }
  | { type: 'rename_location'; locationId: string; name: string }
  | { type: 'delete_location'; locationId: string }
  | { type: 'add_item'; locationId: string; text: string }
  | { type: 'update_item'; locationId: string; itemId: string; text: string }
  | { type: 'toggle_item'; locationId: string; itemId: string; done: boolean }
  | { type: 'delete_item'; locationId: string; itemId: string }

export type TripRole = 'owner' | 'guest'
