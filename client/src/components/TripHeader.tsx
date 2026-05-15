import { memo } from "react";
import type { FormEvent } from "react";
import { TripGate } from "./TripGate";
import type { Trip, TripRole } from "../types";
import "./TripHeader.css";

type TripHeaderProps = {
  hasTrip: boolean;
  busy: boolean;
  busyState: "create" | "join" | "delete" | null;
  tripNameDraft: string;
  accessIdDraft: string;
  trip: Trip;
  ownerId: string;
  guestId: string;
  tripRole: TripRole;
  connected: boolean;
  updatedAt: string;
  onTripNameDraftChange: (value: string) => void;
  onAccessIdDraftChange: (value: string) => void;
  onCreateTrip: (event: FormEvent<HTMLFormElement>) => void;
  onJoinTrip: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteTrip: () => void;
  onLeaveTrip: () => void;
};

const TripHeaderComponent = ({
  hasTrip,
  busy,
  busyState,
  tripNameDraft,
  accessIdDraft,
  trip,
  ownerId,
  guestId,
  tripRole,
  connected,
  updatedAt,
  onTripNameDraftChange,
  onAccessIdDraftChange,
  onCreateTrip,
  onJoinTrip,
  onDeleteTrip,
  onLeaveTrip,
}: TripHeaderProps) => {
  return (
    <header className="hero-header">
      <h1>Map Itinerary</h1>

      <div className="status-row">
        <span className={`status-pill ${connected ? 'online' : 'offline'}`}>
          {connected ? 'Connected' : 'Reconnecting'}
        </span>
        {hasTrip ? <span className="status-pill neutral">Updated {updatedAt}</span> : null}
      </div>

      {!hasTrip ? (
        <TripGate
          connected={connected}
          busy={busy}
          busyState={busyState}
          tripNameDraft={tripNameDraft}
          accessIdDraft={accessIdDraft}
          onTripNameDraftChange={onTripNameDraftChange}
          onAccessIdDraftChange={onAccessIdDraftChange}
          onCreateTrip={onCreateTrip}
          onJoinTrip={onJoinTrip}
        />
      ) : (
        <div className="trip-meta">
          <div className="trip-meta-row">
            <span className="trip-meta-label">Role: </span>
            <span className="trip-meta-value">
              {tripRole === 'owner' ? 'Owner' : 'Guest'}
            </span>
          </div>

          <div className="trip-meta-row">
            <span className="trip-meta-label">Trip name: </span>
            <span className="trip-meta-value">{trip.name}</span>
          </div>


          {tripRole === 'owner' ? (
            <>
              <div className="trip-meta-row">
                <span className="trip-meta-label">Owner ID: </span>
                <span className="trip-meta-value">{ownerId}</span>
              </div>
              <div className="trip-meta-row">
                <span className="trip-meta-label">Guest ID: </span>
                <span className="trip-meta-value">{guestId}</span>
              </div>
            </>
          ) : guestId ? (
            <div className="trip-meta-row">
              <span className="trip-meta-label">Guest ID</span>
              <span className="trip-meta-value">{guestId}</span>
            </div>
          ) : null}

          <div className="trip-meta-actions">
            {tripRole === 'owner' ? (
              <button type="button" className="button danger" onClick={onDeleteTrip}>
                Delete
              </button>
            ) : null}
            <button type="button" className="button subtle" onClick={onLeaveTrip}>
              Leave
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export const TripHeader = memo(TripHeaderComponent);
