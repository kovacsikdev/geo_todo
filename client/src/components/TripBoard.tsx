import { memo } from 'react'
import { LocationCard } from './LocationCard'
import type { ClientAction, LocationTodo, TripRole } from '../types'

type TripBoardProps = {
  hasTrip: boolean
  tripRole: TripRole
  locations: LocationTodo[]
  onAction: (action: ClientAction) => void
  onFocusLocation: (longitude: number, latitude: number) => void
}

const TripBoardComponent = ({
  hasTrip,
  tripRole,
  locations,
  onAction,
  onFocusLocation,
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
        {hasTrip && locations.length === 0 ? (
          <article className="empty-state">
            <h2>No locations yet</h2>
            <p>Owners can click the map and confirm a location name to create the first TODO list.</p>
          </article>
        ) : !hasTrip ? (
          <article className="empty-state">
            <h2>No trip selected</h2>
            <p>Create a trip or join one using a shared trip ID.</p>
          </article>
        ) : (
          locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              onAction={onAction}
              canEdit={tripRole === 'owner'}
              onFocusLocation={onFocusLocation}
            />
          ))
        )}
      </section>
    </>
  )
}

export const TripBoard = memo(TripBoardComponent)
