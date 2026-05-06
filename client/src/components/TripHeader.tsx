import { memo } from "react";
import { TripGate } from "./TripGate";
import type { FormEvent } from "react";
import type { Trip, TripRole } from "../types";

type TripHeaderProps = {
  hasTrip: boolean;
  busy: boolean;
  tripNameDraft: string;
  tripIdDraft: string;
  trip: Trip;
  activeTripId: string;
  tripRole: TripRole;
  connected: boolean;
  updatedAt: string;
  onTripNameDraftChange: (value: string) => void;
  onTripIdDraftChange: (value: string) => void;
  onCreateTrip: (event: FormEvent<HTMLFormElement>) => void;
  onJoinTrip: (event: FormEvent<HTMLFormElement>) => void;
  onCopyTripId: () => void;
  onDeleteTrip: () => void;
  onLeaveTrip: () => void;
};

const TripHeaderComponent = ({
  hasTrip,
  busy,
  tripNameDraft,
  tripIdDraft,
  trip,
  activeTripId,
  tripRole,
  connected,
  updatedAt,
  onTripNameDraftChange,
  onTripIdDraftChange,
  onCreateTrip,
  onJoinTrip,
  onCopyTripId,
  onDeleteTrip,
  onLeaveTrip,
}: TripHeaderProps) => {
  return (
    <header className="hero-header">
      <h1>Trip Planner</h1>
      <p className="hero-copy">
        Owners create and update trips. Guests join by trip ID. Every trip
        update is seen by guests in real-time.
      </p>

      {!hasTrip ? (
        <TripGate
          connected={connected}
          busy={busy}
          tripNameDraft={tripNameDraft}
          tripIdDraft={tripIdDraft}
          onTripNameDraftChange={onTripNameDraftChange}
          onTripIdDraftChange={onTripIdDraftChange}
          onCreateTrip={onCreateTrip}
          onJoinTrip={onJoinTrip}
        />
      ) : null}

      {hasTrip ? (
        <div className="trip-meta">
          <div className="status-pill neutral">
            Role: {tripRole === "owner" ? "Owner" : "Guest"}
          </div>
          <div className="status-pill neutral">Trip name: {trip.name}</div>
          <div className="status-pill neutral">
            Share ID {activeTripId}{" "}
            <span>
              {" "}
              <button
                type="button"
                className="button subtle"
                onClick={onCopyTripId}
              >
                Copy ID
              </button>
            </span>
          </div>

          {tripRole === "owner" ? (
            <button
              type="button"
              className="button danger"
              onClick={onDeleteTrip}
            >
              Delete trip
            </button>
          ) : null}
          <button type="button" className="button subtle" onClick={onLeaveTrip}>
            Leave trip
          </button>
        </div>
      ) : null}

      <div className="status-row">
        <span className={`status-pill ${connected ? 'online' : 'offline'}`}>
          {connected ? 'Connected' : 'Reconnecting'}
        </span>
        <span className="status-pill neutral">Updated {updatedAt}</span>
      </div>
    </header>
  );
};

export const TripHeader = memo(TripHeaderComponent);
