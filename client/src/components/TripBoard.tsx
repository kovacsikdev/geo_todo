import { memo, useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { LocationCard } from './LocationCard'
import { useDragPointerSensors } from '../hooks/useDragPointerSensors'
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
  const [directionsDialogLocation, setDirectionsDialogLocation] = useState<LocationTodo | null>(null)
  const [locationEditorLocation, setLocationEditorLocation] = useState<LocationTodo | null>(null)
  const [locationEditorDraft, setLocationEditorDraft] = useState('')
  const [dialogFrame, setDialogFrame] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  const sensors = useDragPointerSensors()

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

  const openDirectionsDialog = useCallback((location: LocationTodo) => {
    setDirectionsDialogLocation(location)
  }, [])

  const openLocationEditor = useCallback((location: LocationTodo) => {
    setLocationEditorLocation(location)
    setLocationEditorDraft(location.name)
  }, [])

  const closeDirectionsDialog = useCallback(() => {
    setDirectionsDialogLocation(null)
  }, [])

  const closeLocationEditor = useCallback(() => {
    setLocationEditorLocation(null)
    setLocationEditorDraft('')
  }, [])

  const startDirectionsFromDialog = useCallback(
    (mode: 'driving' | 'walking') => {
      if (!directionsDialogLocation) {
        return
      }

      onStartDirections(directionsDialogLocation, mode)
      setDirectionsDialogLocation(null)
    },
    [directionsDialogLocation, onStartDirections],
  )

  const submitLocationEditor = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!locationEditorLocation || tripRole !== 'owner') {
        return
      }

      const trimmed = locationEditorDraft.trim()
      if (!trimmed) {
        return
      }

      if (trimmed !== locationEditorLocation.name) {
        onAction({
          type: 'rename_location',
          locationId: locationEditorLocation.id,
          name: trimmed,
        })
      }

      closeLocationEditor()
    },
    [closeLocationEditor, locationEditorDraft, locationEditorLocation, onAction, tripRole],
  )

  useEffect(() => {
    if (!locationEditorLocation) {
      return
    }

    const nextLocation = locations.find((location) => location.id === locationEditorLocation.id)
    if (!nextLocation) {
      closeLocationEditor()
      return
    }

    setLocationEditorLocation(nextLocation)
  }, [closeLocationEditor, locationEditorLocation, locations])

  useEffect(() => {
    if (!directionsDialogLocation && !locationEditorLocation) {
      setDialogFrame(null)
      return
    }

    const syncDialogFrame = () => {
      const sideMenu = document.getElementById('todo-side-menu')
      if (!sideMenu) {
        setDialogFrame(null)
        return
      }

      const bounds = sideMenu.getBoundingClientRect()
      setDialogFrame({
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      })
    }

    syncDialogFrame()
    window.addEventListener('resize', syncDialogFrame)

    return () => {
      window.removeEventListener('resize', syncDialogFrame)
    }
  }, [directionsDialogLocation, locationEditorLocation])

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
                  onOpenLocationEditor={openLocationEditor}
                  onOpenDirectionsDialog={openDirectionsDialog}
                />
              ))
            )}
          </section>
        </SortableContext>
      </DndContext>

      {locationEditorLocation
        ? createPortal(
            <div
              className="side-menu-dialog-backdrop"
              role="presentation"
              onClick={closeLocationEditor}
              style={
                dialogFrame
                  ? {
                      top: `${dialogFrame.top}px`,
                      left: `${dialogFrame.left}px`,
                      width: `${dialogFrame.width}px`,
                      height: `${dialogFrame.height}px`,
                    }
                  : undefined
              }
            >
              <div
                className="location-editor-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={`Edit location ${locationEditorLocation.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                <form className="location-editor-form" onSubmit={submitLocationEditor}>
                  <label className="field-label" htmlFor={`location-editor-${locationEditorLocation.id}`}>
                    Edit location
                  </label>
                  <input
                    id={`location-editor-${locationEditorLocation.id}`}
                    value={locationEditorDraft}
                    onChange={(event) => setLocationEditorDraft(event.target.value)}
                    autoFocus
                  />
                  <div className="location-editor-actions">
                    <button
                      type="button"
                      className="button subtle location-action-button"
                      onClick={closeLocationEditor}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="button primary location-action-button"
                      disabled={locationEditorDraft.trim().length === 0}
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {directionsDialogLocation
        ? createPortal(
            <div
              className="side-menu-dialog-backdrop"
              role="presentation"
              onClick={closeDirectionsDialog}
              style={
                dialogFrame
                  ? {
                      top: `${dialogFrame.top}px`,
                      left: `${dialogFrame.left}px`,
                      width: `${dialogFrame.width}px`,
                      height: `${dialogFrame.height}px`,
                    }
                  : undefined
              }
            >
              <div
                className="location-editor-dialog directions-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={`Choose directions type for ${directionsDialogLocation.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="directions-dialog-copy">
                  <p className="field-label">Directions to {directionsDialogLocation.name}</p>
                  <p className="directions-dialog-text">
                    Choose whether you want driving or walking directions from your current location.
                  </p>
                </div>
                <div className="location-editor-actions">
                  <button
                    type="button"
                    className="button subtle location-action-button"
                    onClick={closeDirectionsDialog}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button subtle location-action-button"
                    onClick={() => startDirectionsFromDialog('walking')}
                  >
                    Walking
                  </button>
                  <button
                    type="button"
                    className="button primary location-action-button"
                    onClick={() => startDirectionsFromDialog('driving')}
                  >
                    Driving
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export const TripBoard = memo(TripBoardComponent)
