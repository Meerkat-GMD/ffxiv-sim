import { describe, expect, it, vi } from 'vitest';
import { createInitialPlayers } from '../sim/players';
import { createSampleTimeline } from '../sim/timeline';
import { connectFirebaseRealtime, type FirebaseRealtimeApi } from './firebaseRealtimeClient';

describe('firebase realtime client adapter', () => {
  it('subscribes to a room and maps database values to RoomSnapshot', () => {
    const api = createFirebaseApi();
    const onState = vi.fn();
    const onStatus = vi.fn();

    connectFirebaseRealtime({
      api,
      onState,
      onStatus,
      roomId: 'alpha',
      url: '',
    });

    expect(onStatus).toHaveBeenCalledWith('connecting');
    expect(api.ensureRoom).toHaveBeenCalledWith('alpha');
    expect(api.subscribeRoom).toHaveBeenCalledWith('alpha', expect.any(Function));

    api.emitRoom({
      claimedRoles: { MT: 'client-a' },
      markers: [],
      players: createInitialPlayers(),
      roomId: 'alpha',
      targetMarkers: [],
      timeline: createSampleTimeline(),
    });

    expect(onStatus).toHaveBeenLastCalledWith('connected');
    expect(onState).toHaveBeenCalledWith(
      expect.objectContaining({
        claimedRoles: { MT: 'client-a' },
        roomId: 'alpha',
      }),
    );
  });

  it('normalizes Firebase timeline object fields into arrays', () => {
    const api = createFirebaseApi();
    const onState = vi.fn();

    connectFirebaseRealtime({
      api,
      onState,
      onStatus: vi.fn(),
      roomId: 'alpha',
      url: '',
    });

    api.emitRoom({
      claimedRoles: {},
      markers: [],
      players: createInitialPlayers(),
      roomId: 'alpha',
      targetMarkers: [],
      timeline: {
        events: {
          0: {
            duration: 5,
            id: 'sleep-dps',
            status: 'sleep',
            target: { roleGroup: 'dps', selection: 'random' },
            time: 5,
            type: 'apply_status',
          },
        },
      } as never,
    });

    expect(onState).toHaveBeenCalledWith(
      expect.objectContaining({
        timeline: {
          activeTelegraphs: [],
          events: [expect.objectContaining({ id: 'sleep-dps' })],
          resolvedEffects: [],
        },
      }),
    );
  });

  it('claims roles, moves owned roles, and cleans up on disconnect', () => {
    const api = createFirebaseApi();
    const client = connectFirebaseRealtime({
      api,
      onState: vi.fn(),
      onStatus: vi.fn(),
      roomId: 'alpha',
      url: '',
    });

    client.claimRole('MT');
    client.moveRole('MT', { x: 999, y: 0 });
    client.setMarkers([
      {
        asset: {
          alt: 'Waymark A',
          category: 'waymark',
          label: 'A',
          src: '/assets/xivplan/marker/waymark_a.png',
        },
        id: '/assets/xivplan/marker/waymark_a.png',
        position: { x: 0, y: 0 },
      },
    ]);
    client.setTargetMarkers([
      {
        asset: {
          alt: 'Attack marker 1',
          category: 'combat',
          label: 'Atk',
          src: '/assets/xivplan/marker/attack1.png',
        },
        id: '/assets/xivplan/marker/attack1.png',
        target: { role: 'MT', type: 'player' },
      },
    ]);
    client.setTimeline({
      activeTelegraphs: [],
      events: [
        {
          duration: 5,
          id: 'sleep-dps',
          status: 'sleep',
          target: { roleGroup: 'dps', selection: 'random' },
          time: 5,
          type: 'apply_status',
        },
      ],
      resolvedEffects: [],
    });
    client.disconnect();

    expect(api.claimRole).toHaveBeenCalledWith('alpha', 'MT', expect.any(String));
    expect(api.moveRole).toHaveBeenCalledWith(
      'alpha',
      'MT',
      expect.objectContaining({ x: expect.any(Number), y: 0 }),
      expect.any(String),
    );
    expect(api.setMarkers).toHaveBeenCalledWith('alpha', [
      expect.objectContaining({
        id: '/assets/xivplan/marker/waymark_a.png',
      }),
    ]);
    expect(api.setTargetMarkers).toHaveBeenCalledWith('alpha', [
      expect.objectContaining({
        id: '/assets/xivplan/marker/attack1.png',
      }),
    ]);
    expect(api.setTimeline).toHaveBeenCalledWith(
      'alpha',
      expect.objectContaining({
        events: [expect.objectContaining({ type: 'apply_status' })],
      }),
    );
    expect(api.releaseClient).toHaveBeenCalledWith('alpha', expect.any(String));
    expect(api.unsubscribe).toHaveBeenCalled();
  });
});

function createFirebaseApi() {
  let roomHandler:
    | Parameters<FirebaseRealtimeApi['subscribeRoom']>[1]
    | undefined;

  const api: FirebaseRealtimeApi & {
    emitRoom: (room: Parameters<NonNullable<typeof roomHandler>>[0]) => void;
    unsubscribe: ReturnType<typeof vi.fn>;
  } = {
    claimRole: vi.fn(),
    ensureRoom: vi.fn(),
    moveRole: vi.fn(),
    releaseClient: vi.fn(),
    setMarkers: vi.fn(),
    setTargetMarkers: vi.fn(),
    setTimeline: vi.fn(),
    subscribeRoom: vi.fn((_roomId, handler) => {
      roomHandler = handler;
      return api.unsubscribe;
    }),
    unsubscribe: vi.fn(),
    emitRoom(room) {
      roomHandler?.(room);
    },
  };

  return api;
}
