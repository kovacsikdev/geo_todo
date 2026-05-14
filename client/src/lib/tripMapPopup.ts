import type { Map as MapboxMap, MapMouseEvent, Popup } from 'mapbox-gl'
import {
  fetchSuggestedLocationAddress,
  resolveSuggestedLocationAddress,
  resolveSuggestedLocationName,
} from './tripMapFeatureLookup'

type MapboxRuntime = typeof import('mapbox-gl')['default']

type CreateLocationPayload = {
  name: string
  address?: string
  latitude: number
  longitude: number
}

type OpenCreateLocationPopupAtCoordinatesOptions = {
  accessToken: string
  mapbox: MapboxRuntime
  map: MapboxMap
  latitude: number
  longitude: number
  suggestedLocationName?: string
  suggestedLocationAddress?: string
  onCreateLocation: (payload: CreateLocationPayload) => void
}

type OpenCreateLocationPopupOptions = {
  mapbox: MapboxRuntime
  map: MapboxMap
  event: MapMouseEvent
  onCreateLocation: (payload: CreateLocationPayload) => void
}

export const openCreateLocationPopupAtCoordinates = ({
  accessToken,
  mapbox,
  map,
  latitude,
  longitude,
  suggestedLocationName,
  suggestedLocationAddress,
  onCreateLocation,
}: OpenCreateLocationPopupAtCoordinatesOptions): Popup => {
  const content = document.createElement('div')
  content.className = 'map-create-popup'

  const prompt = document.createElement('p')
  prompt.textContent = 'Add a TODO list for this spot?'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Location name'
  input.maxLength = 80

  if (suggestedLocationName) {
    input.value = suggestedLocationName
  }

  const actions = document.createElement('div')
  actions.className = 'map-create-popup-actions'

  const confirmButton = document.createElement('button')
  confirmButton.type = 'button'
  confirmButton.textContent = 'Add location'

  const cancelButton = document.createElement('button')
  cancelButton.type = 'button'
  cancelButton.textContent = 'Cancel'

  actions.append(confirmButton, cancelButton)
  content.append(prompt, input, actions)

  const popup = new mapbox.Popup({ closeButton: true, closeOnClick: true, offset: 14 })
    .setLngLat([longitude, latitude])
    .setDOMContent(content)
    .addTo(map)

  confirmButton.addEventListener('click', async () => {
    const trimmedName = input.value.trim()
    if (!trimmedName) {
      input.focus()
      return
    }

    confirmButton.disabled = true
    cancelButton.disabled = true
    input.disabled = true
    confirmButton.textContent = 'Adding...'

    const resolvedAddress =
      suggestedLocationAddress ??
      (await fetchSuggestedLocationAddress({
        accessToken,
        longitude,
        latitude,
        name: trimmedName,
      }))

    onCreateLocation({
      name: trimmedName,
      address: resolvedAddress,
      latitude,
      longitude,
    })

    popup.remove()
  })

  cancelButton.addEventListener('click', () => {
    popup.remove()
  })

  input.addEventListener('keydown', (keyEvent) => {
    if (keyEvent.key === 'Enter') {
      keyEvent.preventDefault()
      confirmButton.click()
    }
  })

  requestAnimationFrame(() => {
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  })

  return popup
}

export const openCreateLocationPopup = ({
  accessToken,
  mapbox,
  map,
  event,
  onCreateLocation,
}: OpenCreateLocationPopupOptions & { accessToken: string }): Popup => {
  return openCreateLocationPopupAtCoordinates({
    accessToken,
    mapbox,
    map,
    latitude: event.lngLat.lat,
    longitude: event.lngLat.lng,
    suggestedLocationName: resolveSuggestedLocationName(map, event),
    suggestedLocationAddress: resolveSuggestedLocationAddress(map, event),
    onCreateLocation,
  })
}
