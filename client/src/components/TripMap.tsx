import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GeoJSONSource,
  Map as MapboxMap,
  MapMouseEvent,
  Marker,
  Popup,
} from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { LocationTodo, TripRole } from '../types'
import { createLocationMarkerElement, markerLabelText } from '../lib/tripMapMarkers'
import { openCreateLocationPopup } from '../lib/tripMapPopup'
import { buildFocusBounds } from '../lib/mapViewport'
import {
  AUTO_CAMERA_RESUME_DELAY_MS,
  DRIVING_CAMERA_PADDING,
  DRIVING_CAMERA_PITCH,
  DRIVING_CAMERA_ZOOM,
  METERS_PER_MILE,
  ROUTE_FETCH_INTERVAL_MS,
  ROUTE_FETCH_MOVE_THRESHOLD_METERS,
  SEARCH_DEBOUNCE_MS,
  SEARCH_RESULT_LIMIT,
  SEARCH_RESULT_TYPES,
  USER_HEADING_MOVE_THRESHOLD_METERS,
  USER_LOCATION_STATE_THRESHOLD_METERS,
  buildRouteFeature,
  calculateBearingDegrees,
  distanceBetweenCoordinatesInMeters,
  formatDirectionsModeLabel,
  formatDistanceMiles,
  formatEta,
  mapSearchFeatureToResult,
  resolveCategorySearchId,
  resolveRouteForwardBearing,
  resolveViewportBounds,
  type SearchBoxResponse,
  type SearchResult,
} from '../lib/tripMapUtils'
import './TripMap.css'

type MapboxRuntime = typeof import('mapbox-gl')['default']

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
  onCreateLocation: (payload: { name: string; address?: string; latitude: number; longitude: number }) => Promise<void>
  onLocationPinClick: (locationId: string) => void
  onCancelDirections: () => void
  onMapError: (message: string) => void
  onSearchFocus: () => void
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

const DIRECTIONS_SOURCE_ID = 'trip-directions-source'
const DIRECTIONS_LAYER_ID = 'trip-directions-layer'
const SEARCH_SELECTION_MARKER_CLASS = 'map-search-selection-marker'

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
  onSearchFocus,
}: TripMapProps) => {
  const mapboxRef = useRef<MapboxRuntime | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const locationMarkersRef = useRef<Map<string, Marker>>(new Map())
  const markerSnapshotRef = useRef<Map<string, string>>(new Map())
  const creationPopupRef = useRef<Popup | null>(null)
  const searchSelectionMarkerRef = useRef<Marker | null>(null)
  const userLocationMarkerRef = useRef<Marker | null>(null)
  const userLocationWatchIdRef = useRef<number | null>(null)
  const currentUserCoordinatesRef = useRef<[number, number] | null>(null)
  const previousUserCoordinatesRef = useRef<[number, number] | null>(null)
  const lastUserCoordinatesStateRef = useRef<[number, number] | null>(null)
  const currentUserHeadingRef = useRef<number | null>(null)
  const routeCoordinatesRef = useRef<[number, number][]>([])
  const hasRequestedUserLocationRef = useRef(false)
  const hasAutoFocusedUserLocationRef = useRef(false)
  const isUserInteractingRef = useRef(false)
  const autoCameraResumeTimeoutRef = useRef<number | null>(null)
  const directionsAbortControllerRef = useRef<AbortController | null>(null)
  const searchAbortControllerRef = useRef<AbortController | null>(null)
  const hasDirectionsCameraOverrideRef = useRef(false)
  const routeOverviewKeyRef = useRef<string | null>(null)
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
  const [hasBegunDirections, setHasBegunDirections] = useState(false)
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

  const drawDirectionsRoute = useCallback((
    coordinates: [number, number][],
    travelMode: 'driving' | 'walking',
  ) => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const routeFeature = buildRouteFeature(coordinates)
    const source = map.getSource(DIRECTIONS_SOURCE_ID) as GeoJSONSource | undefined
    if (source) {
      source.setData(routeFeature)

      if (map.getLayer(DIRECTIONS_LAYER_ID)) {
        map.setPaintProperty(
          DIRECTIONS_LAYER_ID,
          'line-dasharray',
          travelMode === 'walking' ? [1.2, 1.6] : [1, 0],
        )
      }

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
        'line-dasharray': travelMode === 'walking' ? [1.2, 1.6] : [1, 0],
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

  const followDirectionsCamera = useCallback(
    (origin: [number, number], destination: [number, number]) => {
      const map = mapRef.current
      if (!map || !isMapLoaded || isUserInteractingRef.current) {
        return
      }

      const routeBearing = resolveRouteForwardBearing(origin, routeCoordinatesRef.current, destination)
      const bearing = routeBearing ?? currentUserHeadingRef.current ?? calculateBearingDegrees(origin, destination)
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

  const clearSearchSelectionMarker = useCallback(() => {
    searchSelectionMarkerRef.current?.remove()
    searchSelectionMarkerRef.current = null
  }, [])

  const showSearchSelectionMarker = useCallback(
    (longitude: number, latitude: number) => {
      const map = mapRef.current
      if (!map) {
        return
      }

      clearSearchSelectionMarker()

      const markerElement = document.createElement('div')
      markerElement.className = SEARCH_SELECTION_MARKER_CLASS

      const mapbox = mapboxRef.current
      if (!mapbox) {
        return
      }

      searchSelectionMarkerRef.current = new mapbox.Marker({
        element: markerElement,
        anchor: 'bottom',
      })
        .setLngLat([longitude, latitude])
        .addTo(map)
    },
    [clearSearchSelectionMarker],
  )

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

      const categoryId = resolveCategorySearchId(trimmedQuery)

      const buildRequestUrl = (useCategoryEndpoint: boolean, useViewportBounds: boolean): URL => {
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
        if (useViewportBounds) {
          const [minLng, minLat, maxLng, maxLat] = resolveViewportBounds(map)
          url.searchParams.set('bbox', `${minLng},${minLat},${maxLng},${maxLat}`)
        }

        url.searchParams.set('language', 'en')
        url.searchParams.set('access_token', accessToken)
        return url
      }

      const requestSearch = async (
        useCategoryEndpoint: boolean,
        useViewportBounds: boolean,
      ): Promise<SearchResult[]> => {
        const response = await fetch(buildRequestUrl(useCategoryEndpoint, useViewportBounds), {
          signal: controller.signal,
        })

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
        let nextResults = await requestSearch(Boolean(categoryId), true)
        if (categoryId && nextResults.length === 0) {
          nextResults = await requestSearch(false, true)
        }

        if (nextResults.length === 0) {
          nextResults = await requestSearch(Boolean(categoryId), false)
        }

        if (categoryId && nextResults.length === 0) {
          nextResults = await requestSearch(false, false)
        }

        setSearchResults(nextResults)
        setSearchError(nextResults.length === 0 ? 'No results found for this search.' : null)
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

    let isCancelled = false

    void import('mapbox-gl').then(({ default: mapbox }) => {
      if (isCancelled || !mapContainerRef.current || mapRef.current) {
        return
      }

      mapbox.accessToken = accessToken
      mapboxRef.current = mapbox

      const map = new mapbox.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [8.2, 47.2],
        zoom: 2.3,
        attributionControl: false,
      })

      mapRef.current = map
      map.addControl(new mapbox.NavigationControl({ showCompass: false }), 'bottom-right')

      map.once('load', () => {
        setIsMapLoaded(true)
      })
    })

    return () => {
      isCancelled = true
      routeCoordinatesRef.current = []
      routeOverviewKeyRef.current = null
      setHasBegunDirections(false)
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
      clearSearchSelectionMarker()

      creationPopupRef.current?.remove()
      creationPopupRef.current = null

      locationMarkersRef.current.forEach((marker) => marker.remove())
      locationMarkersRef.current.clear()
      markerSnapshotRef.current.clear()

      mapRef.current?.remove()
      mapRef.current = null
      mapboxRef.current = null
    }
  }, [accessToken, clearSearchSelectionMarker])

  useEffect(() => {
    if (!directionsTarget) {
      setHasBegunDirections(false)
      routeCoordinatesRef.current = []
      routeOverviewKeyRef.current = null
      return
    }

    setHasBegunDirections(false)
    routeOverviewKeyRef.current = null
  }, [directionsTarget?.locationId, directionsTarget?.travelMode])

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

        const mapbox = mapboxRef.current
        if (!mapbox) {
          return
        }

        userLocationMarkerRef.current = new mapbox.Marker({ element: markerElement, anchor: 'center' })
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
    if (searchQuery.trim().length > 0) {
      clearSearchSelectionMarker()
    }
  }, [clearSearchSelectionMarker, searchQuery])

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
    if (!map || !isMapLoaded) {
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

    const onClick = (event: MapMouseEvent) => {
      clearSearchSelectionMarker()

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

      const mapbox = mapboxRef.current
      if (!mapbox) {
        onMapError('Map is still loading. Try again in a moment.')
        return
      }

      creationPopupRef.current?.remove()
      creationPopupRef.current = openCreateLocationPopup({
        accessToken,
        mapbox,
        map,
        event,
        onCreateLocation,
      })
    }

    map.on('click', onClick)

    return () => {
      map.off('click', onClick)
    }
  }, [
    accessToken,
    clearSearchSelectionMarker,
    hasTrip,
    isMapLoaded,
    isSocketConnected,
    onCreateLocation,
    onMapError,
    tripRole,
  ])

  useEffect(() => {
    const map = mapRef.current
    const mapbox = mapboxRef.current
    if (!map || !mapbox || !isMapLoaded) {
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

      const popup = new mapbox.Popup({ offset: 16 }).setText(labelText)
      const marker = new mapbox.Marker({ element: createLocationMarkerElement(location), anchor: 'bottom' })
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
        clearSearchSelectionMarker()
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
  }, [clearSearchSelectionMarker, isMapLoaded, locations, onLocationPinClick])

  useEffect(() => {
    if (!directionsTarget || !userCoordinates || !hasBegunDirections) {
      return
    }

    followDirectionsCamera(userCoordinates, [directionsTarget.longitude, directionsTarget.latitude])
  }, [directionsTarget, followDirectionsCamera, hasBegunDirections, userCoordinates])

  useEffect(() => {
    const map = mapRef.current
    const mapbox = mapboxRef.current
    if (!map || !mapbox || !isMapLoaded) {
      return
    }

    if (!directionsTarget) {
      const shouldResetCamera =
        hasDirectionsCameraOverrideRef.current || activeDirectionsKeyRef.current !== null

      directionsAbortControllerRef.current?.abort()
      directionsAbortControllerRef.current = null
      directionsLastFetchRef.current = null
      activeDirectionsKeyRef.current = null
      routeCoordinatesRef.current = []
      routeOverviewKeyRef.current = null
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

        routeCoordinatesRef.current = coordinates
        drawDirectionsRoute(coordinates, directionsTarget.travelMode)
        setDirectionsState({
          status: 'ready',
          destinationName: directionsTarget.name,
          distanceMiles: route.distance / METERS_PER_MILE,
          etaMinutes: route.duration / 60,
        })

        if (hasBegunDirections) {
          followDirectionsCamera(userCoordinates, destination)
          return
        }

        const directionsKey = `${directionsTarget.locationId}:${directionsTarget.travelMode}`
        if (routeOverviewKeyRef.current === directionsKey) {
          return
        }

        routeOverviewKeyRef.current = directionsKey
        activeDirectionsKeyRef.current = directionsKey
        const bounds = coordinates.reduce(
          (accumulator, coordinate) => accumulator.extend(coordinate),
          new mapbox.LngLatBounds(coordinates[0], coordinates[0]),
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

        routeCoordinatesRef.current = []
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
    followDirectionsCamera,
    hasBegunDirections,
    isMapLoaded,
    userCoordinates,
  ])

  const beginDirections = useCallback(() => {
    if (!directionsTarget || !userCoordinates) {
      return
    }

    setHasBegunDirections(true)
    followDirectionsCamera(userCoordinates, [directionsTarget.longitude, directionsTarget.latitude])
  }, [directionsTarget, followDirectionsCamera, userCoordinates])

  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      const map = mapRef.current
      if (!map) {
        return
      }

      setSearchQuery('')
      setSearchResults([])
      setSearchError(null)
      creationPopupRef.current?.remove()
      creationPopupRef.current = null
      showSearchSelectionMarker(result.longitude, result.latitude)

      map.flyTo({
        center: [result.longitude, result.latitude],
        zoom: 16,
        essential: true,
      })
    },
    [showSearchSelectionMarker],
  )

  return (
    <section className="map-stage" aria-label="Trip map">
      <div ref={mapContainerRef} className="map-canvas" />
      {accessToken && !isMapLoaded ? <div className="map-loading-overlay">Loading...</div> : null}
      <div className="map-search-control">
        <label className="map-search-label" htmlFor="trip-map-search">
          Search places and addresses
        </label>
        <input
          id="trip-map-search"
          className="map-search-input"
          type="search"
          value={searchQuery}
          onFocus={onSearchFocus}
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
            {directionsState.status === 'ready' && !hasBegunDirections ? (
              <button type="button" className="button primary" onClick={beginDirections}>
                {`Begin ${directionsTarget.travelMode}`}
              </button>
            ) : null}
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
