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

let activeID = 0;


server.on("connection", (info: any) => {
  console.log("[server] connection:", info);
  activeID = info.id;
  setInterval(() => {
    server.sendTo(activeID, { type: "request", data: { type: "AircraftData" } });
    console.log("ping");
    if(activeID == 0)
    {
      clearInterval(this);
    }
  }, 1000);

  
});

server.on("Status", (info) => {
  console.log("[server] status:", info);
});

server.on("disconnect", (info: any) => {
  console.log("[server] disconnect:", info);
  activeID = 0;
});

server.on("error", (e: any) => {
  console.error("[server] errord:", e);
});


server.on("AircraftData", (m) => {
  console.log("[airdata]", m.Aircraft?.PLANE_LATITUDE);
  console.log("[airdata]", m.Aircraft?.PLANE_LONGITUDE);
  console.log("[airdata]", m.Aircraft?.PLANE_ALTITUDE);
  console.log("[airdata]", m.Aircraft?.AIRSPEED_INDICATED);
  console.log("----");
  console.log("[airdata]", m.Aircraft?.AIRSPEED_TRUE);
  console.log("[airdata]", m.Aircraft?.VERTICAL_SPEED);
  console.log("[airdata]", m.Aircraft?.PLANE_HEADING_DEGREES_TRUE);
  console.log("[airdata]", m.Aircraft?.PLANE_PITCH_DEGREES);
  console.log("[airdata]", m.Aircraft?.PLANE_BANK_DEGREES);
  console.log("[airdata]", m.Aircraft?.SIM_ON_GROUND);
});
server.on("NearestAirport", (a: any) => {
  console.log("[airport]", a.icao, a.iata, a.name);
  if (a.runway) {
    console.log("[airport]", "Runway:", a.runway.id, a.runway.headingDeg, "deg", a.runway.lengthM, "m", a.runway.surface);
  }
});

// If you want to push commands to the connected AviaConnector clients:
// server.broadcast({ type: "subscribe", data: { stream: "flightData" } });

process.on("SIGINT", () => {
  console.log("Shutting down...");
  server.close();
  setTimeout(() => process.exit(0), 200);
});