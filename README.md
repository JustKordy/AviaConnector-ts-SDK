# @justkordy/avia-connector-sdk

A lightweight, straightforward TypeScript SDK for receiving real-time aircraft data from flight simulators via AviaConnector.

## Features

- ✈️ **Simple API** - Single callback-based interface
- 🚀 **Lightweight** - No complex event system or multi-client support
- 📊 **Extensible** - Easy to add new aircraft data properties
- 🎯 **Type-safe** - Full TypeScript support
- 🔌 **WebSocket-based** - Real-time data streaming
- 🎮 **Simulator tracking** - Automatic MSFS/P3D/X-Plane detection

---

## Install

```bash
npm install @justkordy/avia-connector-sdk ws
```

- ws is required at runtime (peer dependency)
- Node.js 16+ recommended

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

server.on("listening", (info) => console.log("[listening]", info.url));
server.on("connection", (c) => console.log("[connection]", c));
server.on("disconnect", (c) => console.log("[disconnect]", c));
server.on("error", (e) => console.error("[server error]", e));

// Simulator connection and disconnection status
server.on("Status", (status, ctx) => {
  if (status.code === "600") {
    console.log(`[simulator connected] ${status.message}`);
  } else if (status.code === "601") {
    console.log(`[simulator disconnected] ${status.message}`);
  }
});

// Typed inbound messages from the client:
server.on("AircraftData", (data, ctx) => {
  console.log("[AircraftData]", "from", ctx.id, 
    "IAS:", data?.Aircraft?.AIRSPEED_INDICATED ?? "-", 
    "ALT:", data?.Aircraft?.PLANE_ALTITUDE ?? "-");
});

server.on("NearestAirportData", (data, ctx) => {
  console.log("[NearestAirport]", data.airport.icao, 
    `${data.distanceNM.toFixed(2)} NM`, 
    `${data.airport.runways.length} runways`);
});

// Check if simulator is connected before requesting data
setInterval(() => {
  if (server.isSimulatorConnected()) {
    server.broadcast({ type: "request", data: { type: "AircraftData" } });
    console.log(`[request] Requesting data from ${server.getSimulatorType()} simulator`);
  } else {
    console.log("[request] Simulator not connected, skipping data request");
  }
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
  server.on("AircraftData", (data, ctx) => win.webContents.send("sdk:AircraftData", { data, clientId: ctx.id }));
  
  // Track simulator connection status
  server.on("Status", (status) => {
    if (status.code === "600") {
      win.webContents.send("sdk:simulatorConnected", { type: status.message });
    } else if (status.code === "601") {
      win.webContents.send("sdk:simulatorDisconnected", { type: status.message });
    }
  });

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
  { "type": "subscribe", "data": { "stream": "AircraftData" } }
  { "type": "unsubscribe", "data": { "stream": "AircraftData" } }
  ```
- Request data from the simulator:
  ```json
  { "type": "request", "data": { "type": "AircraftData" } }
  { "type": "request", "data": { "type": "NearestAirportData" } }
  ```
- Ping (server auto-responds with `pong` if `autoPong` is true):
  ```json
  { "type": "ping", "ts": 1712345678 }
  ```

Aircraft data example (triggers `server.on("AircraftData", ...)`):
```json
{
  "type": "AircraftData",
  "data": {
    "Aircraft": {
      "PLANE_ALTITUDE": 2200,
      "PLANE_LATITUDE": 50.1, 
      "PLANE_LONGITUDE": 14.4,
      "AIRSPEED_INDICATED": 145,
      "AIRSPEED_TRUE": 150,
      "VERTICAL_SPEED": -300,
      "PLANE_HEADING_DEGREES_TRUE": 92,
      "PLANE_PITCH_DEGREES": 1.2,
      "PLANE_BANK_DEGREES": -3.5,
      "SIM_ON_GROUND": false
    }
  }
}
```

Nearest airport data example (triggers `server.on("NearestAirportData", ...)`):
```json
{
  "type": "NearestAirportData",
  "data": {
    "airport": {
      "icao": "KJFK",
      "name": "John F Kennedy International Airport",
      "lat": 40.6398,
      "lon": -73.7789,
      "alt": 4.0,
      "runways": [
        {
          "number": "04L/22R",
          "lat": 40.6431,
          "lon": -73.7745,
          "heading": 40.0,
          "length": 3460.0,
          "width": 60.0,
          "surface": 0,
          "lighting": 31,
          "end1": { "number": "04L", "lat": 40.6398, "lon": -73.7823, "heading": 40.0 },
          "end2": { "number": "22R", "lat": 40.6464, "lon": -73.7667, "heading": 220.0 }
        }
      ]
    },
    "distanceNM": 5.2,
    "bearing": 287.5,
    "aircraftPosition": {
      "lat": 40.6500,
      "lon": -73.8000,
      "alt": 1500.0,
      "heading": 180.0
    }
  }
}
```

---

## Test quickly with wscat

```bash
npx wscat -c ws://127.0.0.1:8765
# Paste:
{"type":"AircraftData","data":{"Aircraft":{"PLANE_LATITUDE":50.1,"PLANE_LONGITUDE":14.4,"PLANE_ALTITUDE":2200,"AIRSPEED_INDICATED":145}}}
```

If you enabled auth:
```bash
{"type":"auth","token":"YOUR_TOKEN"}
```

---

## Simulator Connection Status

The SDK now automatically tracks simulator connection status:

```ts
// Check if a simulator is connected
if (server.isSimulatorConnected()) {
  console.log(`Connected to: ${server.getSimulatorType()}`); // "MSFS", etc.
} else {
  console.log("No simulator connected");
}
```

When the simulator connects, it sends a Status message:
```json
{ "type": "Status", "data": { "code": "600", "message": "MSFS" } }
```

When the simulator disconnects, it sends:
```json
{ "type": "Status", "data": { "code": "601", "message": "MSFS" } }
```

The SDK will automatically block requests to the simulator when it's not connected.
If you try to request data when no simulator is connected, you'll receive:
```json
{ "type": "error", "data": { "message": "Simulator is not connected" } }
```

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
- isSimulatorConnected(): boolean – check if a simulator is connected
- getSimulatorType(): string | null – get the type of connected simulator (e.g., "MSFS")

Events:
- "listening": `{ url: string }`
- "connection": `{ id: number, remote?: string | null }`
- "disconnect": `{ id: number, code?: number, reason?: string }`
- "error": any
- Typed events: "AircraftData" | "Landing" | "Airport" | "Weather" | "Status" | "simulator" | "Error" | "NearestAirportData"
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
- Not receiving data: check if the simulator is connected using `server.isSimulatorConnected()`

---

## License

MIT © 2025 JustKordy