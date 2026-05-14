declare module '@mapbox/mapbox-gl-geocoder' {
  import type mapboxgl from 'mapbox-gl'

  export type GeocoderResultFeature = {
    id?: string
    text?: string
    place_name?: string
    center?: [number, number]
    geometry?: {
      type?: string
      coordinates?: [number, number]
    }
  }

  export type GeocoderResultEvent = {
    result: GeocoderResultFeature
  }

  export type GeocoderOptions = {
    accessToken: string
    mapboxgl: typeof mapboxgl
    marker?: boolean
    flyTo?: boolean
    placeholder?: string
    trackProximity?: boolean
    minLength?: number
    zoom?: number
    types?: string
    limit?: number
    reverseGeocode?: boolean
  }

  export default class MapboxGeocoder {
    constructor(options: GeocoderOptions)
    addTo(container: HTMLElement | string): this
    on(type: 'result', listener: (event: GeocoderResultEvent) => void): this
    on(type: string, listener: (event: unknown) => void): this
    off(type: 'result', listener: (event: GeocoderResultEvent) => void): this
    off(type: string, listener: (event: unknown) => void): this
    onRemove(): this
    clear(): this
    query(searchInput: string): this
    setInput(searchInput: string, showSuggestions?: boolean): this
    setLimit(limit: number): this
    setTypes(types: string): this
    setBbox(bbox: [number, number, number, number] | undefined): this
  }
}
