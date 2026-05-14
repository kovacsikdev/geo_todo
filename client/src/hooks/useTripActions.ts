import { useCallback } from "react";
import type { FormEvent } from "react";
import { applyTripAction } from "../lib/applyTripAction";
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
  accessIdDraft: string;
  activeTripId: string;
  ownerId: string;
  sharedState: SharedState;
  tripRole: TripRole;
  joinTripViaSSE: (accessId: string) => Promise<{
    tripId: string;
    role: "owner" | "guest";
    ownerId?: string;
    guestId?: string;
  }>;
  setBusy: (value: boolean) => void;
  setActiveTripId: (value: string) => void;
  setOwnerId: (value: string) => void;
  setGuestId: (value: string) => void;
  setAccessIdDraft: (value: string) => void;
  setSharedState: (value: SharedState) => void;
  setTripRole: (value: TripRole) => void;
  showToast: (message: string, kind?: ToastKind) => void;
  emptyState: SharedState;
};

export function useTripActions({
  serverUrl,
  connected,
  tripNameDraft,
  accessIdDraft,
  activeTripId,
  ownerId,
  sharedState,
  tripRole,
  joinTripViaSSE,
  setBusy,
  setActiveTripId,
  setOwnerId,
  setGuestId,
  setAccessIdDraft,
  setSharedState,
  setTripRole,
  showToast,
  emptyState,
}: UseTripActionsOptions) {
  const leaveTrip = useCallback(() => {
    setActiveTripId("");
    setOwnerId("");
    setGuestId("");
    setAccessIdDraft("");
    setSharedState(emptyState);
    setTripRole("guest");
  }, [
    emptyState,
    setAccessIdDraft,
    setActiveTripId,
    setGuestId,
    setOwnerId,
    setSharedState,
    setTripRole,
  ]);

  const createTrip = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = tripNameDraft.trim();
      if (!trimmedName) {
        return;
      }

      setBusy(true);
      try {
        // Server will generate the trip ID; use placeholder for now
        const nextState: SharedState = {
          trip: {
            id: 'pending',
            name: trimmedName,
          },
          locations: [],
          updatedAt: new Date().toISOString(),
        };

        const payload = (await ownerFetch(serverUrl, "createTrip", {
          data: JSON.stringify(nextState),
        })) as { tripId: string; ownerId?: string; guestId?: string };

        const createdTripId = payload.tripId;
        const createdOwnerId = payload.ownerId;
        const createdGuestId = payload.guestId;
        if (!createdTripId || !createdOwnerId || !createdGuestId) {
          throw new Error("Server did not return trip/owner/guest IDs.");
        }

        // Update the trip state with the actual server-generated trip ID
        const finalState: SharedState = {
          trip: {
            id: createdTripId,
            name: trimmedName,
          },
          locations: [],
          updatedAt: new Date().toISOString(),
        };

        // After create, explicitly join as owner so client state follows the same join flow.
        const joined = await joinTripViaSSE(createdOwnerId);

        setSharedState(finalState);
        setActiveTripId(joined.tripId);
        setTripRole(joined.role);
        setOwnerId(createdOwnerId);
        setGuestId(createdGuestId);
        setAccessIdDraft(createdOwnerId);
        showToast(
          `Trip created and joined as owner. Guest ID: ${createdGuestId}.`,
          "success",
        );
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Unable to create trip.",
        );
      } finally {
        setBusy(false);
      }
    },
    [
      joinTripViaSSE,
      setActiveTripId,
      setAccessIdDraft,
      setBusy,
      setGuestId,
      setOwnerId,
      setSharedState,
      setTripRole,
      showToast,
      serverUrl,
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

      const trimmedId = accessIdDraft.trim();
      if (!trimmedId) {
        return;
      }

      setBusy(true);
      try {
        const joined = await joinTripViaSSE(trimmedId);
        setActiveTripId(joined.tripId);
        setTripRole(joined.role);

        if (joined.role === "owner") {
          const resolvedOwnerId = joined.ownerId ?? trimmedId;
          setOwnerId(resolvedOwnerId);
          setGuestId(joined.guestId ?? "");
          setAccessIdDraft(trimmedId);
        } else {
          setOwnerId("");
          setGuestId("");
          setAccessIdDraft(trimmedId);
        }

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
      setAccessIdDraft,
      setBusy,
      setGuestId,
      setOwnerId,
      setTripRole,
      showToast,
      accessIdDraft,
    ],
  );

  const deleteTrip = useCallback(async () => {
    if (tripRole !== "owner" || !activeTripId) {
      return;
    }

    if (!ownerId) {
      showToast("Missing owner ID for delete request.");
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
      await ownerFetch(serverUrl, "deleteTrip", {
        tripId: activeTripId,
        ownerId,
      });
      leaveTrip();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Unable to delete trip.",
      );
    } finally {
      setBusy(false);
    }
  }, [
    activeTripId,
    leaveTrip,
    ownerId,
    serverUrl,
    setBusy,
    showToast,
    tripRole,
  ]);

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

      const resolvedOwnerId = ownerId;
      if (!resolvedOwnerId) {
        showToast("Missing owner ID for update request.");
        return;
      }

      try {
        const nextState = applyTripAction(sharedState, action);
        await ownerFetch(serverUrl, "updateTrip", {
          tripId: activeTripId,
          ownerId: resolvedOwnerId,
          data: JSON.stringify(nextState),
        });
        setSharedState(nextState);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Unable to update trip.",
        );
      }
    },
    [
      activeTripId,
      ownerId,
      serverUrl,
      setSharedState,
      sharedState,
      showToast,
      tripRole,
    ],
  );

  return {
    createTrip,
    joinTrip,
    leaveTrip,
    deleteTrip,
    sendAction,
  };
}
