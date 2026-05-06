export type TodoItem = {
  id: string
  text: string
  done: boolean
}

export type Trip = {
  id: string
  name: string
}

export type LocationTodo = {
  id: string
  name: string
  latitude: number
  longitude: number
  items: TodoItem[]
}

export type TripState = {
  trip: Trip
  locations: LocationTodo[]
  updatedAt: string
}

export type TripRecord = {
  tripId: string
  connectionIds: string[]
  data: string
  revision: number
}

export type SocketAction = 'joinTrip' | 'createTrip' | 'updateTrip' | 'deleteTrip'

export type JoinTripPayload = {
  tripId: string
}

export type CreateTripPayload = {
  tripId: string
  data: string
}

export type UpdateTripPayload = {
  tripId: string
  data: string
}

export type DeleteTripPayload = {
  tripId: string
}

export type ClientSocketMessage = {
  action: SocketAction
  requestId?: string
  payload?: unknown
}

export type ClientAction =
  | { type: 'create_location'; name: string; latitude: number; longitude: number }
  | { type: 'rename_location'; locationId: string; name: string }
  | { type: 'delete_location'; locationId: string }
  | { type: 'add_item'; locationId: string; text: string }
  | { type: 'update_item'; locationId: string; itemId: string; text: string }
  | { type: 'toggle_item'; locationId: string; itemId: string; done: boolean }
  | { type: 'delete_item'; locationId: string; itemId: string }
