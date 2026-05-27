import { createServer, type Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createAppServer,
  createRealtimeServer,
  formatListenUrls,
  resolveListenHost,
} from './index';
import { ROLES } from '../src/sim/roles';

describe('server listen config', () => {
  it('defaults to a LAN-capable host', () => {
    expect(resolveListenHost({ argv: [], env: {} })).toBe('0.0.0.0');
  });

  it('honors HOST and --lan listen settings', () => {
    expect(resolveListenHost({ argv: [], env: { HOST: '127.0.0.1' } })).toBe(
      '127.0.0.1',
    );
    expect(
      resolveListenHost({ argv: ['--lan'], env: { HOST: '127.0.0.1' } }),
    ).toBe('0.0.0.0');
  });

  it('prints localhost and LAN URLs for wildcard hosts', () => {
    expect(
      formatListenUrls({
        host: '0.0.0.0',
        networkAddresses: ['192.168.0.25'],
        port: 3001,
      }),
    ).toEqual([
      'http://127.0.0.1:3001',
      'http://192.168.0.25:3001',
    ]);
  });
});

describe('realtime server', () => {
  let httpServer: HttpServer | undefined;
  let clients: ClientSocket[] = [];

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }

    clients = [];

    if (httpServer) {
      await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
      httpServer = undefined;
    }
  });

  it('broadcasts role claims to every client in the room', async () => {
    httpServer = createServer();
    createRealtimeServer(httpServer);

    await new Promise<void>((resolve) => httpServer?.listen(0, resolve));

    const address = httpServer.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}`;
    const firstClient = createConnectedClient(url);
    const secondClient = createConnectedClient(url);
    clients = [firstClient, secondClient];

    await Promise.all([waitForConnect(firstClient), waitForConnect(secondClient)]);

    const secondStatePromise = waitForState(secondClient, (state) => {
      return state.claimedRoles.MT !== undefined;
    });

    firstClient.emit('room:join', { roomId: 'alpha' });
    secondClient.emit('room:join', { roomId: 'alpha' });
    firstClient.emit('role:claim', { role: 'MT', roomId: 'alpha' });

    const secondState = await secondStatePromise;

    expect(secondState.claimedRoles.MT).toBeDefined();
  });

  it('allows eight clients to claim the eight raid roles in one room', async () => {
    httpServer = createServer();
    createRealtimeServer(httpServer);

    await new Promise<void>((resolve) => httpServer?.listen(0, resolve));

    const address = httpServer.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}`;
    clients = ROLES.map(() => createConnectedClient(url));

    await Promise.all(clients.map(waitForConnect));

    const finalStatePromise = waitForState(clients[0], (state) =>
      ROLES.every((role) => state.claimedRoles[role] !== undefined),
    );

    for (const client of clients) {
      client.emit('room:join', { roomId: 'eight-player-test' });
    }

    ROLES.forEach((role, index) => {
      clients[index].emit('role:claim', {
        role,
        roomId: 'eight-player-test',
      });
    });

    const finalState = await finalStatePromise;

    expect(Object.keys(finalState.claimedRoles)).toHaveLength(8);
  });
});

describe('app server', () => {
  let httpServer: HttpServer | undefined;

  afterEach(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
      httpServer = undefined;
    }
  });

  it('serves a health check for deployment platforms', async () => {
    httpServer = createAppServer();

    await new Promise<void>((resolve) => httpServer?.listen(0, resolve));

    const address = httpServer.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
  });
});

function createConnectedClient(url: string) {
  return createClient(url, {
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  });
}

function waitForConnect(socket: ClientSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

function waitForState(
  socket: ClientSocket,
  predicate: (state: { claimedRoles: Record<string, string | undefined> }) => boolean,
) {
  return new Promise<{ claimedRoles: Record<string, string | undefined> }>(
    (resolve) => {
      socket.on('room:state', (state) => {
        if (predicate(state)) {
          resolve(state);
        }
      });
    },
  );
}
