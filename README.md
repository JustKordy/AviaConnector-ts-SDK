# @justkordy/avia-connector-sdk

Server-only TypeScript SDK that accepts WebSocket connections from AviaConnector clients (your app is the server, AviaConnector connects as a client).

- Accepts incoming WebSocket connections
- Optional auth handshake: `{ type: "auth", token }`
- Built-in subscribe/unsubscribe commands
- Auto `pong` on `{ type: "ping" }`
- Strongly-typed event routing: `flightData`, `landing`, `airport`, `weather`, `status`, `error`
- Utilities: `push` (to subscribed clients), `broadcast` (to all), `sendTo` (specific client)

Works great embedded in Electron main process or as a standalone Node.js service.

---

## Install

```bash
npm i @justkordy/avia-connector-sdk ws
```

- ws is required at runtime (peer dependency)
- Node.js 18+ recommended

---

## Quick start (Node.js)

```ts
import { AviaConnectorServer } from "@justkordy/avia-connector-sdk";

const server = new AviaConnectorServer({
  host: "127.0.0.1",   // bind to loopback for local-only
  port: 8765,
  // Optional auth:
  // validateAuth: (token) => token === process.env.AVIA_TOKEN
});

server.on("listening", (info: any) => console.log("[listening]", info.url));
server.on("connection", (c: any) => console.log("[connection]", c));
server.on("disconnect", (c: any) => console.log("[disconnect]", c));
server.on("error", (e: any) => console.error("[server error]", e));

// Typed inbound messages from the client:
server.on("flightData", (fd: any, ctx: any) => {
  console.log("[flightData]", "from", ctx.id, "IAS:", fd?.speed?.iasKts ?? "-", "ALT:", fd?.position?.altFt ?? "-");
});

// Push typed data back to clients that subscribed to that stream:
setInterval(() => {
  server.push("weather", { wind: { dirDeg: 240, speedKts: 12, gustKts: 18 }, qnhHpa: 1015, temperatureC: 18 });
}, 5000);
```

Start the server, then point your AviaConnector client to `ws://127.0.0.1:8765`.

---

## Quick start (Electron main process)

```ts
import { app, BrowserWindow } from "electron";
import { AviaConnectorServer } from "@justkordy/avia-connector-sdk";

let win: BrowserWindow;
let server: AviaConnectorServer;

app.on("ready", () => {
  win = new BrowserWindow({ webPreferences: { preload: require.resolve("./preload") } });

  server = new AviaConnectorServer({ host: "127.0.0.1", port: 8765 });
  server.on("listening", (i) => win.webContents.send("sdk:listening", i));
  server.on("flightData", (fd, ctx) => win.webContents.send("sdk:flightData", { fd, clientId: ctx.id }));

  // your window load...
});
```

In preload/renderer you can subscribe to `sdk:*` IPC channels to display data.

---

## Message schema

The server expects JSON text frames. Built-in commands:

- Auth (only if `validateAuth` is set):
  ```json
  { "type": "auth", "token": "..." }
  ```
- Subscribe / Unsubscribe (controls which clients receive `server.push()`):
  ```json
  { "type": "subscribe", "data": { "stream": "flightData" } }
  { "type": "unsubscribe", "data": { "stream": "flightData" } }
  ```
- Ping (server auto-responds with `pong` if `autoPong` is true):
  ```json
  { "type": "ping", "ts": 1712345678 }
  ```

Typed event example (triggers `server.on("flightData", ...)`):
```json
{
  "type": "flightData",
  "data": {
    "position": { "lat": 50.1, "lon": 14.4, "altFt": 2200 },
    "speed": { "iasKts": 145, "gsKts": 150, "vsFpm": -300 },
    "attitude": { "pitchDeg": 1.2, "rollDeg": -3.5, "headingDeg": 92 },
    "aircraft": { "name": "A320neo", "type": "A20N", "icao": "A20N" }
  }
}
```

---

## Test quickly with wscat

```bash
npx wscat -c ws://127.0.0.1:8765
# Paste:
{"type":"flightData","data":{"position":{"lat":50.1,"lon":14.4,"altFt":2200},"speed":{"iasKts":145}}}
```

If you enabled auth:
```bash
{"type":"auth","token":"YOUR_TOKEN"}
```

---

## API

### Class: AviaConnectorServer

```ts
new AviaConnectorServer(options: AviaConnectorServerOptions)
```

Options:
- port: number (required) – TCP port
- host?: string – default "0.0.0.0"
- path?: string – optional WebSocket path (e.g., "/socket")
- validateAuth?: (token: string | undefined, ctx: { id: number; remoteAddress?: string | null; subs: ReadonlySet<string> }) => boolean
- parseMessage?: (raw: any) => MessageEnvelope – parse incoming frames (default JSON)
- autoPong?: boolean – default true, auto-reply to `{type:"ping"}` with `{type:"pong"}`

Methods:
- on(event, handler): unsubscribe function
- off(event, handler): void
- broadcast(payload: unknown): void – send to all clients (ignores subscriptions)
- push<K extends EventName>(event: K, data: EventMap[K]): void – send to clients subscribed to `event`
- sendTo(clientId: number, payload: unknown): void – send to a specific client
- close(): void – stop server

Events:
- "listening": `{ url: string }`
- "connection": `{ id: number, remote?: string | null }`
- "disconnect": `{ id: number, code?: number, reason?: string }`
- "error": any
- Typed events: "flightData" | "landing" | "airport" | "weather" | "status" | "error"
  - Handler signature: `(payload, ctx)`
  - `ctx` is `ClientContext`:
    - `id: number`
    - `remoteAddress?: string | null`
    - `subs: ReadonlySet<string>`
    - `send(payload)`, `subscribe(stream)`, `unsubscribe(stream)`, `close(code?, reason?)`

Types are included with the package.

---

## Security and networking

- Bind to `127.0.0.1` if only local clients should connect (Electron desktop scenario).
- Use `0.0.0.0` to accept LAN connections (Windows/macOS firewall prompts may appear).
- If your client connects through a reverse proxy/TLS, terminate TLS at the proxy and upgrade to WS, or host behind `wss://` with proper certificates.

---

## Troubleshooting

- ECONNREFUSED: ensure the server is actually listening on the target host/port.
- Nothing triggers handlers: verify the client sends `{"type":"<event>","data":{...}}` as JSON text.
- `push()` not reaching clients: clients must first `subscribe` to that stream.
- Auth close code 1008: your `validateAuth` returned false; send a proper `{"type":"auth","token":"..."}` first.

---

## License

MIT © 2025 JustKordy