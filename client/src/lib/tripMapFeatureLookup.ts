import type { Map, MapMouseEvent, MapboxGeoJSONFeature } from 'mapbox-gl'

const PLACE_NAME_KEYS = ['name', 'name_en', 'name:en', 'name_int', 'name_de', 'place_name', 'text', 'title']
const PLACE_ADDRESS_KEYS = ['full_address', 'place_formatted', 'address'] as const

type ReverseGeocodeFeature = {
  properties?: {
    full_address?: string
    place_formatted?: string
    address?: string
  }
}

type ReverseGeocodeResponse = {
  features?: ReverseGeocodeFeature[]
}

const normalizeComparableText = (value: string): string => value.trim().toLowerCase()

const sanitizeAddressCandidate = (candidate: string, name?: string): string | null => {
  const trimmed = candidate.trim()
  if (trimmed.length === 0) {
    return null
  }

  if (name && normalizeComparableText(trimmed) === normalizeComparableText(name)) {
    return null
  }

  return trimmed
}

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

const getFeatureAddress = (feature: MapboxGeoJSONFeature): string | null => {
  const properties = feature.properties
  if (!properties || typeof properties !== 'object') {
    return null
  }

  const featureName = getFeatureName(feature)

  for (const key of PLACE_ADDRESS_KEYS) {
    const raw = (properties as Record<string, unknown>)[key]
    if (typeof raw !== 'string') {
      continue
    }

    const candidate = sanitizeAddressCandidate(raw, featureName ?? undefined)
    if (candidate) {
      return candidate
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

export const resolveSuggestedLocationAddress = (
  map: Map,
  event: MapMouseEvent,
): string | undefined => {
  const features = map.queryRenderedFeatures(event.point)
  for (const feature of features) {
    const candidate = getFeatureAddress(feature)
    if (candidate) {
      return candidate.slice(0, 160)
    }
  }

  return undefined
}

export const fetchSuggestedLocationAddress = async ({
  accessToken,
  longitude,
  latitude,
  name,
}: {
  accessToken: string
  longitude: number
  latitude: number
  name?: string
}): Promise<string | undefined> => {
  try {
    const requestUrl = new URL('https://api.mapbox.com/search/geocode/v6/reverse')
    requestUrl.searchParams.set('longitude', String(longitude))
    requestUrl.searchParams.set('latitude', String(latitude))
    requestUrl.searchParams.set('types', 'address,street')
    requestUrl.searchParams.set('limit', '1')
    requestUrl.searchParams.set('access_token', accessToken)

    const response = await fetch(requestUrl)
    if (!response.ok) {
      return undefined
    }

    const data = (await response.json()) as ReverseGeocodeResponse
    for (const feature of data.features ?? []) {
      const properties = feature.properties
      if (!properties || typeof properties !== 'object') {
        continue
      }

      for (const key of PLACE_ADDRESS_KEYS) {
        const raw = properties[key]
        if (typeof raw !== 'string') {
          continue
        }

        const candidate = sanitizeAddressCandidate(raw, name)
        if (candidate) {
          return candidate.slice(0, 160)
        }
      }
    }
  } catch {
    return undefined
  }

  return undefined
}
