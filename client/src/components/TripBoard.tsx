import { memo } from 'react'
import { LocationCard } from './LocationCard'
import type { ClientAction, LocationTodo, TripRole } from '../types'
import './TripBoard.css'

type TripBoardProps = {
  hasTrip: boolean
  tripRole: TripRole
  locations: LocationTodo[]
  onAction: (action: ClientAction) => void
  onFocusLocation: (longitude: number, latitude: number) => void
  onStartDirections: (location: LocationTodo, mode: 'driving' | 'walking') => void
}

const TripBoardComponent = ({
  hasTrip,
  tripRole,
  locations,
  onAction,
  onFocusLocation,
  onStartDirections,
}: TripBoardProps) => {
  return (
    <>
      {hasTrip ? (
        <section className="new-location">
          <p className="map-selection-hint">
            {tripRole === 'owner'
              ? 'Add locations by clicking the map and confirming the popup.'
              : 'Guests have read-only access. Owner updates appear in real-time.'}
          </p>
        </section>
      ) : null}

      <section className="locations-grid">
        {hasTrip && locations.length > 0 && (
          locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              onAction={onAction}
              canEdit={tripRole === 'owner'}
              onFocusLocation={onFocusLocation}
              onStartDirections={onStartDirections}
            />
          ))
        )}
      </section>
    </>
  )
}

export const TripBoard = memo(TripBoardComponent)
