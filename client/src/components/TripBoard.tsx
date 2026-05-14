import { memo, useCallback } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  )

  const handleLocationDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (tripRole !== 'owner') {
        return
      }

      const { active, over } = event
      if (!over || active.id === over.id) {
        return
      }

      const previousIndex = locations.findIndex((location) => location.id === active.id)
      const nextIndex = locations.findIndex((location) => location.id === over.id)
      if (previousIndex < 0 || nextIndex < 0) {
        return
      }

      const nextOrder = arrayMove(locations, previousIndex, nextIndex).map((location) => location.id)
      onAction({ type: 'reorder_locations', locationIds: nextOrder })
    },
    [locations, onAction, tripRole],
  )

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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLocationDragEnd}>
        <SortableContext items={locations.map((location) => location.id)} strategy={rectSortingStrategy}>
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
        </SortableContext>
      </DndContext>
    </>
  )
}

export const TripBoard = memo(TripBoardComponent)
