import { describe, expect, it, vi } from 'vitest';
import { connectRealtime, type SocketLike } from './realtimeClient';

describe('realtime client adapter', () => {
  it('joins the requested room when connected', () => {
    const socket = createSocket();

    connectRealtime({
      createSocket: () => socket,
      onState: vi.fn(),
      onStatus: vi.fn(),
      roomId: 'alpha',
      url: 'http://localhost:3001',
    });

    expect(socket.emit).toHaveBeenCalledWith('room:join', { roomId: 'alpha' });
  });

  it('emits role claims, player movement, and marker updates with the room id', () => {
    const socket = createSocket();
    const client = connectRealtime({
      createSocket: () => socket,
      onState: vi.fn(),
      onStatus: vi.fn(),
      roomId: 'alpha',
      url: 'http://localhost:3001',
    });

    client.claimRole('MT');
    client.moveRole('MT', { x: 12, y: -24 });
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

    expect(socket.emit).toHaveBeenCalledWith('role:claim', {
      role: 'MT',
      roomId: 'alpha',
    });
    expect(socket.emit).toHaveBeenCalledWith('player:move', {
      position: { x: 12, y: -24 },
      role: 'MT',
      roomId: 'alpha',
    });
    expect(socket.emit).toHaveBeenCalledWith('markers:set', {
      markers: [
        expect.objectContaining({
          id: '/assets/xivplan/marker/waymark_a.png',
        }),
      ],
      roomId: 'alpha',
    });
    expect(socket.emit).toHaveBeenCalledWith('targetMarkers:set', {
      roomId: 'alpha',
      targetMarkers: [
        expect.objectContaining({
          id: '/assets/xivplan/marker/attack1.png',
        }),
      ],
    });
  });
});

function createSocket(): SocketLike {
  return {
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
  };
}
