import { clampPointToCircle, type Point } from '../src/sim/geometry';
import { createInitialPlayers, type Player } from '../src/sim/players';
import { ROLES, type Role } from '../src/sim/roles';
import {
  createDefaultEncounter,
  type EncounterDocument,
  type EncounterMarkerDocument,
} from '../src/shared/encounter';
import { type RoomSnapshot } from '../src/shared/realtime';
import { type TimelineState } from '../src/sim/timeline';

const ARENA_RADIUS = 180;
const TOKEN_RADIUS = 12;

type ClaimRoleResult =
  | { ok: true; snapshot: RoomSnapshot }
  | { ok: false; reason: 'role_taken' };

type MoveRoleResult =
  | { ok: true; snapshot: RoomSnapshot }
  | { ok: false; reason: 'not_role_owner' | 'role_not_claimed' };

type RoomState = {
  claimedRoles: Partial<Record<Role, string>>;
  encounter: EncounterDocument;
  markers: EncounterMarkerDocument[];
  players: Player[];
  roomId: string;
  timeline: TimelineState;
};

export type RoomStore = ReturnType<typeof createRoomStore>;

export function createRoomStore() {
  const rooms = new Map<string, RoomState>();

  function getOrCreateRoom(roomId: string): RoomState {
    const existingRoom = rooms.get(roomId);

    if (existingRoom) {
      return existingRoom;
    }

    const encounter = createDefaultEncounter();
    const room: RoomState = {
      claimedRoles: {},
      encounter,
      markers: encounter.markers,
      players: createInitialPlayers().map((player) => ({
        ...player,
        connected: false,
      })),
      roomId,
      timeline: {
        activeTelegraphs: [],
        events: encounter.timeline.events,
        resolvedEffects: [],
      },
    };

    rooms.set(roomId, room);
    return room;
  }

  function claimRole(
    roomId: string,
    socketId: string,
    role: Role,
  ): ClaimRoleResult {
    const room = getOrCreateRoom(roomId);
    const currentOwner = room.claimedRoles[role];

    if (currentOwner && currentOwner !== socketId) {
      return { ok: false, reason: 'role_taken' };
    }

    room.claimedRoles[role] = socketId;
    room.players = room.players.map((player) =>
      player.role === role ? { ...player, connected: true } : player,
    );

    return { ok: true, snapshot: snapshot(roomId) };
  }

  function moveRole(
    roomId: string,
    socketId: string,
    role: Role,
    position: Point,
  ): MoveRoleResult {
    const room = getOrCreateRoom(roomId);
    const currentOwner = room.claimedRoles[role];

    if (!currentOwner) {
      return { ok: false, reason: 'role_not_claimed' };
    }

    if (currentOwner !== socketId) {
      return { ok: false, reason: 'not_role_owner' };
    }

    const clampedPosition = clampPointToCircle(
      position,
      { x: 0, y: 0 },
      ARENA_RADIUS,
      TOKEN_RADIUS,
    );

    room.players = room.players.map((player) =>
      player.role === role ? { ...player, position: clampedPosition } : player,
    );

    return { ok: true, snapshot: snapshot(roomId) };
  }

  function releaseSocket(socketId: string) {
    for (const room of rooms.values()) {
      const releasedRoles = ROLES.filter(
        (role) => room.claimedRoles[role] === socketId,
      );

      for (const role of releasedRoles) {
        delete room.claimedRoles[role];
      }

      if (releasedRoles.length > 0) {
        const releasedRoleSet = new Set(releasedRoles);
        room.players = room.players.map((player) =>
          releasedRoleSet.has(player.role)
            ? { ...player, connected: false }
            : player,
        );
      }
    }
  }

  function snapshot(roomId: string): RoomSnapshot {
    const room = getOrCreateRoom(roomId);

    return {
      claimedRoles: { ...room.claimedRoles },
      markers: structuredClone(room.markers),
      players: room.players.map((player) => ({
        ...player,
        position: { ...player.position },
      })),
      roomId: room.roomId,
      timeline: {
        activeTelegraphs: room.timeline.activeTelegraphs.map((telegraph) => ({
          ...telegraph,
          position: { ...telegraph.position },
        })),
        events: room.timeline.events.map((event) => structuredClone(event)),
        resolvedEffects: room.timeline.resolvedEffects.map((effect) => ({
          ...effect,
          affectedRoles: [...effect.affectedRoles],
          position: { ...effect.position },
        })),
      },
    };
  }

  return {
    claimRole,
    getOrCreateRoom,
    moveRole,
    releaseSocket,
    snapshot,
  };
}
