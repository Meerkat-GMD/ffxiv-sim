import { type Point } from '../sim/geometry';
import { type Player } from '../sim/players';
import { type Role } from '../sim/roles';
import {
  type EncounterMarkerDocument,
  type EncounterTargetMarkerDocument,
} from './encounter';
import { type TimelineState } from '../sim/timeline';

export type RoomJoinPayload = {
  roomId: string;
};

export type RoleClaimPayload = {
  role: Role;
  roomId: string;
};

export type PlayerMovePayload = {
  position: Point;
  role: Role;
  roomId: string;
};

export type MarkersSetPayload = {
  markers: EncounterMarkerDocument[];
  roomId: string;
};

export type TargetMarkersSetPayload = {
  roomId: string;
  targetMarkers: EncounterTargetMarkerDocument[];
};

export type RoomSnapshot = {
  claimedRoles: Partial<Record<Role, string>>;
  encounterId?: string;
  markers: EncounterMarkerDocument[];
  players: Player[];
  roomId: string;
  targetMarkers: EncounterTargetMarkerDocument[];
  timeline: TimelineState;
};

export type ServerToClientEvents = {
  'room:state': (snapshot: RoomSnapshot) => void;
};

export type ClientToServerEvents = {
  'markers:set': (payload: MarkersSetPayload) => void;
  'player:move': (payload: PlayerMovePayload) => void;
  'role:claim': (payload: RoleClaimPayload) => void;
  'room:join': (payload: RoomJoinPayload) => void;
  'targetMarkers:set': (payload: TargetMarkersSetPayload) => void;
};
