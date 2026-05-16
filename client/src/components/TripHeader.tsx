import { memo, useCallback, useState } from "react";
import type { FormEvent } from "react";
import type { Trip, TripRole } from "../types";
import "./TripHeader.css";

type TripHeaderProps = {
  hasTrip: boolean;
  busy: boolean;
  busyState: "create" | "join" | "delete" | "rename" | null;
  tripNameDraft: string;
  trip: Trip;
  ownerId: string;
  guestId: string;
  tripRole: TripRole;
  connected: boolean;
  updatedAt: string;
  onTripNameDraftChange: (value: string) => void;
  onRenameTrip: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onDeleteTrip: () => void;
  onLeaveTrip: () => void;
  onOpenTripGate: () => void;
};

const TripHeaderComponent = ({
  hasTrip,
  busy,
  busyState,
  tripNameDraft,
  trip,
  ownerId,
  guestId,
  tripRole,
  connected,
  updatedAt,
  onTripNameDraftChange,
  onRenameTrip,
  onDeleteTrip,
  onLeaveTrip,
  onOpenTripGate,
}: TripHeaderProps) => {
  const [isEditingTripName, setIsEditingTripName] = useState(false);
  const disableRename = busy || tripNameDraft.trim().length === 0 || tripNameDraft.trim() === trip.name;

  const openTripNameEditor = useCallback(() => {
    onTripNameDraftChange(trip.name);
    setIsEditingTripName(true);
  }, [onTripNameDraftChange, trip.name]);

  const cancelTripNameEditor = useCallback(() => {
    onTripNameDraftChange(trip.name);
    setIsEditingTripName(false);
  }, [onTripNameDraftChange, trip.name]);

  const submitTripNameEditor = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      const renamed = await onRenameTrip(event);
      if (renamed) {
        setIsEditingTripName(false);
      }
    },
    [onRenameTrip],
  );

  return (
    <header className="hero-header">
      <h1>
        <span className="color-primary">Map</span>
        <span className="color-graphite">Itin</span>
      </h1>

      <div className="status-row">
        <span className={`status-pill ${connected ? "online" : "offline"}`}>
          {connected ? "Connected" : "Reconnecting"}
        </span>
        {hasTrip ? (
          <span className="status-pill neutral">Updated {updatedAt}</span>
        ) : null}
      </div>

      {!hasTrip ? (
        <div className="trip-empty-state">
          <p className="trip-empty-copy">You are not connected to a trip yet.</p>
          <button type="button" className="button primary" onClick={onOpenTripGate}>
            Create or join a trip
          </button>
        </div>
      ) : (
        <div className="trip-meta">
          <div className="trip-meta-row">
            <span className="trip-meta-label">Role: </span>
            <span className="trip-meta-value">
              {tripRole === "owner" ? "Owner" : "Guest"}
            </span>
          </div>

          <div className="trip-meta-row">
            <span className="trip-meta-label">Trip name: </span>
            {tripRole === "owner" ? (
              isEditingTripName ? (
                <form className="trip-name-form" onSubmit={(event) => void submitTripNameEditor(event)}>
                  <input
                    value={tripNameDraft}
                    onChange={(event) => onTripNameDraftChange(event.target.value)}
                    aria-label="Trip name"
                    autoFocus
                  />
                  <div className="trip-name-form-actions">
                    <button type="submit" className="button subtle" disabled={disableRename}>
                      {busyState === "rename" ? "Saving..." : "Save"}
                    </button>
                    <button type="button" className="button subtle" onClick={cancelTripNameEditor} disabled={busyState === "rename"}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="trip-name-display">
                  <span className="trip-meta-value">{trip.name}</span>
                  <button type="button" className="button subtle" onClick={openTripNameEditor} disabled={busy}>
                    Edit
                  </button>
                </div>
              )
            ) : (
              <span className="trip-meta-value">{trip.name}</span>
            )}
          </div>

          {tripRole === "owner" ? (
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
            {tripRole === "owner" ? (
              <button
                type="button"
                className="button danger"
                onClick={onDeleteTrip}
              >
                Delete
              </button>
            ) : null}
            <button
              type="button"
              className="button subtle"
              onClick={onLeaveTrip}
            >
              Leave
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export const TripHeader = memo(TripHeaderComponent);
