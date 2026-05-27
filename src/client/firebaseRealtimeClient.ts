import {
  child,
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  set,
  update,
  type Database,
} from 'firebase/database';
import { clampPointToCircle, type Point } from '../sim/geometry';
import { createInitialPlayers } from '../sim/players';
import { type Role } from '../sim/roles';
import { type TimelineState } from '../sim/timeline';
import {
  createDefaultEncounter,
  type EncounterMarkerDocument,
  type EncounterTargetMarkerDocument,
} from '../shared/encounter';
import { type RoomSnapshot } from '../shared/realtime';
import { getFirebaseDatabase } from './firebaseConfig';
import {
  type ConnectionStatus,
  type RealtimeClient,
  type RealtimeClientOptions,
} from './realtimeClient';

const ARENA_RADIUS = 180;
const TOKEN_RADIUS = 12;

export type FirebaseRoomValue = {
  claimedRoles?: Partial<Record<Role, string>>;
  markers?: EncounterMarkerDocument[] | Record<string, EncounterMarkerDocument>;
  players?: ReturnType<typeof createInitialPlayers> | Record<string, ReturnType<typeof createInitialPlayers>[number]>;
  roomId?: string;
  targetMarkers?:
    | EncounterTargetMarkerDocument[]
    | Record<string, EncounterTargetMarkerDocument>;
  timeline?: TimelineState;
};

export type FirebaseRealtimeApi = {
  claimRole: (roomId: string, role: Role, clientId: string) => void;
  ensureRoom: (roomId: string) => void;
  moveRole: (roomId: string, role: Role, position: Point, clientId: string) => void;
  releaseClient: (roomId: string, clientId: string) => void;
  setMarkers: (roomId: string, markers: EncounterMarkerDocument[]) => void;
  setTargetMarkers: (
    roomId: string,
    targetMarkers: EncounterTargetMarkerDocument[],
  ) => void;
  subscribeRoom: (
    roomId: string,
    onRoom: (room: FirebaseRoomValue | undefined) => void,
  ) => () => void;
};

export type FirebaseRealtimeClientOptions = Omit<
  RealtimeClientOptions,
  'createSocket'
> & {
  api?: FirebaseRealtimeApi;
  clientId?: string;
};

export function connectFirebaseRealtime({
  api = createFirebaseRealtimeApi(),
  clientId = createClientId(),
  onState,
  onStatus,
  roomId,
}: FirebaseRealtimeClientOptions): RealtimeClient {
  onStatus('connecting');
  api.ensureRoom(roomId);

  const unsubscribe = api.subscribeRoom(roomId, (room) => {
    onStatus('connected');
    onState(toRoomSnapshot(roomId, room));
  });

  return {
    claimRole(role) {
      api.claimRole(roomId, role, clientId);
    },
    disconnect() {
      unsubscribe();
      api.releaseClient(roomId, clientId);
      onStatus('disconnected');
    },
    moveRole(role, position) {
      api.moveRole(
        roomId,
        role,
        clampPointToCircle(position, { x: 0, y: 0 }, ARENA_RADIUS, TOKEN_RADIUS),
        clientId,
      );
    },
    setMarkers(markers) {
      api.setMarkers(roomId, markers);
    },
    setTargetMarkers(targetMarkers) {
      api.setTargetMarkers(roomId, targetMarkers);
    },
  };
}

export function createFirebaseRealtimeApi(
  database = getFirebaseDatabase(),
): FirebaseRealtimeApi {
  if (!database) {
    return createMissingFirebaseApi();
  }

  return createDatabaseFirebaseRealtimeApi(database);
}

function createDatabaseFirebaseRealtimeApi(database: Database): FirebaseRealtimeApi {
  return {
    async claimRole(roomId, role, clientId) {
      const roleRef = ref(database, `rooms/${roomId}/claimedRoles/${role}`);
      const result = await runTransaction(roleRef, (currentOwner) => {
        if (currentOwner && currentOwner !== clientId) {
          return;
        }

        return clientId;
      });

      if (!result.committed) {
        return;
      }

      await update(ref(database, `rooms/${roomId}/players/${role}`), {
        connected: true,
      });
      await onDisconnect(roleRef).remove();
      await onDisconnect(ref(database, `rooms/${roomId}/players/${role}/connected`)).set(
        false,
      );
    },
    async ensureRoom(roomId) {
      const roomRef = ref(database, `rooms/${roomId}`);
      const snapshot = await get(roomRef);

      if (snapshot.exists()) {
        return;
      }

      const encounter = createDefaultEncounter();
      await set(roomRef, {
        claimedRoles: {},
        markers: encounter.markers,
        players: playersByRole(createInitialPlayers().map((player) => ({
          ...player,
          connected: false,
        }))),
        roomId,
        targetMarkers: encounter.targetMarkers,
        timeline: {
          activeTelegraphs: [],
          events: encounter.timeline.events,
          resolvedEffects: [],
        },
      });
    },
    async moveRole(roomId, role, position, clientId) {
      const ownerSnapshot = await get(
        ref(database, `rooms/${roomId}/claimedRoles/${role}`),
      );

      if (ownerSnapshot.val() !== clientId) {
        return;
      }

      await update(ref(database, `rooms/${roomId}/players/${role}`), {
        position,
      });
    },
    async releaseClient(roomId, clientId) {
      const claimedRolesRef = ref(database, `rooms/${roomId}/claimedRoles`);
      const claimedRolesSnapshot = await get(claimedRolesRef);
      const claimedRoles = claimedRolesSnapshot.val() as
        | Partial<Record<Role, string>>
        | undefined;

      if (!claimedRoles) {
        return;
      }

      await Promise.all(
        Object.entries(claimedRoles)
          .filter(([, owner]) => owner === clientId)
          .map(async ([role]) => {
            await remove(child(claimedRolesRef, role));
            await update(ref(database, `rooms/${roomId}/players/${role}`), {
              connected: false,
            });
        }),
      );
    },
    async setMarkers(roomId, markers) {
      await set(ref(database, `rooms/${roomId}/markers`), markers);
    },
    async setTargetMarkers(roomId, targetMarkers) {
      await set(ref(database, `rooms/${roomId}/targetMarkers`), targetMarkers);
    },
    subscribeRoom(roomId, onRoom) {
      return onValue(ref(database, `rooms/${roomId}`), (snapshot) => {
        onRoom(snapshot.val() as FirebaseRoomValue | undefined);
      });
    },
  };
}

function createMissingFirebaseApi(): FirebaseRealtimeApi {
  return {
    claimRole: noop,
    ensureRoom: noop,
    moveRole: noop,
    releaseClient: noop,
    setMarkers: noop,
    setTargetMarkers: noop,
    subscribeRoom() {
      return noop;
    },
  };
}

function toRoomSnapshot(roomId: string, room: FirebaseRoomValue | undefined): RoomSnapshot {
  const encounter = createDefaultEncounter();

  return {
    claimedRoles: room?.claimedRoles ?? {},
    markers: normalizeList(room?.markers),
    players: normalizePlayers(room?.players),
    roomId: room?.roomId ?? roomId,
    targetMarkers: normalizeList(room?.targetMarkers),
    timeline: room?.timeline ?? {
      activeTelegraphs: [],
      events: encounter.timeline.events,
      resolvedEffects: [],
    },
  };
}

function normalizePlayers(players: FirebaseRoomValue['players']) {
  if (!players) {
    return createInitialPlayers().map((player) => ({ ...player, connected: false }));
  }

  if (Array.isArray(players)) {
    return players;
  }

  return createInitialPlayers().map((initialPlayer) => ({
    ...initialPlayer,
    ...players[initialPlayer.role],
    position: players[initialPlayer.role]?.position ?? initialPlayer.position,
  }));
}

function normalizeList<T>(value: T[] | Record<string, T> | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : Object.values(value);
}

function playersByRole(players: ReturnType<typeof createInitialPlayers>) {
  return Object.fromEntries(players.map((player) => [player.role, player]));
}

function createClientId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function noop() {}
