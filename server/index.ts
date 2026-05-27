import express from 'express';
import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createEncounterStore } from './encounterStore';
import { createRoomStore } from './roomStore';
import { parseEncounterDocument } from '../src/shared/encounter';
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '../src/shared/realtime';

type InterServerEvents = Record<string, never>;
type SocketData = {
  roomId?: string;
};

type ListenHostOptions = {
  argv: string[];
  env: Partial<Record<string, string | undefined>>;
};

type ListenUrlOptions = {
  host: string;
  networkAddresses: string[];
  port: number;
};

export function createRealtimeServer(httpServer: HttpServer) {
  const roomStore = createRoomStore();
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: '*',
    },
  });

  io.on('connection', (socket) => {
    socket.on('room:join', ({ roomId }) => {
      socket.data.roomId = roomId;
      socket.join(roomId);
      socket.emit('room:state', roomStore.snapshot(roomId));
    });

    socket.on('role:claim', ({ role, roomId }) => {
      const result = roomStore.claimRole(roomId, socket.id, role);

      if (result.ok) {
        io.to(roomId).emit('room:state', result.snapshot);
        return;
      }

      socket.emit('room:state', roomStore.snapshot(roomId));
    });

    socket.on('player:move', ({ position, role, roomId }) => {
      const result = roomStore.moveRole(roomId, socket.id, role, position);

      if (result.ok) {
        io.to(roomId).emit('room:state', result.snapshot);
      }
    });

    socket.on('markers:set', ({ markers, roomId }) => {
      const result = roomStore.setMarkers(roomId, markers);

      if (result.ok) {
        io.to(roomId).emit('room:state', result.snapshot);
      }
    });

    socket.on('targetMarkers:set', ({ roomId, targetMarkers }) => {
      const result = roomStore.setTargetMarkers(roomId, targetMarkers);

      if (result.ok) {
        io.to(roomId).emit('room:state', result.snapshot);
      }
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;

      roomStore.releaseSocket(socket.id);

      if (roomId) {
        io.to(roomId).emit('room:state', roomStore.snapshot(roomId));
      }
    });
  });

  return {
    io,
    roomStore,
  };
}

export function createAppServer() {
  const app = express();
  const httpServer = createServer(app);
  const encounterStore = createEncounterStore();

  createRealtimeServer(httpServer);
  app.use(express.json({ limit: '2mb' }));

  app.get('/healthz', (_request, response) => {
    response.json({ ok: true });
  });

  app.get('/api/encounters', async (_request, response) => {
    response.json({ encounters: await encounterStore.listEncounters() });
  });

  app.get('/api/encounters/:id', async (request, response) => {
    try {
      response.json(await encounterStore.loadEncounter(request.params.id));
    } catch (error) {
      response.status(404).json({
        error: error instanceof Error ? error.message : 'Encounter not found',
      });
    }
  });

  app.post('/api/encounters', async (request, response) => {
    try {
      const saved = await encounterStore.saveEncounter(
        parseEncounterDocument(request.body),
      );
      response.status(201).json(saved);
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid encounter',
      });
    }
  });

  app.put('/api/encounters/:id', async (request, response) => {
    try {
      response.json(
        await encounterStore.saveEncounter(
          parseEncounterDocument(request.body),
          request.params.id,
        ),
      );
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid encounter',
      });
    }
  });

  const distPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');

  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((request, response, next) => {
      if (request.path.startsWith('/api/')) {
        next();
        return;
      }

      response.sendFile(resolve(distPath, 'index.html'));
    });
  }

  return httpServer;
}

export function resolveListenHost({ argv, env }: ListenHostOptions): string {
  if (argv.includes('--lan')) {
    return '0.0.0.0';
  }

  return env.HOST?.trim() || '0.0.0.0';
}

export function localNetworkAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter(
      (entry) =>
        entry.family === 'IPv4' && !entry.internal && Boolean(entry.address),
    )
    .map((entry) => entry.address);
}

export function formatListenUrls({
  host,
  networkAddresses,
  port,
}: ListenUrlOptions): string[] {
  if (host === '0.0.0.0' || host === '::') {
    return [
      `http://127.0.0.1:${port}`,
      ...networkAddresses.map((address) => `http://${address}:${port}`),
    ];
  }

  return [`http://${host}:${port}`];
}

function logListenUrls(host: string, port: number) {
  const urls = formatListenUrls({
    host,
    networkAddresses: localNetworkAddresses(),
    port,
  });

  console.log('FFXIV Sim server listening:');
  for (const url of urls) {
    console.log(`  ${url}`);
  }
  console.log('Share the same URL plus ?room=ROOMCODE for an 8-player room.');
}

if (process.env.NODE_ENV !== 'test' && process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3001);
  const host = resolveListenHost({
    argv: process.argv.slice(2),
    env: process.env,
  });
  const server = createAppServer();

  server.listen(port, host, () => {
    logListenUrls(host, port);
  });
}
