import { useCallback } from "react";
import type { FormEvent } from "react";
import { clearActiveAccessId } from "../lib/activeTripStorage";
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
  createTripNameDraft: string;
  accessIdDraft: string;
  autoJoinEnabled: boolean;
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
  setBusyState: (value: "create" | "join" | "delete" | "rename" | null) => void;
  setActiveTripId: (value: string) => void;
  setOwnerId: (value: string) => void;
  setGuestId: (value: string) => void;
  setCreateTripNameDraft: (value: string) => void;
  setTripNameDraft: (value: string) => void;
  setAccessIdDraft: (value: string) => void;
  setSharedState: (value: SharedState) => void;
  setTripRole: (value: TripRole) => void;
  showToast: (message: string, kind?: ToastKind) => void;
  emptyState: SharedState;
};

type JoinedTripResult = {
  tripId: string;
  role: "owner" | "guest";
  ownerId?: string;
  guestId?: string;
};

export function useTripActions({
  serverUrl,
  connected,
  createTripNameDraft,
  accessIdDraft,
  autoJoinEnabled,
  activeTripId,
  ownerId,
  sharedState,
  tripRole,
  joinTripViaSSE,
  setBusy,
  setBusyState,
  setActiveTripId,
  setOwnerId,
  setGuestId,
  setCreateTripNameDraft,
  setTripNameDraft,
  setAccessIdDraft,
  setSharedState,
  setTripRole,
  showToast,
  emptyState,
}: UseTripActionsOptions) {
  const applyJoinedTripState = useCallback(
    (joined: JoinedTripResult, accessId: string) => {
      setActiveTripId(joined.tripId);
      setTripRole(joined.role);
      setAccessIdDraft(accessId);

      if (joined.role === "owner") {
        setOwnerId(joined.ownerId ?? accessId);
        setGuestId(joined.guestId ?? "");
        return;
      }

      setOwnerId("");
      setGuestId("");
    },
    [
      setAccessIdDraft,
      setActiveTripId,
      setGuestId,
      setOwnerId,
      setTripRole,
    ],
  );

  const leaveTrip = useCallback(() => {
    clearActiveAccessId();
    setActiveTripId("");
    setOwnerId("");
    setGuestId("");
    setCreateTripNameDraft("");
    setTripNameDraft("");
    setAccessIdDraft("");
    setSharedState(emptyState);
    setTripRole("guest");
  }, [
    emptyState,
    setCreateTripNameDraft,
    setAccessIdDraft,
    setActiveTripId,
    setGuestId,
    setOwnerId,
    setSharedState,
    setTripNameDraft,
    setTripRole,
  ]);

  const createTrip = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = createTripNameDraft.trim();
      if (!trimmedName) {
        return false;
      }

      setBusy(true);
      setBusyState("create");
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

        setCreateTripNameDraft("");

        if (!autoJoinEnabled) {
          setTripNameDraft("");
          setAccessIdDraft(createdOwnerId);
          showToast(
            `Trip created. Owner ID: ${createdOwnerId}. Guest ID: ${createdGuestId}.`,
            "success",
          );
          return true;
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
        applyJoinedTripState(
          {
            ...joined,
            ownerId: createdOwnerId,
            guestId: createdGuestId,
          },
          createdOwnerId,
        );
        setTripNameDraft(trimmedName);
        showToast(
          `Trip created and joined as owner. Guest ID: ${createdGuestId}.`,
          "success",
        );
        return true;
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Unable to create trip.",
        );
        return false;
      } finally {
        setBusy(false);
        setBusyState(null);
      }
    },
    [
      applyJoinedTripState,
      autoJoinEnabled,
      createTripNameDraft,
      joinTripViaSSE,
      setAccessIdDraft,
      setBusy,
      setBusyState,
      setCreateTripNameDraft,
      setSharedState,
      setTripNameDraft,
      showToast,
      serverUrl,
    ],
  );

  const joinTrip = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!connected) {
        showToast("Reconnecting to collaboration server. Please wait.");
        return false;
      }

      const trimmedId = accessIdDraft.trim();
      if (!trimmedId) {
        return false;
      }

      setBusy(true);
      setBusyState("join");
      try {
        const joined = await joinTripViaSSE(trimmedId);
        applyJoinedTripState(joined, trimmedId);

        showToast("Joined trip successfully.", "success");
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Trip not found.");
        return false;
      } finally {
        setBusy(false);
        setBusyState(null);
      }
    },
    [
      applyJoinedTripState,
      connected,
      joinTripViaSSE,
      setBusy,
      setBusyState,
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
    setBusyState("delete");
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
      setBusyState(null);
    }
  }, [
    activeTripId,
    leaveTrip,
    ownerId,
    serverUrl,
    setBusy,
    setBusyState,
    showToast,
    tripRole,
  ]);

  const sendAction = useCallback(
    async (action: ClientAction) => {
      if (tripRole !== "owner") {
        showToast("Guests have read-only access.");
        return false;
      }

      if (!activeTripId) {
        showToast("Join a trip before sending updates.");
        return false;
      }

      const resolvedOwnerId = ownerId;
      if (!resolvedOwnerId) {
        showToast("Missing owner ID for update request.");
        return false;
      }

      try {
        const nextState = applyTripAction(sharedState, action);
        await ownerFetch(serverUrl, "updateTrip", {
          tripId: activeTripId,
          ownerId: resolvedOwnerId,
          data: JSON.stringify(nextState),
        });
        setSharedState(nextState);
        if (action.type === "rename_trip") {
          setTripNameDraft(nextState.trip.name);
        }
        return true;
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Unable to update trip.",
        );
        return false;
      }
    },
    [
      activeTripId,
      ownerId,
      serverUrl,
      setSharedState,
      setTripNameDraft,
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
