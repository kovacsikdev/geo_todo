import mapboxgl from 'mapbox-gl'
import { resolveSuggestedLocationName } from './tripMapFeatureLookup'

type CreateLocationPayload = {
  name: string
  latitude: number
  longitude: number
}

type OpenCreateLocationPopupOptions = {
  map: mapboxgl.Map
  event: mapboxgl.MapMouseEvent
  onCreateLocation: (payload: CreateLocationPayload) => void
}

export const openCreateLocationPopup = ({
  map,
  event,
  onCreateLocation,
}: OpenCreateLocationPopupOptions): mapboxgl.Popup => {
  const content = document.createElement('div')
  content.className = 'map-create-popup'

  const prompt = document.createElement('p')
  prompt.textContent = 'Add a TODO list for this spot?'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Location name'
  input.maxLength = 80

  const suggestedLocationName = resolveSuggestedLocationName(map, event)
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

  const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, offset: 14 })
    .setLngLat(event.lngLat)
    .setDOMContent(content)
    .addTo(map)

  confirmButton.addEventListener('click', () => {
    const trimmedName = input.value.trim()
    if (!trimmedName) {
      input.focus()
      return
    }

    onCreateLocation({
      name: trimmedName,
      latitude: event.lngLat.lat,
      longitude: event.lngLat.lng,
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
