import type { Map, MapMouseEvent, MapboxGeoJSONFeature } from 'mapbox-gl'

const PLACE_NAME_KEYS = ['name', 'name_en', 'name:en', 'name_int', 'name_de', 'place_name', 'text', 'title']

const getFeatureName = (feature: MapboxGeoJSONFeature): string | null => {
  const properties = feature.properties
  if (!properties || typeof properties !== 'object') {
    return null
  }

  for (const key of PLACE_NAME_KEYS) {
    const raw = (properties as Record<string, unknown>)[key]
    if (typeof raw !== 'string') {
      continue
    }

    const trimmed = raw.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }

  return null
}

export const resolveSuggestedLocationName = (
  map: Map,
  event: MapMouseEvent,
): string => {
  const features = map.queryRenderedFeatures(event.point)
  for (const feature of features) {
    const candidate = getFeatureName(feature)
    if (candidate) {
      return candidate.slice(0, 80)
    }
  }

  return ''
}
