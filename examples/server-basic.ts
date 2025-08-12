// Run a local server your AviaConnector can connect to.
// Usage:
//   npm i ws
//   npx tsx examples/server-basic.ts
// Then point AviaConnector to ws://127.0.0.1:8765 (or your host/port).

import { AviaConnectorServer } from "../src/server/AviaConnectorServer";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8765);

const server = new AviaConnectorServer({
  host: HOST,
  port: PORT,
  // Optional: validate auth messages
  // validateAuth: (token) => token === process.env.AVIA_TOKEN
});

server.on("connection", (info: any) => {
  console.log("[server] connection:", info);
  server.sendTo(info.id, {type: "request", data: { type: "AircraftData" }});
});

server.on("disconnect", (info: any) => {
  console.log("[server] disconnect:", info);
});

server.on("error", (e: any) => {
  console.error("[server] error:", e);
});

// Handle incoming messages from AviaConnector (typed names)
server.on("status", (s: { message: string }) => {
  console.log("[status]", s.message);
});


server.on("flightData", (fd: any) => {
  console.log(
    "[flightData]",
    "on ground:", fd?.on_ground ?? "-",
    "ALT:", fd?.heading ?? "-"
  );
});

server.on("landing", (l: any) => {
  console.log("[landing]", "ROD:", l?.rateOfDescentFpm ?? "-", "G:", l?.gForce ?? "-");
});

server.on("weather", (w: any) => {
  console.log("[weather]", "Wind:", w?.wind?.dirDeg, "/", w?.wind?.speedKts, "kts");
});

// If you want to push commands to the connected AviaConnector clients:
// server.broadcast({ type: "subscribe", data: { stream: "flightData" } });

process.on("SIGINT", () => {
  console.log("Shutting down...");
  server.close();
  setTimeout(() => process.exit(0), 200);
});