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
  const [tripNameDraft, setTripNameDraft] = useState("");
  const [accessIdDraft, setAccessIdDraft] = useState(
    initialSession.persistedAccessId,
  );
  const [activeTripId, setActiveTripId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [guestId, setGuestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [tripRole, setTripRole] = useState<TripRole>(initialSession.initialRole);
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(() => window.__geoTodoBeforeInstallPromptEvent ?? null);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    if (activeTripId && accessIdDraft) {
      saveActiveAccessId(accessIdDraft);
    }
  }, [activeTripId, accessIdDraft]);

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
        setActiveTripId("");
        setOwnerId("");
        setGuestId("");
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
        fallback={<section className="map-stage" aria-label="Trip map" />}
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
          onSearchFocus={handleMapSearchFocus}
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

      {shouldShowInstallBanner ? (
        <section className="install-prompt" aria-label="Install app banner">
          <p className="eyebrow">Install the app</p>
          <h2>Keep Geo Todo on your home screen</h2>
          {installPromptEvent ? (
            <p>
              Install the app for full-screen access, faster launch, and a more native phone experience.
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
          accessIdDraft={accessIdDraft}
          trip={sharedState.trip}
          ownerId={ownerId}
          guestId={guestId}
          tripRole={tripRole}
          connected={connected}
          updatedAt={updatedAt}
          onTripNameDraftChange={setTripNameDraft}
          onAccessIdDraftChange={setAccessIdDraft}
          onCreateTrip={createTrip}
          onJoinTrip={joinTrip}
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
          onStartDirections={handleStartDirections}
        />
      </aside>
    </main>
  );
};

export default TripApp;