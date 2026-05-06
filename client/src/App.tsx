import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TripHeader } from "./components/TripHeader";
import { TripBoard } from "./components/TripBoard";
import { ToastStack } from "./components/ToastStack";
import {
  clearActiveTripId,
  loadActiveTripId,
  saveActiveTripId,
} from "./lib/activeTripStorage";
import { useTripEvents } from "./hooks/useTripEvents";
import { useToastQueue } from "./hooks/useToastQueue";
import { useMenuLocationScroll } from "./hooks/useMenuLocationScroll";
import { isOwnerTrip } from "./lib/organizerKeyStorage";
import { copyToClipboard } from "./lib/copyToClipboard";
import { useTripActions } from "./hooks/useTripActions";
import type { SharedState, TripRole } from "./types";
import "./App.css";

const TripMap = lazy(() =>
  import("./components/TripMap").then((module) => ({
    default: module.TripMap,
  })),
);

const EMPTY_STATE: SharedState = {
  trip: {
    id: "",
    name: "",
  },
  locations: [],
  updatedAt: new Date().toISOString(),
};

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "";
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "";

type FocusRequest = {
  longitude: number;
  latitude: number;
  nonce: number;
};

const App = () => {
  const [initialSession] = useState(() => {
    const persistedTripId = loadActiveTripId();
    return {
      persistedTripId,
      initialRole:
        persistedTripId && isOwnerTrip(persistedTripId) ? "owner" : "guest",
    } satisfies { persistedTripId: string; initialRole: TripRole };
  });

  const activeTripIdRef = useRef("");
  const [sharedState, setSharedState] = useState<SharedState>(EMPTY_STATE);
  const { toasts, showToast, dismissToast } = useToastQueue();
  const [tripNameDraft, setTripNameDraft] = useState("");
  const [tripIdDraft, setTripIdDraft] = useState(initialSession.persistedTripId);
  const [activeTripId, setActiveTripId] = useState(
    initialSession.persistedTripId,
  );
  const [busy, setBusy] = useState(false);
  const [tripRole, setTripRole] = useState<TripRole>(initialSession.initialRole);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pendingLocationScrollId, setPendingLocationScrollId] = useState<
    string | null
  >(null);
  const [mapFocusRequest, setMapFocusRequest] = useState<FocusRequest | null>(
    null,
  );

  useEffect(() => {
    activeTripIdRef.current = activeTripId;
  }, [activeTripId]);

  useEffect(() => {
    if (activeTripId) {
      saveActiveTripId(activeTripId);
      return;
    }

    clearActiveTripId();
  }, [activeTripId]);

  const clearPendingLocationScrollId = useCallback(() => {
    setPendingLocationScrollId(null);
  }, []);

  useMenuLocationScroll({
    isMenuOpen,
    pendingLocationScrollId,
    clearPendingLocationScrollId,
  });

  const handleTripStateMessage = useCallback(
    (message: {
      type: "tripState";
      tripId: string;
      revision: number;
      payload: SharedState;
    }) => {
      setSharedState(message.payload);
      setTripIdDraft(message.tripId);
      setTripRole(isOwnerTrip(message.tripId) ? "owner" : "guest");
      setTripNameDraft(message.payload.trip.name);
      if (!activeTripIdRef.current) {
        setActiveTripId(message.tripId);
      }
    },
    [],
  );

  const handleTripDeletedMessage = useCallback(
    (message: { type: "tripDeleted"; tripId: string; message: string }) => {
      if (activeTripIdRef.current === message.tripId) {
        setActiveTripId("");
        setSharedState(EMPTY_STATE);
        setTripRole("guest");
      }

      showToast(message.message, "info");
    },
    [showToast],
  );

  const handleReconnectJoinError = useCallback(
    (error: Error) => {
      showToast(error.message);
    },
    [showToast],
  );

  const handleSocketError = useCallback(
    (message: string) => {
      showToast(message);
    },
    [showToast],
  );

  const { connected, joinTrip: joinTripViaSSE } = useTripEvents({
    serverUrl: SERVER_URL,
    activeTripIdRef,
    onTripState: handleTripStateMessage,
    onTripDeleted: handleTripDeletedMessage,
    onReconnectJoinError: handleReconnectJoinError,
    onSocketError: handleSocketError,
  });

  const { createTrip, joinTrip, leaveTrip, deleteTrip, sendAction } = useTripActions({
    serverUrl: SERVER_URL,
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
    emptyState: EMPTY_STATE,
  });

  const handleFocusLocation = useCallback(
    (longitude: number, latitude: number): void => {
      setIsMenuOpen(false);
      setMapFocusRequest({ longitude, latitude, nonce: Date.now() });
    },
    [],
  );

  const handleMapCreateLocation = useCallback(
    ({
      name,
      latitude,
      longitude,
    }: {
      name: string;
      latitude: number;
      longitude: number;
    }) => {
      sendAction({ type: "create_location", name, latitude, longitude });
    },
    [sendAction],
  );

  const handleMapLocationPinClick = useCallback((locationId: string) => {
    setPendingLocationScrollId(locationId);
    setIsMenuOpen(true);
  }, []);

  const handleMapError = useCallback(
    (message: string) => {
      showToast(message);
    },
    [showToast],
  );

  const copyTripId = useCallback(async () => {
    if (!activeTripId) {
      showToast("No active trip to copy yet.");
      return;
    }

    try {
      await copyToClipboard(activeTripId);

      showToast("Trip ID copied to clipboard.", "success");
    } catch {
      showToast("Unable to copy trip ID. Please copy it manually.");
    }
  }, [activeTripId, showToast]);

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const onCopyTripId = useCallback(() => {
    void copyTripId();
  }, [copyTripId]);

  const onDeleteTrip = useCallback(() => {
    void deleteTrip();
  }, [deleteTrip]);

  const updatedAt = useMemo(
    () => new Date(sharedState.updatedAt).toLocaleString(),
    [sharedState.updatedAt],
  );

  const hasTrip = activeTripId.length > 0;

  return (
    <main className="app-shell">
      <Suspense
        fallback={<section className="map-stage" aria-label="Trip map" />}
      >
        <TripMap
          accessToken={MAPBOX_ACCESS_TOKEN}
          hasTrip={hasTrip}
          tripRole={tripRole}
          isSocketConnected={connected}
          isMenuOpen={isMenuOpen}
          locations={sharedState.locations}
          focusRequest={mapFocusRequest}
          onCreateLocation={handleMapCreateLocation}
          onLocationPinClick={handleMapLocationPinClick}
          onMapError={handleMapError}
        />
      </Suspense>

      <button
        type="button"
        className={`menu-toggle ${isMenuOpen ? "is-open" : ""}`}
        aria-label="Open todo menu"
        aria-expanded={isMenuOpen}
        aria-controls="todo-side-menu"
        onClick={openMenu}
        disabled={isMenuOpen}
      >
        {"\u2630"}
      </button>

      <div
        className={`menu-overlay ${isMenuOpen ? "is-open" : ""}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      <aside
        id="todo-side-menu"
        className={`side-menu ${isMenuOpen ? "is-open" : ""}`}
      >
        <button
          type="button"
          className="side-menu-close"
          aria-label="Close todo menu"
          onClick={closeMenu}
          disabled={!isMenuOpen}
        >
          X
        </button>

        <TripHeader
          hasTrip={hasTrip}
          busy={busy}
          tripNameDraft={tripNameDraft}
          tripIdDraft={tripIdDraft}
          trip={sharedState.trip}
          activeTripId={activeTripId}
          tripRole={tripRole}
          connected={connected}
          updatedAt={updatedAt}
          onTripNameDraftChange={setTripNameDraft}
          onTripIdDraftChange={setTripIdDraft}
          onCreateTrip={createTrip}
          onJoinTrip={joinTrip}
          onCopyTripId={onCopyTripId}
          onDeleteTrip={onDeleteTrip}
          onLeaveTrip={leaveTrip}
        />

        <ToastStack toasts={toasts} onDismiss={dismissToast} />

        <TripBoard
          hasTrip={hasTrip}
          tripRole={tripRole}
          locations={sharedState.locations}
          onAction={sendAction}
          onFocusLocation={handleFocusLocation}
        />
      </aside>
    </main>
  );
};

export default App;
