# Multiplayer Encounter Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first deployable foundation for external 8-player rooms, role locking, synchronized movement, and portable encounter save/load.

**Architecture:** Keep the existing React/Vite client, add a Node/Socket.IO server, and introduce shared TypeScript contracts for room state and encounter documents. The server owns multiplayer state; the client can still run in local/offline mode for tests and file import/export.

**Tech Stack:** React 18, Vite, TypeScript, Vitest, Node.js, Socket.IO, filesystem JSON storage.

---

## File Structure

- Create `src/shared/encounter.ts`: Encounter JSON schema, validators, and cloning helpers.
- Create `src/shared/realtime.ts`: Socket event names and payload types.
- Create `src/sim/encounter.test.ts`: Tests for encounter validation and round-trip cloning.
- Modify `src/sim/timeline.ts`: Keep timeline event definitions importable from shared encounter documents.
- Create `server/roomStore.ts`: In-memory room state, role ownership, movement authorization.
- Create `server/roomStore.test.ts`: Unit tests for room join, claim, release, and movement.
- Create `server/encounterStore.ts`: Filesystem-backed encounter persistence.
- Create `server/encounterStore.test.ts`: Save/load round-trip tests.
- Create `server/index.ts`: Express/HTTP + Socket.IO server, static production hosting, REST endpoints.
- Modify `package.json`: Add server dependencies and scripts.
- Modify `vite.config.ts`: Keep existing test behavior and include server tests if needed.
- Create `src/client/realtimeClient.ts`: Browser Socket.IO adapter.
- Create `src/client/realtimeClient.test.ts`: Adapter behavior tests with mocked socket object.
- Modify `src/App.tsx`: Wire connection state, room id, role claims, server movement, markers, and encounter import/export.
- Modify `src/ui/RolePanel.tsx`: Display remote-claimed roles from server state.
- Modify `src/ui/ArenaCanvas.tsx`: Emit controlled player movement through callback when connected.
- Create `src/ui/EncounterControls.tsx`: Import/export/save/load controls.
- Create `src/ui/EncounterControls.test.tsx`: UI tests for file export/import actions.
- Modify `src/ui/TimelineControls.tsx`: Accept editable event list later; for this foundation, display events from state rather than hardcoded sample.
- Modify `src/styles.css`: Add room/status/import/export layout styles.

## Task 1: Shared Encounter Document

**Files:**
- Create: `src/shared/encounter.ts`
- Test: `src/sim/encounter.test.ts`

- [ ] **Step 1: Write failing validator tests**

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultEncounter, parseEncounterDocument } from '../shared/encounter';

describe('encounter documents', () => {
  it('accepts a valid default encounter', () => {
    const encounter = createDefaultEncounter();
    expect(parseEncounterDocument(encounter)).toEqual(encounter);
  });

  it('rejects documents without schemaVersion 1', () => {
    expect(() => parseEncounterDocument({ schemaVersion: 999 })).toThrow(
      /schemaVersion/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src\sim\encounter.test.ts`

Expected: FAIL because `src/shared/encounter.ts` does not exist.

- [ ] **Step 3: Implement encounter types and validation**

Create:

```ts
import { createInitialPlayers, type Player } from '../sim/players';
import { validateTimelineEvents, type TimelineEvent } from '../sim/timeline';

export type ArenaDocument = {
  radius: number;
  type: 'circle';
};

export type EncounterMarkerDocument = {
  asset: {
    alt: string;
    label: string;
    src: string;
  };
  id: string;
  position: {
    x: number;
    y: number;
  };
};

export type EncounterDocument = {
  arena: ArenaDocument;
  markers: EncounterMarkerDocument[];
  name: string;
  players: Player[];
  schemaVersion: 1;
  timeline: {
    events: TimelineEvent[];
  };
};

export function createDefaultEncounter(): EncounterDocument {
  return {
    arena: { radius: 180, type: 'circle' },
    markers: [],
    name: 'Practice Encounter',
    players: createInitialPlayers(),
    schemaVersion: 1,
    timeline: { events: validateTimelineEvents([]) },
  };
}

export function parseEncounterDocument(value: unknown): EncounterDocument {
  if (!isRecord(value)) {
    throw new Error('Encounter must be an object');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('Encounter schemaVersion must be 1');
  }

  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new Error('Encounter name is required');
  }

  const arena = value.arena;
  if (!isRecord(arena) || arena.type !== 'circle' || typeof arena.radius !== 'number') {
    throw new Error('Encounter arena must be a circle');
  }

  if (!Array.isArray(value.players)) {
    throw new Error('Encounter players must be an array');
  }

  if (!Array.isArray(value.markers)) {
    throw new Error('Encounter markers must be an array');
  }

  const timeline = value.timeline;
  if (!isRecord(timeline) || !Array.isArray(timeline.events)) {
    throw new Error('Encounter timeline events must be an array');
  }

  return {
    arena: { radius: arena.radius, type: 'circle' },
    markers: structuredClone(value.markers),
    name: value.name,
    players: structuredClone(value.players),
    schemaVersion: 1,
    timeline: {
      events: validateTimelineEvents(timeline.events as TimelineEvent[]),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

- [ ] **Step 4: Run tests**

Run: `npm.cmd test -- src\sim\encounter.test.ts`

Expected: PASS.

## Task 2: Server Room Store

**Files:**
- Create: `server/roomStore.ts`
- Test: `server/roomStore.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add server test script support**

Install dependencies:

`npm.cmd install express socket.io socket.io-client`

`npm.cmd install -D @types/express tsx`

Update scripts:

```json
"server:dev": "tsx watch server/index.ts",
"server": "tsx server/index.ts"
```

- [ ] **Step 2: Write failing role ownership tests**

```ts
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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm.cmd test -- server\roomStore.test.ts`

Expected: FAIL because `roomStore` does not exist.

- [ ] **Step 4: Implement in-memory room store**

Implement:

- `getOrCreateRoom(roomId)`
- `claimRole(roomId, socketId, role)`
- `releaseSocket(socketId)`
- `moveRole(roomId, socketId, role, position)`
- `snapshot(roomId)`

Use `createInitialPlayers()` and clamp positions with existing geometry helpers.

- [ ] **Step 5: Run tests**

Run: `npm.cmd test -- server\roomStore.test.ts`

Expected: PASS.

## Task 3: Socket.IO Server

**Files:**
- Create: `server/index.ts`
- Create: `src/shared/realtime.ts`
- Test: `server/socket.test.ts`

- [ ] **Step 1: Write socket integration test**

Test that two clients join one room, the first claims MT, and the second receives a state where MT is unavailable.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- server\socket.test.ts`

Expected: FAIL because server bootstrap does not exist.

- [ ] **Step 3: Implement server bootstrap**

Server responsibilities:

- HTTP server on `PORT || 3001`.
- Socket.IO CORS open for development.
- `room:join` joins a Socket.IO room and emits `room:state`.
- `role:claim` uses `roomStore.claimRole`.
- `player:move` uses `roomStore.moveRole`.
- Broadcast `room:state` after every accepted mutation.
- Serve `dist/` when it exists.

- [ ] **Step 4: Run socket test**

Run: `npm.cmd test -- server\socket.test.ts`

Expected: PASS.

## Task 4: Client Realtime Adapter

**Files:**
- Create: `src/client/realtimeClient.ts`
- Test: `src/client/realtimeClient.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Test that `createRealtimeClient` emits `room:join`, `role:claim`, and `player:move` with expected payloads.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src\client\realtimeClient.test.ts`

Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement adapter**

Expose:

- `connectRealtime({ url, roomId, onState, onStatus })`
- `claimRole(role)`
- `moveRole(role, position)`
- `placeMarker(marker)`
- `moveMarker(markerId, position)`
- `disconnect()`

- [ ] **Step 4: Run adapter tests**

Run: `npm.cmd test -- src\client\realtimeClient.test.ts`

Expected: PASS.

## Task 5: Wire Role Claims And Movement To Server

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/ui/ArenaCanvas.tsx`
- Modify: `src/ui/RolePanel.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Add tests for:

- Remote claimed roles are disabled.
- Local movement calls realtime `player:move` when connected.
- Offline mode still moves locally.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src\App.test.tsx`

Expected: FAIL on new behavior.

- [ ] **Step 3: Implement connection state in `App.tsx`**

Use URL search params:

- `?room=ABCD` connects to that room.
- No room param keeps offline mode.

When connected, apply `room:state` snapshots to players, role claims, markers, and timeline.

- [ ] **Step 4: Update movement callback**

Change `ArenaCanvas` so movement can be reported through `onMoveControlledRole(role, position)` after clamping. In connected mode, send it to server. In offline mode, keep local state update.

- [ ] **Step 5: Run tests**

Run: `npm.cmd test -- src\App.test.tsx src\ui\ArenaCanvas.test.tsx`

Expected: PASS.

## Task 6: Encounter File Import And Export

**Files:**
- Create: `src/ui/EncounterControls.tsx`
- Test: `src/ui/EncounterControls.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Test:

- Export button creates a JSON Blob from current encounter.
- Import input parses valid JSON and calls `onApplyEncounter`.
- Invalid JSON shows an error and does not apply.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src\ui\EncounterControls.test.tsx`

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement `EncounterControls`**

Controls:

- Room id display/input.
- Export JSON button.
- Import file input.
- Save to server button.
- Load from server id input.

- [ ] **Step 4: Wire App encounter state**

Build encounter from current arena, players, markers, and timeline events. Applying an encounter updates all those states and resets playback.

- [ ] **Step 5: Run tests**

Run: `npm.cmd test -- src\ui\EncounterControls.test.tsx src\App.test.tsx`

Expected: PASS.

## Task 7: Server Encounter Storage

**Files:**
- Create: `server/encounterStore.ts`
- Test: `server/encounterStore.test.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Write failing storage tests**

Test save/load round trip using a temporary directory.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- server\encounterStore.test.ts`

Expected: FAIL because store does not exist.

- [ ] **Step 3: Implement filesystem storage**

Methods:

- `saveEncounter(document, id?)`
- `loadEncounter(id)`
- `listEncounters()`

Store files under `server/data/encounters`.

- [ ] **Step 4: Add REST endpoints**

Routes:

- `POST /api/encounters`
- `PUT /api/encounters/:id`
- `GET /api/encounters/:id`

- [ ] **Step 5: Run tests**

Run: `npm.cmd test -- server\encounterStore.test.ts server\socket.test.ts`

Expected: PASS.

## Task 8: Timeline Editor Foundation

**Files:**
- Create: `src/ui/TimelineEditor.tsx`
- Test: `src/ui/TimelineEditor.test.tsx`
- Modify: `src/sim/timeline.ts`
- Modify: `src/ui/TimelineControls.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing editor tests**

Test:

- Add circle AoE event.
- Edit event time.
- Delete event.
- Events render sorted by time.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src\ui\TimelineEditor.test.tsx`

Expected: FAIL because editor does not exist.

- [ ] **Step 3: Implement compact event editor**

First editable event type:

- `spawn_aoe`
- target role group
- radius
- time
- telegraph duration

- [ ] **Step 4: Replace hardcoded timeline display**

`TimelineControls` should render `timeline.events` instead of fixed sample list.

- [ ] **Step 5: Run tests**

Run: `npm.cmd test -- src\ui\TimelineEditor.test.tsx src\ui\TimelineControls.test.tsx src\App.test.tsx`

Expected: PASS.

## Task 9: First Mechanic Expansion

**Files:**
- Modify: `src/sim/timeline.ts`
- Test: `src/sim/timeline.test.ts`
- Modify: `src/ui/ArenaCanvas.tsx`
- Test: `src/ui/ArenaCanvas.test.tsx`

- [ ] **Step 1: Write failing timeline tests**

Add tests for:

- Donut AoE hit detection.
- Line AoE hit detection.
- Cone AoE hit detection.
- Stack target event creates a stack marker.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- src\sim\timeline.test.ts`

Expected: FAIL on unsupported mechanic types.

- [ ] **Step 3: Extend event union**

Add event types:

- `spawn_donut`
- `spawn_line`
- `spawn_cone`
- `spawn_stack`

- [ ] **Step 4: Add drawing support**

Draw active telegraphs with distinct visual treatments for circle, donut, line, cone, and stack.

- [ ] **Step 5: Run focused tests**

Run: `npm.cmd test -- src\sim\timeline.test.ts src\ui\ArenaCanvas.test.tsx`

Expected: PASS.

## Task 10: Production Verification

**Files:**
- Modify: `package.json`
- Modify: `README.md` if a README is created in this task.

- [ ] **Step 1: Run full tests**

Run: `npm.cmd test`

Expected: all tests PASS.

- [ ] **Step 2: Build client**

Run: `npm.cmd run build`

Expected: TypeScript and Vite build PASS.

- [ ] **Step 3: Start production server locally**

Run: `npm.cmd run server`

Expected: server listens on `http://127.0.0.1:3001`.

- [ ] **Step 4: Browser verification**

Open two tabs:

- `http://127.0.0.1:3001/?room=TEST`
- Claim MT in tab 1.
- Confirm MT disabled in tab 2.
- Claim D1 in tab 2.
- Move both roles.
- Confirm both tabs show synced positions.
- Export encounter JSON and re-import it.
- Save encounter to server and load it back by id.

- [ ] **Step 5: Document deployment**

Add concise notes for:

- `npm.cmd run build`
- `npm.cmd run server`
- Required `PORT`
- Public deployment target can be Render/Railway/Fly.io/VPS.
