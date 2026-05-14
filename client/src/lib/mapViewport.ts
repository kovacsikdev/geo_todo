const EARTH_RADIUS_KM_PER_LAT_DEGREE = 110.574
const DEFAULT_BUFFER_KM = 0.7
const MIN_DEGREES = 0.01

export async function buildFocusBounds(longitude: number, latitude: number) {
  const latitudeDelta = Math.max(DEFAULT_BUFFER_KM / EARTH_RADIUS_KM_PER_LAT_DEGREE, MIN_DEGREES)
  const cosLatitude = Math.cos((latitude * Math.PI) / 180)
  const longitudeDegreesPerKm = 111.32 * Math.max(Math.abs(cosLatitude), 0.1)
  const longitudeDelta = Math.max(DEFAULT_BUFFER_KM / longitudeDegreesPerKm, MIN_DEGREES)

  return [
    longitude - longitudeDelta,
    latitude - latitudeDelta,
    longitude + longitudeDelta,
    latitude + latitudeDelta,
  ] as [number, number, number, number]
}
