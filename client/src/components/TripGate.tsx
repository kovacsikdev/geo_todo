import type { FormEvent } from 'react'
import { memo } from 'react'

type TripGateProps = {
  connected: boolean
  busy: boolean
  tripNameDraft: string
  tripIdDraft: string
  onTripNameDraftChange: (value: string) => void
  onTripIdDraftChange: (value: string) => void
  onCreateTrip: (event: FormEvent<HTMLFormElement>) => void
  onJoinTrip: (event: FormEvent<HTMLFormElement>) => void
}

const TripGateComponent = ({
  connected,
  busy,
  tripNameDraft,
  tripIdDraft,
  onTripNameDraftChange,
  onTripIdDraftChange,
  onCreateTrip,
  onJoinTrip,
}: TripGateProps) => {
  const disabled = busy || !connected

  return (
    <section className="trip-gate">
      {!connected ? (
        <p className="map-selection-hint" role="status" aria-live="polite">
          Reconnecting to collaboration server. Create and Join are temporarily disabled.
        </p>
      ) : null}

      <form className="trip-gate-form" onSubmit={onCreateTrip}>
        <label className="field-label" htmlFor="new-trip-name">
          Create a new trip
        </label>
        <div className="row">
          <input
            id="new-trip-name"
            value={tripNameDraft}
            onChange={(event) => onTripNameDraftChange(event.target.value)}
            placeholder="e.g. Summer in Lisbon"
          />
          <button type="submit" style={{width: '100px'}} className="button primary" disabled={disabled || tripNameDraft.trim().length === 0}>
            Create trip
          </button>
        </div>
      </form>

      <form className="trip-gate-form" onSubmit={onJoinTrip}>
        <label className="field-label" htmlFor="join-trip-id">
          Join with shared trip ID
        </label>
        <div className="row">
          <input
            id="join-trip-id"
            value={tripIdDraft}
            onChange={(event) => onTripIdDraftChange(event.target.value)}
            placeholder="Paste trip ID"
          />
          <button type="submit" style={{width: '100px'}} className="button subtle" disabled={disabled || tripIdDraft.trim().length === 0}>
            Join trip
          </button>
        </div>
      </form>
    </section>
  )
}

export const TripGate = memo(TripGateComponent)
