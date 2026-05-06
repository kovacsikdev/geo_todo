import { useCallback } from "react";
import type { FormEvent } from "react";
import { applyTripAction } from "../lib/applyTripAction";
import { createTripId } from "../lib/tripClientProtocol";
import {
  isOwnerTrip,
  removeOwnerTrip,
  saveOwnerTrip,
} from "../lib/organizerKeyStorage";
import type { ClientAction, SharedState, TripRole } from "../types";
import type { ToastKind } from "../components/ToastStack";

// Sends a mutation request as the trip owner (no SSE connectionId required).
async function ownerFetch(
  serverUrl: string,
  action: string,
  payload: unknown,
): Promise<unknown> {
  const res = await fetch(`${serverUrl}/api/trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const data = (await res.json()) as { ok: boolean; payload?: unknown; error?: string };
  if (!data.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data.payload;
}

type UseTripActionsOptions = {
  serverUrl: string;
  // SSE connection state — used only to guard the guest joinTrip action
  connected: boolean;
  tripNameDraft: string;
  tripIdDraft: string;
  activeTripId: string;
  sharedState: SharedState;
  tripRole: TripRole;
  joinTripViaSSE: (tripId: string) => Promise<void>;
  setBusy: (value: boolean) => void;
  setActiveTripId: (value: string) => void;
  setSharedState: (value: SharedState) => void;
  setTripRole: (value: TripRole) => void;
  setTripIdDraft: (value: string) => void;
  showToast: (message: string, kind?: ToastKind) => void;
  emptyState: SharedState;
};

export function useTripActions({
  serverUrl,
  connected,
  tripNameDraft,
  tripIdDraft,
  activeTripId,
  sharedState,
  tripRole,
  joinTripViaSSE,
  setBusy,
  setActiveTripId,
  setSharedState,
  setTripRole,
  setTripIdDraft,
  showToast,
  emptyState,
}: UseTripActionsOptions) {
  const leaveTrip = useCallback(() => {
    setActiveTripId("");
    setSharedState(emptyState);
    setTripRole("guest");
  }, [emptyState, setActiveTripId, setSharedState, setTripRole]);

  const createTrip = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = tripNameDraft.trim();
      if (!trimmedName) {
        return;
      }

      setBusy(true);
      try {
        const nextTripId = createTripId();
        const nextState: SharedState = {
          trip: {
            id: nextTripId,
            name: trimmedName,
          },
          locations: [],
          updatedAt: new Date().toISOString(),
        };

        await ownerFetch(serverUrl, "createTrip", {
          tripId: nextTripId,
          data: JSON.stringify(nextState),
        });

        saveOwnerTrip(nextTripId);
        setSharedState(nextState);
        setTripRole("owner");
        setActiveTripId(nextTripId);
        setTripIdDraft(nextTripId);
        showToast("Trip created. Share the ID with your guests!", "success");
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Unable to create trip.",
        );
      } finally {
        setBusy(false);
      }
    },
    [
      serverUrl,
      tripNameDraft,
      setBusy,
      setSharedState,
      setTripRole,
      setActiveTripId,
      setBusy,
      setTripIdDraft,
      setTripRole,
      showToast,
      tripNameDraft,
    ],
  );

  const joinTrip = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!connected) {
        showToast("Reconnecting to collaboration server. Please wait.");
        return;
      }

      const trimmedId = tripIdDraft.trim();
      if (!trimmedId) {
        return;
      }

      setBusy(true);
      try {
        await joinTripViaSSE(trimmedId);
        setTripRole(isOwnerTrip(trimmedId) ? "owner" : "guest");
        setActiveTripId(trimmedId);
        showToast("Joined trip successfully.", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Trip not found.");
      } finally {
        setBusy(false);
      }
    },
    [
      connected,
      joinTripViaSSE,
      setActiveTripId,
      setBusy,
      setTripRole,
      showToast,
      tripIdDraft,
    ],
  );

  const deleteTrip = useCallback(async () => {
    if (tripRole !== "owner" || !activeTripId) {
      return;
    }

    const shouldDelete = window.confirm(
      "Delete this trip for every connected guest?",
    );
    if (!shouldDelete) {
      return;
    }

    setBusy(true);
    try {
      await ownerFetch(serverUrl, "deleteTrip", { tripId: activeTripId });
      removeOwnerTrip(activeTripId);
      leaveTrip();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Unable to delete trip.",
      );
    } finally {
      setBusy(false);
    }
  }, [activeTripId, serverUrl, leaveTrip, setBusy, showToast, tripRole]);

  const sendAction = useCallback(
    async (action: ClientAction) => {
      if (tripRole !== "owner") {
        showToast("Guests have read-only access.");
        return;
      }

      if (!activeTripId) {
        showToast("Join a trip before sending updates.");
        return;
      }

      try {
        const nextState = applyTripAction(sharedState, action);
        await ownerFetch(serverUrl, "updateTrip", {
          tripId: activeTripId,
          data: JSON.stringify(nextState),
        });
        setSharedState(nextState);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Unable to update trip.",
        );
      }
    },
    [activeTripId, serverUrl, sharedState, showToast, tripRole, setSharedState],
  );

  return {
    createTrip,
    joinTrip,
    leaveTrip,
    deleteTrip,
    sendAction,
  };
}
