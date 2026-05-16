import type { Feature, LineString } from 'geojson'
import type { Map as MapboxMap } from 'mapbox-gl'

export type SearchBoxFeature = {
  id?: string
  geometry?: {
    type?: string
    coordinates?: [number, number]
  }
  properties?: {
    mapbox_id?: string
    feature_type?: string
    name?: string
    full_address?: string
    place_formatted?: string
    address?: string
  }
}

export type SearchBoxResponse = {
  features?: SearchBoxFeature[]
  message?: string
}

export type SearchResult = {
  id: string
  name: string
  subtitle: string
  address?: string
  featureType: string
  longitude: number
  latitude: number
}

export const SEARCH_RESULT_LIMIT = 10
export const SEARCH_RESULT_TYPES = 'poi,address,street,place,locality,neighborhood,postcode,region,country'
export const SEARCH_DEBOUNCE_MS = 250
export const ROUTE_FETCH_INTERVAL_MS = 10_000
export const ROUTE_FETCH_MOVE_THRESHOLD_METERS = 60
export const USER_HEADING_MOVE_THRESHOLD_METERS = 8
export const USER_LOCATION_STATE_THRESHOLD_METERS = 5
export const AUTO_CAMERA_RESUME_DELAY_MS = 2_500
export const METERS_PER_MILE = 1609.344
export const DRIVING_CAMERA_ZOOM = 16.8
export const DRIVING_CAMERA_PITCH = 64
export const DRIVING_CAMERA_PADDING = {
  top: 72,
  right: 40,
  bottom: 260,
  left: 40,
}

export const MOBILE_DRIVING_CAMERA_PADDING = {
  top: 280,
  right: 20,
  bottom: 24,
  left: 20,
}

const SEARCH_CATEGORY_MAP: Record<string, string> = {
  pub: 'bar',
  pubs: 'bar',
  bar: 'bar',
  bars: 'bar',
  cafe: 'coffee',
  cafes: 'coffee',
  'coffee shop': 'coffee',
  'coffee shops': 'coffee',
  restaurant: 'restaurant',
  restaurants: 'restaurant',
  hotel: 'lodging',
  hotels: 'lodging',
  'movie theater': 'cinema',
  'movie theaters': 'cinema',
  cinema: 'cinema',
  cinemas: 'cinema',
}

export const resolveViewportBounds = (map: MapboxMap): [number, number, number, number] => {
  const bounds = map.getBounds()
  if (!bounds) {
    return [-180, -85, 180, 85]
  }

  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
}

export const buildRouteFeature = (coordinates: [number, number][]): Feature<LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates,
  },
})

export const distanceBetweenCoordinatesInMeters = (
  from: [number, number],
  to: [number, number],
): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const [fromLng, fromLat] = from
  const [toLng, toLat] = to
  const earthRadius = 6_371_000
  const latitudeDelta = toRadians(toLat - fromLat)
  const longitudeDelta = toRadians(toLng - fromLng)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(longitudeDelta / 2) ** 2

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const calculateBearingDegrees = (from: [number, number], to: [number, number]): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const toDegrees = (value: number) => (value * 180) / Math.PI
  const [fromLng, fromLat] = from
  const [toLng, toLat] = to
  const longitudeDelta = toRadians(toLng - fromLng)
  const startLatitude = toRadians(fromLat)
  const endLatitude = toRadians(toLat)
  const y = Math.sin(longitudeDelta) * Math.cos(endLatitude)
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta)

  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

export const resolveRouteForwardBearing = (
  origin: [number, number],
  coordinates: [number, number][],
  fallbackDestination: [number, number],
): number => {
  if (coordinates.length < 2) {
    return calculateBearingDegrees(origin, fallbackDestination)
  }

  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  coordinates.forEach((coordinate, index) => {
    const distance = distanceBetweenCoordinatesInMeters(origin, coordinate)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  const nextCoordinate = coordinates[Math.min(nearestIndex + 1, coordinates.length - 1)]
  if (!nextCoordinate || (nextCoordinate[0] === origin[0] && nextCoordinate[1] === origin[1])) {
    return calculateBearingDegrees(origin, fallbackDestination)
  }

  return calculateBearingDegrees(origin, nextCoordinate)
}

export const formatDistanceMiles = (distanceMiles: number): string => {
  if (distanceMiles >= 10) {
    return `${distanceMiles.toFixed(0)} mi`
  }

  return `${distanceMiles.toFixed(1)} mi`
}

export const formatEta = (etaMinutes: number): string => {
  if (etaMinutes < 60) {
    return `${Math.max(1, Math.round(etaMinutes))} min`
  }

  const hours = Math.floor(etaMinutes / 60)
  const minutes = Math.round(etaMinutes % 60)
  return `${hours} hr ${minutes} min`
}

export const formatArrivalTime = (etaMinutes: number, now = new Date()): string => {
  const arrivalDate = new Date(now.getTime() + etaMinutes * 60_000)

  return arrivalDate.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const formatDirectionsModeLabel = (travelMode: 'driving' | 'walking'): string => {
  return travelMode === 'walking' ? 'Walking' : 'Driving'
}

export const normalizeSearchQuery = (query: string): string => {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

export const resolveCategorySearchId = (query: string): string | null => {
  return SEARCH_CATEGORY_MAP[normalizeSearchQuery(query)] ?? null
}

export const mapSearchFeatureToResult = (feature: SearchBoxFeature, index: number): SearchResult | null => {
  const coordinates = feature.geometry?.coordinates
  const name = feature.properties?.name?.trim()
  if (!coordinates || coordinates.length < 2 || !name) {
    return null
  }

  return {
    id: feature.properties?.mapbox_id ?? feature.id ?? `${name}-${index}`,
    name,
    subtitle:
      feature.properties?.full_address?.trim() ??
      feature.properties?.place_formatted?.trim() ??
      feature.properties?.address?.trim() ??
      '',
    address:
      feature.properties?.full_address?.trim() ??
      feature.properties?.place_formatted?.trim() ??
      feature.properties?.address?.trim() ??
      undefined,
    featureType: feature.properties?.feature_type ?? 'unknown',
    longitude: coordinates[0],
    latitude: coordinates[1],
  }
}