import type { FormEvent } from 'react'
import { memo } from 'react'
import "./TripGate.css"

type TripGateProps = {
  connected: boolean
  busy: boolean
  tripNameDraft: string
  accessIdDraft: string
  onTripNameDraftChange: (value: string) => void
  onAccessIdDraftChange: (value: string) => void
  onCreateTrip: (event: FormEvent<HTMLFormElement>) => void
  onJoinTrip: (event: FormEvent<HTMLFormElement>) => void
}

const TripGateComponent = ({
  connected,
  busy,
  tripNameDraft,
  accessIdDraft,
  onTripNameDraftChange,
  onAccessIdDraftChange,
  onCreateTrip,
  onJoinTrip,
}: TripGateProps) => {
  const disabled = busy || !connected

  return (
    <section className="trip-gate">
      <p className="trip-gate-intro">Create a new trip or join an existing one</p>

      <form className="trip-gate-form" onSubmit={onCreateTrip}>
        <label className="field-label" htmlFor="new-trip-name">
          Create trip
        </label>
        <div className="row trip-gate-row">
          <input
            id="new-trip-name"
            value={tripNameDraft}
            onChange={(event) => onTripNameDraftChange(event.target.value)}
            placeholder="e.g. Summer in Lisbon"
          />
          <button type="submit" className="button primary trip-gate-button" disabled={disabled || tripNameDraft.trim().length === 0}>
            Create
          </button>
        </div>
        <p className="gate-note">Creating a trip will generate a new Owner ID and Guest ID</p>
      </form>

      <form className="trip-gate-form" onSubmit={onJoinTrip}>
        <label className="field-label" htmlFor="join-access-id">
          Join trip with Owner or Guest ID:
        </label>
        <div className="row trip-gate-row">
          <input
            id="join-access-id"
            value={accessIdDraft}
            onChange={(event) => onAccessIdDraftChange(event.target.value)}
            placeholder="Enter ID (xxxx-xxxx)"
          />
          <button type="submit" className="button subtle trip-gate-button" disabled={disabled || accessIdDraft.trim().length === 0}>
            Join
          </button>
        </div>
        <p className="gate-note">Enter Owner ID: Gives ability to add and edit tasks</p>
        <p className="gate-note">Enter Guest ID: Read only access</p>
      </form>
    </section>
  )
}

export const TripGate = memo(TripGateComponent)
