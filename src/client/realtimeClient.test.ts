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

  it('emits role claims and player movement with the room id', () => {
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

    expect(socket.emit).toHaveBeenCalledWith('role:claim', {
      role: 'MT',
      roomId: 'alpha',
    });
    expect(socket.emit).toHaveBeenCalledWith('player:move', {
      position: { x: 12, y: -24 },
      role: 'MT',
      roomId: 'alpha',
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
