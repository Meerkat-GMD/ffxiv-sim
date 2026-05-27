# FFXIV Sim Multiplayer Encounter Design

## Goal

Build the current single-browser FFXIV simulator into an externally reachable
8-player raid practice tool. Eight users can join the same room, claim one of
MT, ST, H1, H2, D1, D2, D3, or D4, move only their own role, edit encounter
timelines, and save/load maps and timelines from both local JSON files and
server-hosted encounter records.

## Scope

The first production slice should prioritize a usable shared simulator over a
complete raid-authoring suite.

- External multiplayer rooms with role locking and synchronized player
  positions.
- Encounter JSON that contains arena geometry, floor markers, initial player
  positions, and timeline events.
- Timeline editor for common Savage/Ultimate-style mechanics.
- File export/import for encounter backup and sharing.
- Server save/load by encounter id so a room can reopen the same plan later.
- Deployment-ready Node server that serves the built client and realtime API.

Out of scope for the first slice:

- User accounts and permissions beyond host/editor controls.
- Persistent database service selection beyond a swappable storage interface.
- Pixel-perfect recreation of specific copyrighted raid encounters.
- Combat rotation, damage calculations, or job-specific skills.

## Architecture

Use a small full-stack TypeScript application:

- React/Vite client remains the main UI.
- Node server owns rooms, role claims, realtime state, and encounter storage.
- Socket.IO is the preferred realtime layer because it handles reconnects,
  rooms, browser compatibility, and external deployment more smoothly than raw
  WebSocket for this project.
- The server should serve `dist/` in production and expose REST endpoints for
  encounter persistence.

The server is authoritative for multiplayer state:

- A role can only be claimed if the room does not already have that role
  assigned to another active socket.
- Movement updates from a client are accepted only for that client's claimed
  role.
- The server broadcasts the canonical player list, marker list, timeline state,
  and playback state to all clients in the room.

## Room Model

Each room contains:

- `roomId`: short join code or URL segment.
- `hostSocketId`: first active socket in the room.
- `players`: eight role records with position, color, connection state, and
  optional socket owner.
- `placedMarkers`: floor markers copied from xivplan assets.
- `timeline`: event list plus runtime telegraphs/resolved effects.
- `arena`: geometry definition, initially a circle.
- `encounterId`: optional server-saved encounter record.
- `playback`: current time, playing/paused state, and server tick timestamp.

When a user disconnects, their role should become disconnected immediately but
can remain reserved briefly for reconnect. A first version can release the role
after a short timeout or when the host resets the room.

## Encounter JSON

An encounter file should be portable and stable:

```json
{
  "schemaVersion": 1,
  "name": "Practice Encounter",
  "arena": {
    "type": "circle",
    "radius": 180
  },
  "players": [
    { "role": "MT", "position": { "x": 0, "y": -120 } }
  ],
  "markers": [
    {
      "id": "/assets/xivplan/marker/waymark_a.png",
      "asset": {
        "src": "/assets/xivplan/marker/waymark_a.png",
        "alt": "Waymark A",
        "label": "A"
      },
      "position": { "x": 0, "y": 0 }
    }
  ],
  "timeline": {
    "events": []
  }
}
```

The client should validate imports before applying them. Unknown future fields
should be ignored, but invalid core fields should show a clear error.

## Timeline Event Model

Timeline events should be data-driven and editable. The first mechanic set:

- Circle AoE: random/role/role-group target, radius, telegraph duration.
- Donut AoE: inner radius, outer radius, target or fixed position.
- Line AoE: width, length, source, direction, target.
- Cone AoE: angle, radius, source, direction, target.
- Spread: assigns individual circles to matching targets.
- Stack/share: one or more targets with required group soak.
- Tankbuster: tank target with warning marker and hit resolution.
- Role-target marker: assigns visible icons or number markers.
- Knockback preview: source, distance, optional wall check.
- Proximity: center point with falloff visualization.

Common targeting rules:

- `role`: one exact role.
- `roleGroup`: tank, healer, or dps.
- `random`: random candidate from a rule.
- `all`: all players.
- `fixedPosition`: arena coordinates.
- `marker`: relative to a floor marker.

The runtime should keep event definitions separate from spawned mechanic
instances. This keeps save files deterministic while allowing random target
selection during playback.

## Timeline Editor UX

The editor should live in the right panel and replace the current static list.

Primary controls:

- Add event.
- Duplicate event.
- Delete event.
- Sort by time.
- Edit time, type, target rule, telegraph duration, dimensions, color, and label.
- Play, pause, reset.
- Import/export encounter.
- Save to server and load by encounter id.

The first version can use compact form rows rather than a drag-and-drop timeline.
That keeps the tool practical and avoids a large UI detour.

## Save And Load

File save/load:

- Export encounter JSON with a filename based on encounter name.
- Import `.json`, validate schema, then apply map, markers, players, and event
  definitions.
- Import should not require the server.

Server save/load:

- `POST /api/encounters` creates a saved encounter.
- `PUT /api/encounters/:id` updates an existing encounter.
- `GET /api/encounters/:id` loads a saved encounter.
- Storage starts with filesystem JSON under `server/data/encounters`.
- Storage is hidden behind an interface so it can later move to SQLite,
  Postgres, or hosted storage.

Rooms can load a server encounter and broadcast it to all connected clients.

## Realtime Protocol

Socket events:

- `room:join` with `roomId`.
- `room:state` canonical room snapshot.
- `role:claim` with role.
- `role:release`.
- `player:move` with role and position delta or absolute position.
- `marker:place` with marker id and position.
- `marker:move` with marker id and position.
- `timeline:update` with event list.
- `timeline:play`, `timeline:pause`, `timeline:reset`.
- `encounter:apply` with validated encounter JSON.

The server validates all incoming data. Clients treat server state as source of
truth and reconcile their local view after every snapshot.

## Error Handling

- Role taken: show disabled role and a short status message.
- Room full: allow spectator mode or block join with a clear message. First
  version can block join after eight active roles.
- Invalid encounter import: keep current state and show import error.
- Server save failure: keep local state and recommend file export.
- Connection loss: show reconnecting state and temporarily pause local input.
- Unknown timeline event type: skip the event with a warning rather than
  crashing playback.

## Testing

Unit tests:

- Encounter serialization and validation.
- Timeline event validation and runtime spawning.
- Role claim/release rules.
- Movement clamping and ownership checks.

Component tests:

- Role panel disables claimed remote roles.
- Timeline editor adds/edits/deletes events.
- Import/export controls apply valid encounters and reject invalid JSON.

Server tests:

- Two sockets cannot claim the same role.
- A socket cannot move a role it does not own.
- Room state broadcasts after role claim and movement.
- Encounter save/load endpoints round-trip data.

Manual verification:

- Two browser tabs join the same external room.
- Claimed roles are unavailable in the other tab.
- Moving one role updates both tabs.
- Saved encounter can be loaded after a server restart.
- Exported JSON can be imported without a server.

## Implementation Order

1. Extract shared types for roles, players, markers, timeline, and encounter
   documents.
2. Add Node/Socket.IO server with rooms and role ownership.
3. Add client realtime adapter and connection status.
4. Move role claim and player movement through the server when connected.
5. Add encounter import/export.
6. Add server encounter storage endpoints.
7. Replace static timeline list with an editable event form.
8. Expand timeline runtime from circle-only to the first mechanic set.
9. Add deployment scripts and production server mode.

