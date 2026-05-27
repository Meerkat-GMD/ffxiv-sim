import { describe, expect, it } from 'vitest';
import { createRoomStore } from './roomStore';

describe('room store', () => {
  it('prevents two sockets from claiming the same role', () => {
    const store = createRoomStore();

    expect(store.claimRole('alpha', 'socket-a', 'MT').ok).toBe(true);
    expect(store.claimRole('alpha', 'socket-b', 'MT')).toEqual({
      ok: false,
      reason: 'role_taken',
    });
  });

  it('rejects movement from sockets that do not own the role', () => {
    const store = createRoomStore();

    store.claimRole('alpha', 'socket-a', 'MT');

    expect(
      store.moveRole('alpha', 'socket-b', 'MT', { x: 12, y: 0 }),
    ).toEqual({ ok: false, reason: 'not_role_owner' });
  });

  it('returns room snapshots with claimed roles and player positions', () => {
    const store = createRoomStore();

    store.claimRole('alpha', 'socket-a', 'D1');
    store.moveRole('alpha', 'socket-a', 'D1', { x: 24, y: -36 });

    const snapshot = store.snapshot('alpha');

    expect(snapshot.claimedRoles).toEqual({ D1: 'socket-a' });
    expect(snapshot.players.find((player) => player.role === 'D1')?.position).toEqual({
      x: 24,
      y: -36,
    });
  });

  it('stores edited room timeline events in snapshots', () => {
    const store = createRoomStore();

    store.setTimeline('alpha', {
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

    expect(store.snapshot('alpha').timeline.events).toEqual([
      expect.objectContaining({ id: 'sleep-dps', type: 'apply_status' }),
    ]);
  });
});
