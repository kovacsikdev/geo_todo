import { useCallback, useEffect, useRef, useState } from 'react'
import type { Feature, LineString } from 'geojson'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { LocationTodo, TripRole } from '../types'
import { createLocationMarkerElement, markerLabelText } from '../lib/tripMapMarkers'
import {
  openCreateLocationPopup,
  openCreateLocationPopupAtCoordinates,
} from '../lib/tripMapPopup'
import { buildFocusBounds } from '../lib/mapViewport'
import './TripMap.css'

type FocusRequest = {
  longitude: number
  latitude: number
  nonce: number
}

type DirectionsTarget = {
  locationId: string
  name: string
  longitude: number
  latitude: number
  travelMode: 'driving' | 'walking'
}

type DirectionsState =
  | { status: 'idle' }
  | { status: 'loading'; destinationName: string; message: string }
  | { status: 'ready'; destinationName: string; distanceMiles: number; etaMinutes: number }
  | { status: 'error'; destinationName: string; message: string }

type TripMapProps = {
  accessToken: string
  hasTrip: boolean
  tripRole: TripRole
  isSocketConnected: boolean
  isMenuOpen: boolean
  directionsTarget: DirectionsTarget | null
  locations: LocationTodo[]
  focusRequest: FocusRequest | null
  onCreateLocation: (payload: { name: string; latitude: number; longitude: number }) => void
  onLocationPinClick: (locationId: string) => void
  onCancelDirections: () => void
  onMapError: (message: string) => void
}

type DirectionsApiResponse = {
  routes?: Array<{
    distance: number
    duration: number
    geometry?: {
      coordinates?: [number, number][]
    }
  }>
  message?: string
}

type SearchBoxFeature = {
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

type SearchBoxResponse = {
  features?: SearchBoxFeature[]
  message?: string
}

type SearchResult = {
  id: string
  name: string
  subtitle: string
  featureType: string
  longitude: number
  latitude: number
}

const SEARCH_RESULT_LIMIT = 10
const SEARCH_RESULT_TYPES = 'poi,address,street'
const SEARCH_DEBOUNCE_MS = 250
const DIRECTIONS_SOURCE_ID = 'trip-directions-source'
const DIRECTIONS_LAYER_ID = 'trip-directions-layer'
const ROUTE_FETCH_INTERVAL_MS = 10_000
const ROUTE_FETCH_MOVE_THRESHOLD_METERS = 60
const USER_HEADING_MOVE_THRESHOLD_METERS = 8
const USER_LOCATION_STATE_THRESHOLD_METERS = 5
const AUTO_CAMERA_RESUME_DELAY_MS = 2_500
const METERS_PER_MILE = 1609.344
const DRIVING_CAMERA_ZOOM = 16.8
const DRIVING_CAMERA_PITCH = 64
const DRIVING_CAMERA_PADDING = {
  top: 72,
  right: 40,
  bottom: 260,
  left: 40,
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

const resolveViewportBounds = (map: mapboxgl.Map): [number, number, number, number] => {
  const bounds = map.getBounds()
  if (!bounds) {
    return [-180, -85, 180, 85]
  }

  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
}

const buildRouteFeature = (coordinates: [number, number][]): Feature<LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates,
  },
})

const distanceBetweenCoordinatesInMeters = (
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

const calculateBearingDegrees = (from: [number, number], to: [number, number]): number => {
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

const formatDistanceMiles = (distanceMiles: number): string => {
  if (distanceMiles >= 10) {
    return `${distanceMiles.toFixed(0)} mi`
  }

  return `${distanceMiles.toFixed(1)} mi`
}

const formatEta = (etaMinutes: number): string => {
  if (etaMinutes < 60) {
    return `${Math.max(1, Math.round(etaMinutes))} min`
  }

  const hours = Math.floor(etaMinutes / 60)
  const minutes = Math.round(etaMinutes % 60)
  return `${hours} hr ${minutes} min`
}

const formatDirectionsModeLabel = (travelMode: 'driving' | 'walking'): string => {
  return travelMode === 'walking' ? 'Walking' : 'Driving'
}

const normalizeSearchQuery = (query: string): string => {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

const resolveCategorySearchId = (query: string): string | null => {
  return SEARCH_CATEGORY_MAP[normalizeSearchQuery(query)] ?? null
}

const mapSearchFeatureToResult = (feature: SearchBoxFeature, index: number): SearchResult | null => {
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
    featureType: feature.properties?.feature_type ?? 'unknown',
    longitude: coordinates[0],
    latitude: coordinates[1],
  }
}

export const TripMap = ({
  accessToken,
  hasTrip,
  tripRole,
  isSocketConnected,
  isMenuOpen,
  directionsTarget,
  locations,
  focusRequest,
  onCreateLocation,
  onLocationPinClick,
  onCancelDirections,
  onMapError,
}: TripMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const locationMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const markerSnapshotRef = useRef<Map<string, string>>(new Map())
  const creationPopupRef = useRef<mapboxgl.Popup | null>(null)
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const userLocationWatchIdRef = useRef<number | null>(null)
  const currentUserCoordinatesRef = useRef<[number, number] | null>(null)
  const previousUserCoordinatesRef = useRef<[number, number] | null>(null)
  const lastUserCoordinatesStateRef = useRef<[number, number] | null>(null)
  const currentUserHeadingRef = useRef<number | null>(null)
  const hasRequestedUserLocationRef = useRef(false)
  const hasAutoFocusedUserLocationRef = useRef(false)
  const isUserInteractingRef = useRef(false)
  const autoCameraResumeTimeoutRef = useRef<number | null>(null)
  const latestCreatePopupHandlerRef = useRef<
    (longitude: number, latitude: number, suggestedName?: string) => void
  >(() => undefined)
  const directionsAbortControllerRef = useRef<AbortController | null>(null)
  const searchAbortControllerRef = useRef<AbortController | null>(null)
  const hasDirectionsCameraOverrideRef = useRef(false)
  const directionsLastFetchRef = useRef<{
    targetId: string
    origin: [number, number]
    timestamp: number
  } | null>(null)
  const activeDirectionsKeyRef = useRef<string | null>(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [hasUserLocation, setHasUserLocation] = useState(false)
  const [userCoordinates, setUserCoordinates] = useState<[number, number] | null>(null)
  const [directionsState, setDirectionsState] = useState<DirectionsState>({ status: 'idle' })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const clearDirectionsRoute = useCallback(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (map.getLayer(DIRECTIONS_LAYER_ID)) {
      map.removeLayer(DIRECTIONS_LAYER_ID)
    }

    if (map.getSource(DIRECTIONS_SOURCE_ID)) {
      map.removeSource(DIRECTIONS_SOURCE_ID)
    }
  }, [])

  const drawDirectionsRoute = useCallback((coordinates: [number, number][]) => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const routeFeature = buildRouteFeature(coordinates)
    const source = map.getSource(DIRECTIONS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (source) {
      source.setData(routeFeature)
      return
    }

    map.addSource(DIRECTIONS_SOURCE_ID, {
      type: 'geojson',
      data: routeFeature,
    })

    map.addLayer({
      id: DIRECTIONS_LAYER_ID,
      type: 'line',
      source: DIRECTIONS_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#0f5f75',
        'line-width': 5,
        'line-opacity': 0.92,
      },
    })
  }, [])

  const focusMapOnCoordinates = useCallback(async (longitude: number, latitude: number): Promise<void> => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const [minLng, minLat, maxLng, maxLat] = await buildFocusBounds(longitude, latitude)

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: 48,
        duration: 800,
        maxZoom: 32,
        retainPadding: false,
      },
    )
  }, [])

  const followDrivingCamera = useCallback(
    (origin: [number, number], destination: [number, number]) => {
      const map = mapRef.current
      if (!map || !isMapLoaded || isUserInteractingRef.current) {
        return
      }

      const fallbackBearing = calculateBearingDegrees(origin, destination)
      const bearing = currentUserHeadingRef.current ?? fallbackBearing
      hasDirectionsCameraOverrideRef.current = true

      map.easeTo({
        center: origin,
        zoom: Math.max(map.getZoom(), DRIVING_CAMERA_ZOOM),
        bearing,
        pitch: DRIVING_CAMERA_PITCH,
        padding: DRIVING_CAMERA_PADDING,
        duration: 900,
        essential: true,
        retainPadding: false,
      })
    },
    [isMapLoaded],
  )

  const openCreateLocationPopupFromCoordinates = useCallback(
    (longitude: number, latitude: number, suggestedName?: string) => {
      const map = mapRef.current
      if (!map) {
        return
      }

      if (!hasTrip) {
        onMapError('Create or join a trip before adding map locations.')
        return
      }

      if (tripRole !== 'owner') {
        onMapError('Guests have read-only access.')
        return
      }

      if (!isSocketConnected) {
        onMapError('Not connected to collaboration server.')
        return
      }

      creationPopupRef.current?.remove()
      creationPopupRef.current = openCreateLocationPopupAtCoordinates({
        map,
        longitude,
        latitude,
        suggestedLocationName: suggestedName,
        onCreateLocation,
      })
    },
    [hasTrip, isSocketConnected, onCreateLocation, onMapError, tripRole],
  )

  useEffect(() => {
    latestCreatePopupHandlerRef.current = openCreateLocationPopupFromCoordinates
  }, [openCreateLocationPopupFromCoordinates])

  const runViewportSearch = useCallback(
    async (query: string) => {
      const map = mapRef.current
      const trimmedQuery = query.trim()

      if (!map || !accessToken || trimmedQuery.length < 2) {
        searchAbortControllerRef.current?.abort()
        searchAbortControllerRef.current = null
        setIsSearchLoading(false)
        setSearchError(null)
        setSearchResults([])
        return
      }

      searchAbortControllerRef.current?.abort()
      const controller = new AbortController()
      searchAbortControllerRef.current = controller

      const [minLng, minLat, maxLng, maxLat] = resolveViewportBounds(map)
      const bbox = `${minLng},${minLat},${maxLng},${maxLat}`
      const categoryId = resolveCategorySearchId(trimmedQuery)

      const buildRequestUrl = (useCategoryEndpoint: boolean): URL => {
        const url = new URL(
          useCategoryEndpoint && categoryId
            ? `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(categoryId)}`
            : 'https://api.mapbox.com/search/searchbox/v1/forward',
        )

        if (!useCategoryEndpoint) {
          url.searchParams.set('q', trimmedQuery)
          url.searchParams.set('types', SEARCH_RESULT_TYPES)
          url.searchParams.set('auto_complete', 'true')
        }

        url.searchParams.set('limit', String(SEARCH_RESULT_LIMIT))
        url.searchParams.set('bbox', bbox)
        url.searchParams.set('language', 'en')
        url.searchParams.set('access_token', accessToken)
        return url
      }

      const requestSearch = async (useCategoryEndpoint: boolean): Promise<SearchResult[]> => {
        const response = await fetch(buildRequestUrl(useCategoryEndpoint), { signal: controller.signal })

        if (!response.ok) {
          throw new Error('Unable to load search results for this map view.')
        }

        const data = (await response.json()) as SearchBoxResponse
        return (data.features ?? [])
          .map((feature, index) => mapSearchFeatureToResult(feature, index))
          .filter((feature): feature is SearchResult => feature !== null)
      }

      setIsSearchLoading(true)
      setSearchError(null)

      try {
        let nextResults = await requestSearch(Boolean(categoryId))
        if (categoryId && nextResults.length === 0) {
          nextResults = await requestSearch(false)
        }

        setSearchResults(nextResults)
        setSearchError(nextResults.length === 0 ? 'No results found in the current map view.' : null)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setSearchResults([])
        setSearchError(error instanceof Error ? error.message : 'Unable to load search results.')
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchLoading(false)
        }
      }
    },
    [accessToken],
  )

  const focusMapOnUserLocation = (): void => {
    const coords = currentUserCoordinatesRef.current
    if (!coords) {
      return
    }

    void focusMapOnCoordinates(coords[0], coords[1])
  }

  useEffect(() => {
    if (!accessToken || !mapContainerRef.current || mapRef.current) {
      return
    }

    mapboxgl.accessToken = accessToken

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [8.2, 47.2],
      zoom: 2.3,
      attributionControl: false,
    })

    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.once('load', () => {
      setIsMapLoaded(true)
    })

    return () => {
      setIsMapLoaded(false)
      hasRequestedUserLocationRef.current = false
      hasAutoFocusedUserLocationRef.current = false
      currentUserCoordinatesRef.current = null
      previousUserCoordinatesRef.current = null
      currentUserHeadingRef.current = null
      lastUserCoordinatesStateRef.current = null
      isUserInteractingRef.current = false
      if (autoCameraResumeTimeoutRef.current !== null) {
        window.clearTimeout(autoCameraResumeTimeoutRef.current)
        autoCameraResumeTimeoutRef.current = null
      }
      hasDirectionsCameraOverrideRef.current = false
      activeDirectionsKeyRef.current = null
      directionsLastFetchRef.current = null
      directionsAbortControllerRef.current?.abort()
      directionsAbortControllerRef.current = null
      searchAbortControllerRef.current?.abort()
      searchAbortControllerRef.current = null
      setHasUserLocation(false)
      setUserCoordinates(null)
      setDirectionsState({ status: 'idle' })

      if (userLocationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(userLocationWatchIdRef.current)
        userLocationWatchIdRef.current = null
      }

      userLocationMarkerRef.current?.remove()
      userLocationMarkerRef.current = null

      creationPopupRef.current?.remove()
      creationPopupRef.current = null

      locationMarkersRef.current.forEach((marker) => marker.remove())
      locationMarkersRef.current.clear()
      markerSnapshotRef.current.clear()

      map.remove()
      mapRef.current = null
    }
  }, [accessToken])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isMapLoaded || hasRequestedUserLocationRef.current) {
      return
    }

    hasRequestedUserLocationRef.current = true
    if (!('geolocation' in navigator)) {
      return
    }

    const updateUserLocation = (position: GeolocationPosition) => {
      const lng = position.coords.longitude
      const lat = position.coords.latitude
      const nextCoordinates: [number, number] = [lng, lat]
      const reportedHeading =
        typeof position.coords.heading === 'number' && !Number.isNaN(position.coords.heading)
          ? position.coords.heading
          : null
      const previousCoordinates = previousUserCoordinatesRef.current

      if (reportedHeading !== null) {
        currentUserHeadingRef.current = reportedHeading
      } else if (
        previousCoordinates &&
        distanceBetweenCoordinatesInMeters(previousCoordinates, nextCoordinates) >=
          USER_HEADING_MOVE_THRESHOLD_METERS
      ) {
        currentUserHeadingRef.current = calculateBearingDegrees(previousCoordinates, nextCoordinates)
      }

      previousUserCoordinatesRef.current = nextCoordinates
      currentUserCoordinatesRef.current = nextCoordinates
      const lastStateCoordinates = lastUserCoordinatesStateRef.current
      const shouldUpdateUserCoordinatesState =
        !lastStateCoordinates ||
        distanceBetweenCoordinatesInMeters(lastStateCoordinates, nextCoordinates) >=
          USER_LOCATION_STATE_THRESHOLD_METERS

      if (shouldUpdateUserCoordinatesState) {
        lastUserCoordinatesStateRef.current = nextCoordinates
        setUserCoordinates(nextCoordinates)
      }

      setHasUserLocation((current) => (current ? current : true))

      if (!userLocationMarkerRef.current) {
        const markerElement = document.createElement('div')
        markerElement.className = 'map-user-location-marker'
        markerElement.setAttribute('aria-label', 'Your live location')

        userLocationMarkerRef.current = new mapboxgl.Marker({ element: markerElement, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map)
      } else {
        userLocationMarkerRef.current.setLngLat([lng, lat])
      }

      if (hasAutoFocusedUserLocationRef.current) {
        return
      }

      hasAutoFocusedUserLocationRef.current = true
      void focusMapOnCoordinates(lng, lat)
    }

    const handleLocationError = (_error: GeolocationPositionError) => {
      currentUserCoordinatesRef.current = null
      previousUserCoordinatesRef.current = null
      currentUserHeadingRef.current = null
      setUserCoordinates(null)
      setHasUserLocation(false)
    }

    navigator.geolocation.getCurrentPosition(
      updateUserLocation,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    )

    userLocationWatchIdRef.current = navigator.geolocation.watchPosition(
      updateUserLocation,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 1500,
      },
    )

    return () => {
      if (userLocationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(userLocationWatchIdRef.current)
        userLocationWatchIdRef.current = null
      }
    }
  }, [focusMapOnCoordinates, isMapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isMapLoaded) {
      return
    }

    const markUserInteraction = () => {
      isUserInteractingRef.current = true

      if (autoCameraResumeTimeoutRef.current !== null) {
        window.clearTimeout(autoCameraResumeTimeoutRef.current)
      }

      autoCameraResumeTimeoutRef.current = window.setTimeout(() => {
        isUserInteractingRef.current = false
        autoCameraResumeTimeoutRef.current = null
      }, AUTO_CAMERA_RESUME_DELAY_MS)
    }

    const clearUserInteraction = () => {
      if (autoCameraResumeTimeoutRef.current !== null) {
        window.clearTimeout(autoCameraResumeTimeoutRef.current)
        autoCameraResumeTimeoutRef.current = null
      }

      isUserInteractingRef.current = false
    }

    map.on('dragstart', markUserInteraction)
    map.on('zoomstart', markUserInteraction)
    map.on('rotatestart', markUserInteraction)
    map.on('pitchstart', markUserInteraction)
    map.on('dragend', markUserInteraction)
    map.on('zoomend', markUserInteraction)
    map.on('rotateend', markUserInteraction)
    map.on('pitchend', markUserInteraction)

    return () => {
      map.off('dragstart', markUserInteraction)
      map.off('zoomstart', markUserInteraction)
      map.off('rotatestart', markUserInteraction)
      map.off('pitchstart', markUserInteraction)
      map.off('dragend', markUserInteraction)
      map.off('zoomend', markUserInteraction)
      map.off('rotateend', markUserInteraction)
      map.off('pitchend', markUserInteraction)
      clearUserInteraction()
    }
  }, [isMapLoaded])

  useEffect(() => {
    if (!isMapLoaded) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void runViewportSearch(searchQuery)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isMapLoaded, runViewportSearch, searchQuery])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isMapLoaded) {
      return
    }

    const handleMapMoveEnd = () => {
      if (searchQuery.trim().length < 2) {
        return
      }

      void runViewportSearch(searchQuery)
    }

    map.on('moveend', handleMapMoveEnd)
    return () => {
      map.off('moveend', handleMapMoveEnd)
    }
  }, [isMapLoaded, runViewportSearch, searchQuery])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    map.resize()
  }, [isMenuOpen])

  useEffect(() => {
    if (!focusRequest) {
      return
    }

    void focusMapOnCoordinates(focusRequest.longitude, focusRequest.latitude)
  }, [focusMapOnCoordinates, focusRequest])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const onClick = (event: mapboxgl.MapMouseEvent) => {
      if (!hasTrip) {
        onMapError('Create or join a trip before adding map locations.')
        return
      }

      if (tripRole !== 'owner') {
        onMapError('Guests have read-only access.')
        return
      }

      if (!isSocketConnected) {
        onMapError('Not connected to collaboration server.')
        return
      }

      creationPopupRef.current?.remove()
      creationPopupRef.current = openCreateLocationPopup({
        map,
        event,
        onCreateLocation,
      })
    }

    map.on('click', onClick)

    return () => {
      map.off('click', onClick)
    }
  }, [hasTrip, isSocketConnected, onCreateLocation, onMapError, tripRole])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const markerMap = locationMarkersRef.current
    const markerSnapshots = markerSnapshotRef.current
    const seen = new Set<string>()

    locations.forEach((location) => {
      seen.add(location.id)
      const lngLat: [number, number] = [location.longitude, location.latitude]
      const labelText = markerLabelText(location)
      const snapshot = `${location.longitude}|${location.latitude}|${labelText}`

      const existing = markerMap.get(location.id)
      if (existing) {
        if (markerSnapshots.get(location.id) === snapshot) {
          return
        }

        existing.setLngLat(lngLat)
        const label = existing.getElement().querySelector<HTMLElement>('.map-location-label')
        if (label) {
          label.textContent = labelText
        }
        existing.getPopup()?.setText(labelText)
        markerSnapshots.set(location.id, snapshot)
        return
      }

      const popup = new mapboxgl.Popup({ offset: 16 }).setText(labelText)
      const marker = new mapboxgl.Marker({ element: createLocationMarkerElement(location), anchor: 'bottom' })
        .setLngLat(lngLat)
        .setPopup(popup)
        .addTo(map)

      const markerElement = marker.getElement()
      markerElement.tabIndex = 0
      markerElement.setAttribute('role', 'button')
      markerElement.setAttribute('aria-label', `Open TODO list for ${location.name}`)

      const openLocationInMenu = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        onLocationPinClick(location.id)
      }

      markerElement.addEventListener('click', openLocationInMenu)
      markerElement.addEventListener('keydown', (event) => {
        const keyboardEvent = event as KeyboardEvent
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
          openLocationInMenu(keyboardEvent)
        }
      })

      markerMap.set(location.id, marker)
      markerSnapshots.set(location.id, snapshot)
    })

    markerMap.forEach((marker, markerId) => {
      if (seen.has(markerId)) {
        return
      }

      marker.remove()
      markerMap.delete(markerId)
      markerSnapshots.delete(markerId)
    })
  }, [locations, onLocationPinClick])

  useEffect(() => {
    if (!directionsTarget || !userCoordinates) {
      return
    }

    followDrivingCamera(userCoordinates, [directionsTarget.longitude, directionsTarget.latitude])
  }, [directionsTarget, followDrivingCamera, userCoordinates])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isMapLoaded) {
      return
    }

    if (!directionsTarget) {
      const shouldResetCamera =
        hasDirectionsCameraOverrideRef.current || activeDirectionsKeyRef.current !== null

      directionsAbortControllerRef.current?.abort()
      directionsAbortControllerRef.current = null
      directionsLastFetchRef.current = null
      activeDirectionsKeyRef.current = null
      clearDirectionsRoute()
      setDirectionsState({ status: 'idle' })

      if (shouldResetCamera) {
        hasDirectionsCameraOverrideRef.current = false
        map.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 500,
          essential: true,
          retainPadding: false,
        })
      }

      return
    }

    if (!userCoordinates) {
      clearDirectionsRoute()
      setDirectionsState({
        status: 'loading',
        destinationName: directionsTarget.name,
        message: `Waiting for your current location to start ${directionsTarget.travelMode} directions.`,
      })
      return
    }

    const now = Date.now()
    const lastFetch = directionsLastFetchRef.current
    if (
      lastFetch &&
      lastFetch.targetId === directionsTarget.locationId &&
      now - lastFetch.timestamp < ROUTE_FETCH_INTERVAL_MS &&
      distanceBetweenCoordinatesInMeters(lastFetch.origin, userCoordinates) < ROUTE_FETCH_MOVE_THRESHOLD_METERS
    ) {
      return
    }

    directionsAbortControllerRef.current?.abort()
    const controller = new AbortController()
    directionsAbortControllerRef.current = controller
    directionsLastFetchRef.current = {
      targetId: directionsTarget.locationId,
      origin: userCoordinates,
      timestamp: now,
    }

    setDirectionsState({
      status: 'loading',
      destinationName: directionsTarget.name,
      message: `Calculating ${directionsTarget.travelMode} directions...`,
    })

    const destination: [number, number] = [directionsTarget.longitude, directionsTarget.latitude]
    const directionsProfile = directionsTarget.travelMode === 'walking' ? 'walking' : 'driving'
    const url = new URL(
      `https://api.mapbox.com/directions/v5/mapbox/${directionsProfile}/${userCoordinates[0]},${userCoordinates[1]};${destination[0]},${destination[1]}`,
    )
    url.searchParams.set('alternatives', 'false')
    url.searchParams.set('annotations', 'distance,duration')
    url.searchParams.set('geometries', 'geojson')
    url.searchParams.set('overview', 'full')
    url.searchParams.set('steps', 'true')
    url.searchParams.set('access_token', accessToken)

    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load driving directions.')
        }

        return (await response.json()) as DirectionsApiResponse
      })
      .then((data) => {
        const route = data.routes?.[0]
        const coordinates = route?.geometry?.coordinates
        if (!route || !coordinates || coordinates.length === 0) {
          throw new Error(data.message ?? 'No drivable route found for this destination.')
        }

        drawDirectionsRoute(coordinates)
        setDirectionsState({
          status: 'ready',
          destinationName: directionsTarget.name,
          distanceMiles: route.distance / METERS_PER_MILE,
          etaMinutes: route.duration / 60,
        })

        if (directionsTarget.travelMode === 'driving') {
          followDrivingCamera(userCoordinates, destination)
          return
        }

        const directionsKey = `${directionsTarget.locationId}:${directionsTarget.travelMode}`
        if (activeDirectionsKeyRef.current === directionsKey) {
          return
        }

        activeDirectionsKeyRef.current = directionsKey
        const bounds = coordinates.reduce(
          (accumulator, coordinate) => accumulator.extend(coordinate),
          new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
        )
        map.fitBounds(bounds, {
          padding: {
            top: 120,
            right: 48,
            bottom: 120,
            left: 48,
          },
          duration: 800,
          maxZoom: 16,
          retainPadding: false,
        })
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        clearDirectionsRoute()
        setDirectionsState({
          status: 'error',
          destinationName: directionsTarget.name,
          message: error.message,
        })
      })

    return () => {
      controller.abort()
    }
  }, [
    accessToken,
    clearDirectionsRoute,
    directionsTarget,
    drawDirectionsRoute,
    followDrivingCamera,
    isMapLoaded,
    userCoordinates,
  ])

  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      const map = mapRef.current
      if (!map) {
        return
      }

      setSearchQuery('')
      setSearchResults([])
      setSearchError(null)

      map.flyTo({
        center: [result.longitude, result.latitude],
        zoom: 16,
        essential: true,
      })

      latestCreatePopupHandlerRef.current(result.longitude, result.latitude, result.name)
    },
    [],
  )

  return (
    <section className="map-stage" aria-label="Trip map">
      <div ref={mapContainerRef} className="map-canvas" />
      <div className="map-search-control">
        <label className="map-search-label" htmlFor="trip-map-search">
          Search places and addresses
        </label>
        <input
          id="trip-map-search"
          className="map-search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setSearchResults([])
              setSearchError(null)
              return
            }

            if (event.key === 'Enter' && searchResults[0]) {
              event.preventDefault()
              handleSelectSearchResult(searchResults[0])
            }
          }}
          placeholder="Search places and addresses"
          autoComplete="off"
          spellCheck={false}
        />

        {searchQuery.trim().length >= 2 ? (
          <div className="map-search-results" role="listbox" aria-label="Search results">
            {isSearchLoading ? <p className="map-search-status">Searching this map view...</p> : null}

            {!isSearchLoading && searchError ? (
              <p className="map-search-status">{searchError}</p>
            ) : null}

            {!isSearchLoading && !searchError && searchResults.length > 0 ? (
              <ul className="map-search-results-list">
                {searchResults.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      className="map-search-result-button"
                      onClick={() => handleSelectSearchResult(result)}
                    >
                      <span className="map-search-result-name">{result.name}</span>
                      {result.subtitle ? (
                        <span className="map-search-result-subtitle">{result.subtitle}</span>
                      ) : (
                        <span className="map-search-result-subtitle map-search-result-subtitle--muted">
                          {result.featureType}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="map-focus-user-button"
        onClick={focusMapOnUserLocation}
        disabled={!hasUserLocation}
        aria-label="Focus my location"
        title="Focus my location"
      >
        <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 2.75a.75.75 0 0 1 .75.75v1.59a6.95 6.95 0 0 1 6.15 6.15h1.6a.75.75 0 0 1 0 1.5h-1.6a6.95 6.95 0 0 1-6.15 6.15v1.6a.75.75 0 0 1-1.5 0v-1.6a6.95 6.95 0 0 1-6.15-6.15H3.5a.75.75 0 0 1 0-1.5h1.6a6.95 6.95 0 0 1 6.15-6.15V3.5a.75.75 0 0 1 .75-.75Zm0 3.75a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm0 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {directionsTarget ? (
        <section className="map-directions-panel" aria-live="polite">
          <p className="map-directions-eyebrow">
            {formatDirectionsModeLabel(directionsTarget.travelMode)} directions
          </p>
          <h2>{directionsTarget.name}</h2>

          {directionsState.status === 'ready' ? (
            <div className="map-directions-metrics">
              <div>
                <span className="map-directions-label">Miles left</span>
                <strong>{formatDistanceMiles(directionsState.distanceMiles)}</strong>
              </div>
              <div>
                <span className="map-directions-label">ETA</span>
                <strong>{formatEta(directionsState.etaMinutes)}</strong>
              </div>
            </div>
          ) : null}

          {directionsState.status === 'loading' ? (
            <p className="map-directions-message">{directionsState.message}</p>
          ) : null}

          {directionsState.status === 'error' ? (
            <p className="map-directions-message map-directions-message--error">
              {directionsState.message}
            </p>
          ) : null}

          <div className="map-directions-actions">
            <button type="button" className="button subtle" onClick={onCancelDirections}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {!accessToken ? (
        <div className="map-warning">Set VITE_MAPBOX_ACCESS_TOKEN to render the map background.</div>
      ) : null}
    </section>
  )
}
