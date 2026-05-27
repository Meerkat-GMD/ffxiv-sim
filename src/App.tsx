import { useEffect, useRef, useState } from 'react';
import {
  loadEncounterFromServer,
  saveEncounterToServer,
} from './client/encounterApi';
import {
  connectRealtime,
  type ConnectionStatus,
  type RealtimeClient,
  type RealtimeClientOptions,
} from './client/realtimeClient';
import { readFirebaseConfig } from './client/firebaseConfig';
import { connectFirebaseRealtime } from './client/firebaseRealtimeClient';
import { createInitialPlayers, type Player } from './sim/players';
import { claimRole, type Role } from './sim/roles';
import {
  advanceTimeline,
  createSampleTimeline,
  validateTimelineEvents,
  type TimelineEvent,
} from './sim/timeline';
import { type EncounterDocument } from './shared/encounter';
import {
  ArenaCanvas,
  type PlacedMarker,
  type TargetMarker,
  type TargetMarkerTarget,
} from './ui/ArenaCanvas';
import { EncounterControls } from './ui/EncounterControls';
import { MarkerTray, type MarkerAsset } from './ui/MarkerTray';
import { RolePanel } from './ui/RolePanel';
import { TimelineControls } from './ui/TimelineControls';
import { TimelineEditor } from './ui/TimelineEditor';

const TIMELINE_TICK_SECONDS = 0.05;
const TIMELINE_TICK_MS = TIMELINE_TICK_SECONDS * 1000;
const LOCAL_MOVE_SNAPSHOT_GRACE_MS = 250;
const REMOTE_MOVE_SEND_INTERVAL_MS = 45;

type AppProps = {
  realtimeConnector?: (options: RealtimeClientOptions) => RealtimeClient;
  realtimeUrl?: string;
};

type AppScreen = 'simulator' | 'timeline-editor';

type LocalMoveSnapshot = {
  movedAt: number;
  position: { x: number; y: number };
  role: Role;
};

type LocalMarkersSnapshot = {
  markers: PlacedMarker[];
  updatedAt: number;
};

type LocalTargetMarkersSnapshot = {
  targetMarkers: TargetMarker[];
  updatedAt: number;
};

function App({
  realtimeConnector = defaultRealtimeConnector,
  realtimeUrl,
}: AppProps = {}) {
  const [activeScreen, setActiveScreen] = useState<AppScreen>('simulator');
  const [controlledRole, setControlledRole] = useState<Role | undefined>(() =>
    readRoomIdFromLocation() ? undefined : 'MT',
  );
  const [players, setPlayers] = useState(() => createInitialPlayers());
  const [timeline, setTimeline] = useState(() => createSampleTimeline());
  const [timelineTime, setTimelineTime] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<MarkerAsset | undefined>();
  const [placedMarkers, setPlacedMarkers] = useState<PlacedMarker[]>([]);
  const [targetMarkers, setTargetMarkers] = useState<TargetMarker[]>([]);
  const [otherClaimedRoles, setOtherClaimedRoles] = useState<ReadonlySet<Role>>(
    () => new Set<Role>(),
  );
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');
  const [encounterStatus, setEncounterStatus] = useState<string | undefined>();
  const [roomId] = useState(() => readRoomIdFromLocation());
  const realtimeClientRef = useRef<RealtimeClient | undefined>(undefined);
  const timelineRef = useRef(timeline);
  const timelineTimeRef = useRef(timelineTime);
  const playersRef = useRef(players);
  const placedMarkersRef = useRef(placedMarkers);
  const targetMarkersRef = useRef(targetMarkers);
  const controlledRoleRef = useRef(controlledRole);
  const localMoveRef = useRef<LocalMoveSnapshot | undefined>(undefined);
  const localMarkersRef = useRef<LocalMarkersSnapshot | undefined>(undefined);
  const localTargetMarkersRef = useRef<LocalTargetMarkersSnapshot | undefined>(
    undefined,
  );
  const lastRemoteMoveSentAtRef = useRef(0);
  const claimedRoles = new Set<Role>(otherClaimedRoles);

  if (controlledRole) {
    claimedRoles.add(controlledRole);
  }

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    placedMarkersRef.current = placedMarkers;
  }, [placedMarkers]);

  useEffect(() => {
    targetMarkersRef.current = targetMarkers;
  }, [targetMarkers]);

  useEffect(() => {
    controlledRoleRef.current = controlledRole;
  }, [controlledRole]);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const client = realtimeConnector({
      onState(snapshot) {
        setPlayers(() => {
          const nextPlayers = mergeRealtimePlayers(
            snapshot.players,
            controlledRoleRef.current,
            localMoveRef.current,
            Date.now(),
          );

          playersRef.current = nextPlayers;

          return nextPlayers;
        });
        setPlacedMarkers(() => {
          if (
            localMarkersRef.current &&
            arePlacedMarkerListsEqual(
              snapshot.markers,
              localMarkersRef.current.markers,
            )
          ) {
            localMarkersRef.current = undefined;
          }

          const nextMarkers = mergeRealtimeMarkers(
            snapshot.markers,
            localMarkersRef.current,
            Date.now(),
          );

          placedMarkersRef.current = nextMarkers;

          return nextMarkers;
        });
        setTargetMarkers(() => {
          if (
            localTargetMarkersRef.current &&
            areTargetMarkerListsEqual(
              snapshot.targetMarkers,
              localTargetMarkersRef.current.targetMarkers,
            )
          ) {
            localTargetMarkersRef.current = undefined;
          }

          const nextTargetMarkers = mergeRealtimeTargetMarkers(
            snapshot.targetMarkers,
            localTargetMarkersRef.current,
            Date.now(),
          );

          targetMarkersRef.current = nextTargetMarkers;

          return nextTargetMarkers;
        });
        setTimeline(snapshot.timeline);
        timelineRef.current = snapshot.timeline;
        setOtherClaimedRoles(new Set(Object.keys(snapshot.claimedRoles) as Role[]));
      },
      onStatus: setConnectionStatus,
      roomId,
      url: realtimeUrl ?? window.location.origin,
    });

    realtimeClientRef.current = client;

    return () => {
      client.disconnect();
      realtimeClientRef.current = undefined;
    };
  }, [realtimeConnector, realtimeUrl, roomId]);

  useEffect(() => {
    if (!roomId || !controlledRole || !realtimeClientRef.current) {
      return;
    }

    realtimeClientRef.current.claimRole(controlledRole);
  }, [connectionStatus, controlledRole, roomId]);

  useEffect(() => {
    if (!isTimelinePlaying) {
      return;
    }

    const timerId = window.setInterval(() => {
      const currentTime = timelineTimeRef.current;
      const nextTime = currentTime + TIMELINE_TICK_SECONDS;
      const nextTimeline = advanceTimeline(
        timelineRef.current,
        playersRef.current,
        currentTime,
        nextTime,
        Math.random,
      );

      timelineRef.current = nextTimeline;
      timelineTimeRef.current = nextTime;
      setTimeline(nextTimeline);
      setTimelineTime(nextTime);
    }, TIMELINE_TICK_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isTimelinePlaying]);

  function handleSelectRole(role: Role) {
    if (roomId) {
      realtimeClientRef.current?.claimRole(role);
      setControlledRole(role);
      return;
    }

    const result = claimRole(otherClaimedRoles, role);

    if (!result.ok) {
      return;
    }

    setControlledRole(role);
  }

  function handleSelectMarker(marker: MarkerAsset) {
    if (marker.category === 'combat') {
      const hasTargetMarker = targetMarkersRef.current.some(
        (targetMarker) => targetMarker.asset.src === marker.src,
      );

      if (hasTargetMarker) {
        commitTargetMarkers(
          targetMarkersRef.current.filter(
            (targetMarker) => targetMarker.asset.src !== marker.src,
          ),
        );
        setSelectedMarker(undefined);
        return;
      }
    } else {
      const hasPlacedMarker = placedMarkersRef.current.some(
        (placedMarker) => placedMarker.asset.src === marker.src,
      );

      if (hasPlacedMarker) {
        commitPlacedMarkers(
          placedMarkersRef.current.filter(
            (placedMarker) => placedMarker.asset.src !== marker.src,
          ),
        );
        setSelectedMarker(undefined);
        return;
      }
    }

    setSelectedMarker((currentMarker) =>
      currentMarker?.src === marker.src ? undefined : marker,
    );
  }

  function handleResetTimeline() {
    const nextTimeline = createSampleTimeline();

    timelineRef.current = nextTimeline;
    timelineTimeRef.current = 0;
    setIsTimelinePlaying(false);
    setTimeline(nextTimeline);
    setTimelineTime(0);
  }

  function buildEncounterDocument(): EncounterDocument {
    return {
      arena: { radius: 180, type: 'circle' },
      markers: placedMarkers.map((marker) => ({
        asset: { ...marker.asset },
        id: marker.id,
        position: { ...marker.position },
      })),
      name: 'Practice Encounter',
      players: players.map((player) => ({
        ...player,
        position: { ...player.position },
      })),
      schemaVersion: 1,
      targetMarkers: targetMarkers.map((marker) => ({
        asset: { ...marker.asset },
        id: marker.id,
        target: { ...marker.target },
      })),
      timeline: {
        events: timeline.events,
      },
    };
  }

  function handleApplyEncounter(encounter: EncounterDocument) {
    const nextTimeline = {
      activeTelegraphs: [],
      events: encounter.timeline.events,
      resolvedEffects: [],
    };

    setPlayers(encounter.players);
    setPlacedMarkers(encounter.markers);
    setTargetMarkers(encounter.targetMarkers);
    setTimeline(nextTimeline);
    setTimelineTime(0);
    setIsTimelinePlaying(false);
    timelineRef.current = nextTimeline;
    timelineTimeRef.current = 0;
  }

  function handleTimelineEventsChange(events: TimelineEvent[]) {
    const nextTimeline = {
      activeTelegraphs: [],
      events: validateTimelineEvents(events),
      resolvedEffects: [],
    };

    setIsTimelinePlaying(false);
    setTimeline(nextTimeline);
    setTimelineTime(0);
    timelineRef.current = nextTimeline;
    timelineTimeRef.current = 0;
  }

  async function handleSaveEncounterToServer() {
    try {
      const saved = await saveEncounterToServer({
        encounter: buildEncounterDocument(),
        serverUrl: realtimeUrl ?? window.location.origin,
      });

      setEncounterStatus(`Saved: ${saved.id}`);
    } catch (error) {
      setEncounterStatus(
        `Save failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async function handleLoadEncounterFromServer(encounterId: string) {
    try {
      const encounter = await loadEncounterFromServer({
        encounterId,
        serverUrl: realtimeUrl ?? window.location.origin,
      });

      handleApplyEncounter(encounter);
      setEncounterStatus(`Loaded: ${encounterId}`);
    } catch (error) {
      setEncounterStatus(
        `Load failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  function handlePlaceMarker(position: { x: number; y: number }) {
    if (!selectedMarker) {
      return;
    }

    commitPlacedMarkers(
      upsertPlacedMarker(placedMarkersRef.current, selectedMarker, position),
    );
    setSelectedMarker(undefined);
  }

  function handleMoveMarker(markerId: string, position: { x: number; y: number }) {
    commitPlacedMarkers(
      placedMarkersRef.current.map((marker) =>
        marker.id === markerId ? { ...marker, position } : marker,
      ),
    );
  }

  function handlePlaceTargetMarker(target: TargetMarkerTarget) {
    if (!selectedMarker || selectedMarker.category !== 'combat') {
      return;
    }

    commitTargetMarkers(
      upsertTargetMarker(targetMarkersRef.current, selectedMarker, target),
    );
    setSelectedMarker(undefined);
  }

  function commitPlacedMarkers(markers: PlacedMarker[]) {
    const nextMarkers = clonePlacedMarkers(markers);

    placedMarkersRef.current = nextMarkers;
    localMarkersRef.current = {
      markers: nextMarkers,
      updatedAt: Date.now(),
    };
    setPlacedMarkers(nextMarkers);
    realtimeClientRef.current?.setMarkers(nextMarkers);
  }

  function commitTargetMarkers(markers: TargetMarker[]) {
    const nextMarkers = cloneTargetMarkers(markers);

    targetMarkersRef.current = nextMarkers;
    localTargetMarkersRef.current = {
      targetMarkers: nextMarkers,
      updatedAt: Date.now(),
    };
    setTargetMarkers(nextMarkers);
    realtimeClientRef.current?.setTargetMarkers(nextMarkers);
  }

  function handleMoveControlledRole(role: Role, position: { x: number; y: number }) {
    const now = Date.now();

    localMoveRef.current = {
      movedAt: now,
      position,
      role,
    };

    if (now - lastRemoteMoveSentAtRef.current < REMOTE_MOVE_SEND_INTERVAL_MS) {
      return;
    }

    lastRemoteMoveSentAtRef.current = now;
    realtimeClientRef.current?.moveRole(role, position);
  }

  return (
    <main className="sim-shell" aria-label="FFXIV simulator shell">
      <header className="sim-header">
        <div>
          <p className="eyebrow">Standalone encounter workspace</p>
          <h1>FFXIV Sim</h1>
          {roomId ? (
            <p className="connection-status">
              Room {roomId} | {connectionStatus}
            </p>
          ) : null}
        </div>
        <nav className="screen-tabs" aria-label="Screen navigation">
          <button
            aria-label="Open Simulator screen"
            aria-pressed={activeScreen === 'simulator'}
            className="screen-tab"
            onClick={() => setActiveScreen('simulator')}
            type="button"
          >
            Simulator
          </button>
          <button
            aria-label="Open Timeline Editor screen"
            aria-pressed={activeScreen === 'timeline-editor'}
            className="screen-tab"
            onClick={() => setActiveScreen('timeline-editor')}
            type="button"
          >
            Timeline Editor
          </button>
        </nav>
      </header>

      {activeScreen === 'simulator' ? (
        <section className="sim-layout">
          <RolePanel
            claimedRoles={claimedRoles}
            currentRole={controlledRole}
            onSelectRole={handleSelectRole}
          />

          <ArenaCanvas
            controlledRole={controlledRole}
            activeTelegraphs={timeline.activeTelegraphs}
            onMoveControlledRole={roomId ? handleMoveControlledRole : undefined}
            onMoveMarker={handleMoveMarker}
            onPlaceMarker={handlePlaceMarker}
            onPlaceTargetMarker={handlePlaceTargetMarker}
            placedMarkers={placedMarkers}
            players={players}
            resolvedEffects={timeline.resolvedEffects}
            selectedMarker={selectedMarker}
            setPlayers={setPlayers}
            targetMarkers={targetMarkers}
            timelineTime={timelineTime}
          />

          <div className="right-panel-stack">
            <EncounterControls
              encounter={buildEncounterDocument()}
              onApplyEncounter={handleApplyEncounter}
              onLoadFromServer={handleLoadEncounterFromServer}
              onSaveToServer={handleSaveEncounterToServer}
              statusMessage={encounterStatus}
            />
            <TimelineControls
              currentTime={timelineTime}
              events={timeline.events}
              isPlaying={isTimelinePlaying}
              onPause={() => setIsTimelinePlaying(false)}
              onPlay={() => setIsTimelinePlaying(true)}
              onReset={handleResetTimeline}
              resolvedEffects={timeline.resolvedEffects}
            />
            <MarkerTray
              onSelectMarker={handleSelectMarker}
              selectedMarker={selectedMarker}
            />
          </div>
        </section>
      ) : (
        <section className="editor-layout" aria-label="Timeline editor screen">
          <div className="editor-primary">
            <TimelineEditor
              events={timeline.events}
              onChange={handleTimelineEventsChange}
            />
          </div>
          <div className="editor-side">
            <EncounterControls
              encounter={buildEncounterDocument()}
              onApplyEncounter={handleApplyEncounter}
              onLoadFromServer={handleLoadEncounterFromServer}
              onSaveToServer={handleSaveEncounterToServer}
              statusMessage={encounterStatus}
            />
            <TimelineControls
              currentTime={timelineTime}
              events={timeline.events}
              isPlaying={isTimelinePlaying}
              onPause={() => setIsTimelinePlaying(false)}
              onPlay={() => setIsTimelinePlaying(true)}
              onReset={handleResetTimeline}
              resolvedEffects={timeline.resolvedEffects}
            />
          </div>
        </section>
      )}
    </main>
  );
}

function readRoomIdFromLocation(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const roomId = new URLSearchParams(window.location.search).get('room')?.trim();

  return roomId && roomId.length > 0 ? roomId : undefined;
}

export default App;

export function mergeRealtimePlayers(
  snapshotPlayers: Player[],
  controlledRole: Role | undefined,
  localMove: LocalMoveSnapshot | undefined,
  now: number,
): Player[] {
  if (
    !controlledRole ||
    !localMove ||
    localMove.role !== controlledRole ||
    now - localMove.movedAt > LOCAL_MOVE_SNAPSHOT_GRACE_MS
  ) {
    return snapshotPlayers;
  }

  return snapshotPlayers.map((player) =>
    player.role === controlledRole
      ? {
          ...player,
          connected: true,
          position: { ...localMove.position },
        }
      : player,
  );
}

export function mergeRealtimeMarkers(
  snapshotMarkers: PlacedMarker[],
  localMarkers: LocalMarkersSnapshot | undefined,
  now: number,
): PlacedMarker[] {
  void now;

  if (localMarkers) {
    return clonePlacedMarkers(localMarkers.markers);
  }

  return clonePlacedMarkers(snapshotMarkers);
}

export function mergeRealtimeTargetMarkers(
  snapshotTargetMarkers: TargetMarker[],
  localTargetMarkers: LocalTargetMarkersSnapshot | undefined,
  now: number,
): TargetMarker[] {
  void now;

  if (localTargetMarkers) {
    return cloneTargetMarkers(localTargetMarkers.targetMarkers);
  }

  return cloneTargetMarkers(snapshotTargetMarkers);
}

function upsertPlacedMarker(
  currentMarkers: PlacedMarker[],
  selectedMarker: MarkerAsset,
  position: { x: number; y: number },
): PlacedMarker[] {
  const existingMarker = currentMarkers.find(
    (marker) => marker.asset.src === selectedMarker.src,
  );

  if (existingMarker) {
    return currentMarkers.map((marker) =>
      marker.id === existingMarker.id ? { ...marker, position } : marker,
    );
  }

  return [
    ...currentMarkers,
    {
      asset: selectedMarker,
      id: selectedMarker.src,
      position,
    },
  ];
}

function clonePlacedMarkers(markers: PlacedMarker[]): PlacedMarker[] {
  return markers.map((marker) => ({
    asset: { ...marker.asset },
    id: marker.id,
    position: { ...marker.position },
  }));
}

function upsertTargetMarker(
  currentMarkers: TargetMarker[],
  selectedMarker: MarkerAsset,
  target: TargetMarkerTarget,
): TargetMarker[] {
  const existingMarker = currentMarkers.find(
    (marker) => marker.asset.src === selectedMarker.src,
  );

  if (existingMarker) {
    return currentMarkers.map((marker) =>
      marker.id === existingMarker.id ? { ...marker, target } : marker,
    );
  }

  return [
    ...currentMarkers,
    {
      asset: selectedMarker,
      id: selectedMarker.src,
      target,
    },
  ];
}

function cloneTargetMarkers(markers: TargetMarker[]): TargetMarker[] {
  return markers.map((marker) => ({
    asset: { ...marker.asset },
    id: marker.id,
    target: { ...marker.target },
  }));
}

function arePlacedMarkerListsEqual(
  firstMarkers: PlacedMarker[],
  secondMarkers: PlacedMarker[],
): boolean {
  if (firstMarkers.length !== secondMarkers.length) {
    return false;
  }

  return firstMarkers.every((firstMarker) => {
    const secondMarker = secondMarkers.find(
      (marker) => marker.id === firstMarker.id,
    );

    return (
      secondMarker !== undefined &&
      firstMarker.asset.src === secondMarker.asset.src &&
      firstMarker.position.x === secondMarker.position.x &&
      firstMarker.position.y === secondMarker.position.y
    );
  });
}

function areTargetMarkerListsEqual(
  firstMarkers: TargetMarker[],
  secondMarkers: TargetMarker[],
): boolean {
  if (firstMarkers.length !== secondMarkers.length) {
    return false;
  }

  return firstMarkers.every((firstMarker) => {
    const secondMarker = secondMarkers.find(
      (marker) => marker.id === firstMarker.id,
    );

    return (
      secondMarker !== undefined &&
      firstMarker.asset.src === secondMarker.asset.src &&
      areTargetMarkerTargetsEqual(firstMarker.target, secondMarker.target)
    );
  });
}

function areTargetMarkerTargetsEqual(
  firstTarget: TargetMarkerTarget,
  secondTarget: TargetMarkerTarget,
): boolean {
  if (firstTarget.type !== secondTarget.type) {
    return false;
  }

  if (firstTarget.type === 'enemy') {
    return true;
  }

  return secondTarget.type === 'player' && firstTarget.role === secondTarget.role;
}

function defaultRealtimeConnector(options: RealtimeClientOptions): RealtimeClient {
  if (readFirebaseConfig()) {
    return connectFirebaseRealtime(options);
  }

  return connectRealtime(options);
}
