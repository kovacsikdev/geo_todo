import { useCallback, useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { LocationTodo, TripRole } from '../types'
import { createLocationMarkerElement, markerLabelText } from '../lib/tripMapMarkers'
import { openCreateLocationPopup } from '../lib/tripMapPopup'
import { buildFocusBounds } from '../lib/mapViewport'

type FocusRequest = {
  longitude: number
  latitude: number
  nonce: number
}

type TripMapProps = {
  accessToken: string
  hasTrip: boolean
  tripRole: TripRole
  isSocketConnected: boolean
  isMenuOpen: boolean
  locations: LocationTodo[]
  focusRequest: FocusRequest | null
  onCreateLocation: (payload: { name: string; latitude: number; longitude: number }) => void
  onLocationPinClick: (locationId: string) => void
  onMapError: (message: string) => void
}

export const TripMap = ({
  accessToken,
  hasTrip,
  tripRole,
  isSocketConnected,
  isMenuOpen,
  locations,
  focusRequest,
  onCreateLocation,
  onLocationPinClick,
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
  const hasRequestedUserLocationRef = useRef(false)
  const hasAutoFocusedUserLocationRef = useRef(false)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [hasUserLocation, setHasUserLocation] = useState(false)

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
      },
    )
  }, [])

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
      setHasUserLocation(false)

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
      currentUserCoordinatesRef.current = [lng, lat]
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
      setHasUserLocation((current) => (current ? false : current))
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

  return (
    <section className="map-stage" aria-label="Trip map">
      <div ref={mapContainerRef} className="map-canvas" />

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

      {!accessToken ? (
        <div className="map-warning">Set VITE_MAPBOX_ACCESS_TOKEN to render the map background.</div>
      ) : null}
    </section>
  )
}
