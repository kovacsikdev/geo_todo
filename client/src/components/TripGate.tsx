import type { FormEvent } from 'react'
import { memo } from 'react'
import "./TripGate.css"

type TripGateProps = {
  connected: boolean
  busy: boolean
  busyState: "create" | "join" | "delete" | "rename" | null
  tripNameDraft: string
  accessIdDraft: string
  autoJoinEnabled: boolean
  onTripNameDraftChange: (value: string) => void
  onAccessIdDraftChange: (value: string) => void
  onAutoJoinEnabledChange: (value: boolean) => void
  onCreateTrip: (event: FormEvent<HTMLFormElement>) => Promise<boolean>
  onJoinTrip: (event: FormEvent<HTMLFormElement>) => Promise<boolean>
}

const TripGateComponent = ({
  connected,
  busy,
  busyState,
  tripNameDraft,
  accessIdDraft,
  autoJoinEnabled,
  onTripNameDraftChange,
  onAccessIdDraftChange,
  onAutoJoinEnabledChange,
  onCreateTrip,
  onJoinTrip,
}: TripGateProps) => {
  const disabled = busy || !connected

  return (
    <section className="trip-gate">
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
            {busyState === 'create' ? 'Creating...' : 'Create'}
          </button>
        </div>
        <p className="gate-note">Creating a trip will generate a new Owner ID and Guest ID</p>
      </form>

      <form className="trip-gate-form" onSubmit={onJoinTrip}>
        <label className="field-label" htmlFor="join-access-id">
          Join existing trip with Owner or Guest ID:
        </label>
        <div className="row trip-gate-row">
          <input
            id="join-access-id"
            value={accessIdDraft}
            onChange={(event) => onAccessIdDraftChange(event.target.value)}
            placeholder="Enter ID (xxxx-xxxx)"
          />
          <button type="submit" className="button subtle trip-gate-button" disabled={disabled || accessIdDraft.trim().length === 0}>
            {busyState === 'join' ? 'Joining...' : 'Join'}
          </button>
        </div>
        <p className="gate-note">Enter Owner ID: Gives ability to add and edit tasks</p>
        <p className="gate-note">Enter Guest ID: Read only access</p>
      </form>

      <footer className="trip-gate-footer">
        <label className="trip-gate-checkbox" htmlFor="trip-gate-auto-join">
          <input
            id="trip-gate-auto-join"
            type="checkbox"
            checked={autoJoinEnabled}
            onChange={(event) => onAutoJoinEnabledChange(event.target.checked)}
          />
          <span>Auto-join this trip next time</span>
        </label>
      </footer>
    </section>
  )
}

export const TripGate = memo(TripGateComponent)
