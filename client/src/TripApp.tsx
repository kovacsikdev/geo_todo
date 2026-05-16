import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import { TripGate } from "./components/TripGate";
import { TripHeader } from "./components/TripHeader";
import { TripBoard } from "./components/TripBoard";
import { ToastStack } from "./components/ToastStack";
import {
  clearActiveAccessId,
  loadActiveAccessId,
  saveActiveAccessId,
} from "./lib/activeTripStorage";
import { useTripEvents } from "./hooks/useTripEvents";
import { useToastQueue } from "./hooks/useToastQueue";
import { useMenuLocationScroll } from "./hooks/useMenuLocationScroll";
import { useTripActions } from "./hooks/useTripActions";
import type { LocationTodo, SharedState, TripRole } from "./types";
import "./TripApp.css";

const TripMap = lazy(() =>
  import("./components/TripMap.tsx").then((module) => ({
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

const resolveServerUrl = (): string => {
  const configured = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim() ?? "";
  const baseUrl = configured || "http://localhost:8080";
  return baseUrl.replace(/\/+$/, "");
};

const SERVER_URL = resolveServerUrl();
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "";

type FocusRequest = {
  longitude: number;
  latitude: number;
  nonce: number;
};

type DirectionsTarget = {
  locationId: string;
  name: string;
  longitude: number;
  latitude: number;
  travelMode: "driving" | "walking";
};

const isStandaloneMode = (): boolean => {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
};

const isIosSafari = (): boolean => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isWebKitSafari = /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent);
  return isIos && isWebKitSafari;
};

const TripApp = () => {
  const [initialSession] = useState(() => {
    const persistedAccessId = loadActiveAccessId();
    return {
      persistedAccessId,
      initialRole: "guest",
    } satisfies {
      persistedAccessId: string;
      initialRole: TripRole;
    };
  });

  const activeTripIdRef = useRef("");
  const activeAccessIdRef = useRef(initialSession.persistedAccessId);
  const [sharedState, setSharedState] = useState<SharedState>(EMPTY_STATE);
  const { toasts, showToast, dismissToast } = useToastQueue();
  const [createTripNameDraft, setCreateTripNameDraft] = useState("");
  const [tripNameDraft, setTripNameDraft] = useState("");
  const [accessIdDraft, setAccessIdDraft] = useState(
    initialSession.persistedAccessId,
  );
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(true);
  const [activeTripId, setActiveTripId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [guestId, setGuestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyState, setBusyState] = useState<"create" | "join" | "delete" | "rename" | null>(null);
  const [tripRole, setTripRole] = useState<TripRole>(initialSession.initialRole);
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(() => window.__geoTodoBeforeInstallPromptEvent ?? null);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileDrivingActive, setIsMobileDrivingActive] = useState(false);
  const [isTripGateOpen, setIsTripGateOpen] = useState(false);
  const [hasShownInitialTripGate, setHasShownInitialTripGate] = useState(false);
  const [pendingLocationScrollId, setPendingLocationScrollId] = useState<
    string | null
  >(null);
  const [directionsTarget, setDirectionsTarget] = useState<DirectionsTarget | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState<FocusRequest | null>(
    null,
  );

  useEffect(() => {
    activeTripIdRef.current = activeTripId;
  }, [activeTripId]);

  useEffect(() => {
    activeAccessIdRef.current = accessIdDraft;
  }, [accessIdDraft]);

  useEffect(() => {
    if (!activeTripId || !accessIdDraft || !autoJoinEnabled) {
      clearActiveAccessId();
      return;
    }

    if (activeTripId && accessIdDraft) {
      saveActiveAccessId(accessIdDraft);
    }
  }, [activeTripId, accessIdDraft, autoJoinEnabled]);

  useEffect(() => {
    if (!activeTripId || isTripGateOpen) {
      return;
    }

    setTripNameDraft(sharedState.trip.name);
  }, [activeTripId, isTripGateOpen, sharedState.trip.name]);

  useEffect(() => {
    if (activeTripId) {
      return;
    }

    setDirectionsTarget(null);
  }, [activeTripId]);

  useEffect(() => {
    if (!directionsTarget) {
      return;
    }

    const targetStillExists = sharedState.locations.some(
      (location) => location.id === directionsTarget.locationId,
    );
    if (!targetStillExists) {
      setDirectionsTarget(null);
    }
  }, [directionsTarget, sharedState.locations]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");

    const syncStandaloneState = () => {
      setIsStandalone(isStandaloneMode());
    };

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      window.__geoTodoBeforeInstallPromptEvent = event;
      setInstallPromptEvent(event);
      setInstallBannerDismissed(false);
    };

    const handleAppInstalled = () => {
      window.__geoTodoBeforeInstallPromptEvent = null;
      setInstallPromptEvent(null);
      setInstallBannerDismissed(true);
      syncStandaloneState();
      showToast("App installed. Open it from your home screen.", "success");
    };

    syncStandaloneState();
    setInstallPromptEvent(window.__geoTodoBeforeInstallPromptEvent ?? null);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncStandaloneState);
    } else {
      mediaQuery.addListener(syncStandaloneState);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);

      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", syncStandaloneState);
      } else {
        mediaQuery.removeListener(syncStandaloneState);
      }
    };
  }, [showToast]);

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
        clearActiveAccessId();
        setActiveTripId("");
        setOwnerId("");
        setGuestId("");
        setCreateTripNameDraft("");
        setTripNameDraft("");
        setAccessIdDraft("");
        setSharedState(EMPTY_STATE);
        setTripRole("guest");
      }

      showToast(message.message, "info");
    },
    [showToast],
  );

  const handleReconnectJoinError = useCallback(
    (error: Error) => {
      clearActiveAccessId();
      setAccessIdDraft("");
      setTripNameDraft("");
      setIsTripGateOpen(true);
      setHasShownInitialTripGate(true);
      showToast(error.message);
    },
    [showToast],
  );

  const handleReconnectJoinSuccess = useCallback(
    (joined: {
      tripId: string;
      role: "owner" | "guest";
      ownerId?: string;
      guestId?: string;
    }) => {
      setHasShownInitialTripGate(true);
      setIsTripGateOpen(false);
      setActiveTripId(joined.tripId);
      setTripRole(joined.role);

      if (joined.role === "owner") {
        setOwnerId(joined.ownerId ?? activeAccessIdRef.current);
        setGuestId(joined.guestId ?? "");
        return;
      }

      setOwnerId("");
      setGuestId("");
    },
    [],
  );

  const handleSocketError = useCallback(
    (message: string) => {
      showToast(message);
    },
    [showToast],
  );

  const { connected, joinTrip: joinTripViaSSE } = useTripEvents({
    serverUrl: SERVER_URL,
    activeAccessIdRef,
    onTripState: handleTripStateMessage,
    onTripDeleted: handleTripDeletedMessage,
    onReconnectJoinSuccess: handleReconnectJoinSuccess,
    onReconnectJoinError: handleReconnectJoinError,
    onSocketError: handleSocketError,
  });

  const { createTrip, joinTrip, leaveTrip, deleteTrip, sendAction } = useTripActions({
    serverUrl: SERVER_URL,
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
    emptyState: EMPTY_STATE,
  });

  useEffect(() => {
    if (activeTripId) {
      setIsTripGateOpen(false);
      return;
    }

    if (hasShownInitialTripGate || initialSession.persistedAccessId) {
      return;
    }

    setIsTripGateOpen(true);
    setHasShownInitialTripGate(true);
  }, [activeTripId, hasShownInitialTripGate, initialSession.persistedAccessId]);

  const handleFocusLocation = useCallback(
    (longitude: number, latitude: number): void => {
      setIsMenuOpen(false);
      setMapFocusRequest({ longitude, latitude, nonce: Date.now() });
    },
    [],
  );

  const handleMapCreateLocation = useCallback(
    async ({
      name,
      address,
      latitude,
      longitude,
    }: {
      name: string;
      address?: string;
      latitude: number;
      longitude: number;
    }) => {
      await sendAction({ type: "create_location", name, address, latitude, longitude });
    },
    [sendAction],
  );

  const handleMapLocationPinClick = useCallback((locationId: string) => {
    setPendingLocationScrollId(locationId);
    setIsMenuOpen(true);
  }, []);

  const handleStartDirections = useCallback((location: LocationTodo, travelMode: "driving" | "walking") => {
    setIsMenuOpen(false);
    setDirectionsTarget({
      locationId: location.id,
      name: location.name,
      longitude: location.longitude,
      latitude: location.latitude,
      travelMode,
    });
  }, []);

  const handleCancelDirections = useCallback(() => {
    setDirectionsTarget(null);
  }, []);

  const handleMapError = useCallback(
    (message: string) => {
      showToast(message);
    },
    [showToast],
  );

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleMapSearchFocus = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const onDeleteTrip = useCallback(() => {
    void deleteTrip();
  }, [deleteTrip]);

  const openTripGate = useCallback(() => {
    setIsTripGateOpen(true);
  }, []);

  const handleCreateTrip = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      const created = await createTrip(event);
      if (created) {
        setIsTripGateOpen(false);
      }
      return created;
    },
    [createTrip],
  );

  const handleJoinTrip = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      const joined = await joinTrip(event);
      if (joined) {
        setIsTripGateOpen(false);
      }
      return joined;
    },
    [joinTrip],
  );

  const handleRenameTrip = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = tripNameDraft.trim();
      if (!trimmedName || trimmedName === sharedState.trip.name) {
        return false;
      }

      setBusy(true);
      setBusyState("rename");
      try {
        const renamed = await sendAction({ type: "rename_trip", name: trimmedName });
        if (renamed) {
          showToast("Trip name updated.", "success");
        }
        return renamed;
      } finally {
        setBusy(false);
        setBusyState(null);
      }
    },
    [sendAction, sharedState.trip.name, showToast, tripNameDraft],
  );

  const dismissInstallBanner = useCallback(() => {
    setInstallBannerDismissed(true);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPromptEvent) {
      return;
    }

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    window.__geoTodoBeforeInstallPromptEvent = null;
    setInstallPromptEvent(null);

    if (choice.outcome === "accepted") {
      setInstallBannerDismissed(true);
      showToast("Install prompt accepted.", "success");
      return;
    }

    setInstallBannerDismissed(true);
    showToast("Install prompt dismissed.", "info");
  }, [installPromptEvent, showToast]);

  const updatedAt = useMemo(
    () => new Date(sharedState.updatedAt).toLocaleString(),
    [sharedState.updatedAt],
  );

  const hasTrip = activeTripId.length > 0;
  const showIosInstallBanner = !isStandalone && isIosSafari();
  const shouldShowInstallBanner =
    !isStandalone &&
    !installBannerDismissed &&
    (installPromptEvent !== null || showIosInstallBanner);

  return (
    <main className="app-shell">
      <Suspense
        fallback={
          <section className="map-stage" aria-label="Trip map">
            <div className="map-loading-overlay">Loading...</div>
          </section>
        }
      >
        <TripMap
          accessToken={MAPBOX_ACCESS_TOKEN}
          hasTrip={hasTrip}
          tripRole={tripRole}
          isSocketConnected={connected}
          isMenuOpen={isMenuOpen}
          directionsTarget={directionsTarget}
          locations={sharedState.locations}
          focusRequest={mapFocusRequest}
          onCreateLocation={handleMapCreateLocation}
          onLocationPinClick={handleMapLocationPinClick}
          onCancelDirections={handleCancelDirections}
          onMapError={handleMapError}
          onMobileDrivingStateChange={setIsMobileDrivingActive}
          onSearchFocus={handleMapSearchFocus}
        />
      </Suspense>

      <button
        type="button"
        className={`menu-toggle ${isMenuOpen ? "is-open" : ""} ${isMobileDrivingActive ? "is-hidden-for-driving" : ""}`}
        aria-label="Open todo menu"
        aria-expanded={isMenuOpen}
        aria-controls="todo-side-menu"
        onClick={openMenu}
        disabled={isMenuOpen || isMobileDrivingActive}
      >
        {"\u2630"}
      </button>

      {shouldShowInstallBanner ? (
        <section className="install-prompt" aria-label="Install app banner">
          <p className="eyebrow">Install the app</p>
          {installPromptEvent ? (
            <p>
              Install the app for easier access, faster launch, and a more seamless, integrated experience on your device.
            </p>
          ) : (
            <p>
              On iPhone, tap Share and then choose Add to Home Screen to install this app.
            </p>
          )}
          <div className="install-prompt-actions">
            {installPromptEvent ? (
              <button type="button" className="button primary" onClick={() => void promptInstall()}>
                Install app
              </button>
            ) : null}
            <button type="button" className="button subtle" onClick={dismissInstallBanner}>
              Not now
            </button>
          </div>
        </section>
      ) : null}

      {isTripGateOpen ? (
        <div className="trip-gate-dialog-backdrop" role="presentation">
          <section
            className="trip-gate-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-gate-title"
          >
            <div className="trip-gate-dialog-header">
              <div>
                <h2 id="trip-gate-title">Create or join a trip</h2>
              </div>
            </div>
            <TripGate
              connected={connected}
              busy={busy}
              busyState={busyState}
              tripNameDraft={createTripNameDraft}
              accessIdDraft={accessIdDraft}
              autoJoinEnabled={autoJoinEnabled}
              onTripNameDraftChange={setCreateTripNameDraft}
              onAccessIdDraftChange={setAccessIdDraft}
              onAutoJoinEnabledChange={setAutoJoinEnabled}
              onCreateTrip={handleCreateTrip}
              onJoinTrip={handleJoinTrip}
            />
          </section>
        </div>
      ) : null}

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
          busyState={busyState}
          tripNameDraft={tripNameDraft}
          trip={sharedState.trip}
          ownerId={ownerId}
          guestId={guestId}
          tripRole={tripRole}
          connected={connected}
          updatedAt={updatedAt}
          onTripNameDraftChange={setTripNameDraft}
          onRenameTrip={handleRenameTrip}
          onDeleteTrip={onDeleteTrip}
          onLeaveTrip={leaveTrip}
          onOpenTripGate={openTripGate}
        />

        <ToastStack toasts={toasts} onDismiss={dismissToast} />

        <TripBoard
          hasTrip={hasTrip}
          tripRole={tripRole}
          locations={sharedState.locations}
          onAction={sendAction}
          onFocusLocation={handleFocusLocation}
          onStartDirections={handleStartDirections}
        />
      </aside>
    </main>
  );
};

export default TripApp;