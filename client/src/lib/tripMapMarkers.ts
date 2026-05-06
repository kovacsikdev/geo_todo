import type { LocationTodo } from '../types'

export const markerLabelText = (location: LocationTodo): string => {
  let completedCount = 0
  for (const item of location.items) {
    if (item.done) {
      completedCount += 1
    }
  }

  return `${location.name}: ${completedCount}/${location.items.length}`
}

export const createLocationMarkerElement = (location: LocationTodo): HTMLDivElement => {
  const container = document.createElement('div')
  container.className = 'map-location-marker'

  const label = document.createElement('span')
  label.className = 'map-location-label'
  label.textContent = markerLabelText(location)

  const pin = document.createElement('span')
  pin.className = 'map-location-pin'
  pin.setAttribute('aria-hidden', 'true')

  container.append(label, pin)
  return container
}
