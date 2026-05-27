import { io } from 'socket.io-client';
import { type Point } from '../sim/geometry';
import { type Role } from '../sim/roles';
import {
  type EncounterMarkerDocument,
  type EncounterTargetMarkerDocument,
} from '../shared/encounter';
import {
  type ClientToServerEvents,
  type RoomSnapshot,
  type ServerToClientEvents,
} from '../shared/realtime';

export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected';

export type SocketLike = {
  disconnect: () => void;
  emit: <EventName extends keyof ClientToServerEvents>(
    eventName: EventName,
    ...args: Parameters<ClientToServerEvents[EventName]>
  ) => void;
  on: <EventName extends keyof ServerToClientEvents | 'connect' | 'disconnect'>(
    eventName: EventName,
    handler: EventName extends keyof ServerToClientEvents
      ? ServerToClientEvents[EventName]
      : () => void,
  ) => void;
};

export type RealtimeClientOptions = {
  createSocket?: (url: string) => SocketLike;
  onState: (snapshot: RoomSnapshot) => void;
  onStatus: (status: ConnectionStatus) => void;
  roomId: string;
  url: string;
};

export type RealtimeClient = {
  claimRole: (role: Role) => void;
  disconnect: () => void;
  moveRole: (role: Role, position: Point) => void;
  setMarkers: (markers: EncounterMarkerDocument[]) => void;
  setTargetMarkers: (targetMarkers: EncounterTargetMarkerDocument[]) => void;
};

export function connectRealtime({
  createSocket = defaultCreateSocket,
  onState,
  onStatus,
  roomId,
  url,
}: RealtimeClientOptions): RealtimeClient {
  onStatus('connecting');

  const socket = createSocket(url);

  socket.on('connect', () => {
    onStatus('connected');
  });
  socket.on('disconnect', () => {
    onStatus('disconnected');
  });
  socket.on('room:state', onState);

  socket.emit('room:join', { roomId });

  return {
    claimRole(role) {
      socket.emit('role:claim', { role, roomId });
    },
    disconnect() {
      socket.disconnect();
    },
    moveRole(role, position) {
      socket.emit('player:move', { position, role, roomId });
    },
    setMarkers(markers) {
      socket.emit('markers:set', { markers, roomId });
    },
    setTargetMarkers(targetMarkers) {
      socket.emit('targetMarkers:set', { roomId, targetMarkers });
    },
  };
}

function defaultCreateSocket(url: string): SocketLike {
  return io(url, {
    transports: ['websocket'],
  }) as SocketLike;
}
