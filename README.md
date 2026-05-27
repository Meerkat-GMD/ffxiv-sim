# FFXIV Sim

Web raid-practice simulator with an 8-player room model, role locking, timeline
mechanics, xivplan marker assets, and portable encounter save/load.

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

Vite serves the client at `http://127.0.0.1:5174`.

## Production Server

```powershell
npm.cmd run build
npm.cmd run server
```

The Node server listens on `PORT` when set, otherwise `3001`. By default it
binds to `0.0.0.0`, so other devices on the same network can join with this
PC's LAN address.

Open:

```text
http://127.0.0.1:3001/?room=ROOMCODE
```

Users who share the same room code join the same room. Each role can be claimed
by one active connection.

For LAN play, start the server and share the LAN URL printed in the terminal:

```powershell
npm.cmd run server:lan
```

Example:

```text
http://192.168.0.25:3001/?room=TEST
```

If another PC or phone cannot connect, allow Node.js through Windows Firewall
for private networks and make sure all players are on the same network. For
internet play outside your network, deploy the app or forward port `3001` on
your router.

## Temporary Internet Access

For a quick external test without router port forwarding, keep the production
server running and open a Cloudflare Quick Tunnel in another terminal:

```powershell
npm.cmd run tunnel:cloudflare
```

Share the printed `trycloudflare.com` URL with `?room=ROOMCODE` appended:

```text
https://example.trycloudflare.com/?room=TEST
```

The tunnel URL is temporary and only works while the tunnel process is running.
For stable sessions, deploy the app to a Node host or set up a named Cloudflare
Tunnel.

## External Deployment

Deploy the project as a Node/Docker web service on Render, Railway, Fly.io, or a
VPS. The recommended first target is Render because this repository includes a
`render.yaml` Blueprint and a Dockerfile.

### Render

1. Push this folder to a GitHub repository.
2. In Render, create a new Blueprint from that repository.
3. Render will read `render.yaml`, build the Docker image, and expose the web
   service.
4. Open the assigned `onrender.com` URL with a room code:

```text
https://your-service.onrender.com/?room=TEST
```

The service must bind to `0.0.0.0:$PORT`; the server already does this. Render
health checks use:

```text
/healthz
```

### Railway

Railway can also deploy this project from the same Dockerfile. Create a Railway
service from the GitHub repository, expose public networking, and use the
generated domain with `?room=ROOMCODE`.

Required runtime behavior:

- Run `npm install`.
- Run `npm run build`.
- Start with `npm run server`.
- Expose the configured `PORT`.
- Keep `server/data/encounters` persistent if server-side saved encounters must
  survive redeploys.

Docker deployment is also supported:

```powershell
docker build -t ffxiv-sim .
docker run -p 3001:3001 -e PORT=3001 ffxiv-sim
```

For Render, `render.yaml` is included as a Docker web service starting point.

## Encounter Files

The UI can export/import encounter JSON files. The same document contains:

- arena shape
- player positions
- placed floor markers
- timeline event definitions

Server save/load uses `/api/encounters`.
