/**
 * Example: Nearest Airport Data with AviaConnector SDK
 * 
 * This example demonstrates how to request and handle nearest airport data
 * from Microsoft Flight Simulator via the AviaConnector.
 */

import { AviaConnectorServer } from "../src/server/AviaConnectorServer";
import type { NearestAirportData, ClientContext } from "../src/types";

const server = new AviaConnectorServer({
  port: 8765,
  host: "0.0.0.0",
  autoPong: true
});

// Listen for server events
server.on("listening", (info) => {
  console.log(`✅ AviaConnector Server listening on ${info.url}`);
  console.log("Waiting for MSFS connection...");
});

server.on("connection", (ctx) => {
  console.log(`🔌 Client ${ctx.id} connected from ${ctx.remoteAddress}`);
});

server.on("disconnect", (info) => {
  console.log(`🔌 Client ${info.id} disconnected (code: ${info.code})`);
});

// Handle Status events to know when simulator connects
server.on("Status", (payload) => {
  console.log("📊 Status update:", payload);
  
  if (server.isSimulatorConnected()) {
    console.log(`✈️  Simulator connected: ${server.getSimulatorType()}`);
  } else {
    console.log("❌ Simulator disconnected");
  }
});

// Handle NearestAirportData events
server.on("NearestAirportData", (data: NearestAirportData, ctx: ClientContext) => {
  console.log("\n🛬 ========== NEAREST AIRPORT DATA ==========");
  console.log(`📍 Airport: ${data.airport.icao} - ${data.airport.name}`);
  console.log(`📏 Distance: ${data.distanceNM.toFixed(2)} NM`);
  console.log(`🧭 Bearing: ${data.bearing.toFixed(0)}°`);
  console.log(`📊 Coordinates: ${data.airport.lat.toFixed(4)}°, ${data.airport.lon.toFixed(4)}°`);
  console.log(`🏔️  Elevation: ${data.airport.alt.toFixed(0)} meters MSL`);
  console.log(`\n✈️  Aircraft Position:`);
  console.log(`   Lat: ${data.aircraftPosition.lat.toFixed(4)}°`);
  console.log(`   Lon: ${data.aircraftPosition.lon.toFixed(4)}°`);
  console.log(`   Alt: ${data.aircraftPosition.alt.toFixed(0)} ft`);
  console.log(`   Hdg: ${data.aircraftPosition.heading.toFixed(0)}°`);
  
  console.log(`\n🛫 Runways (${data.airport.runways.length}):`);
  data.airport.runways.forEach((runway, idx) => {
    console.log(`\n   Runway ${idx + 1}: ${runway.number}`);
    console.log(`   ├─ Length: ${runway.length.toFixed(0)} m (${(runway.length * 3.28084).toFixed(0)} ft)`);
    console.log(`   ├─ Width: ${runway.width.toFixed(0)} m (${(runway.width * 3.28084).toFixed(0)} ft)`);
    console.log(`   ├─ Heading: ${runway.heading.toFixed(0)}°`);
    console.log(`   ├─ Surface: ${getSurfaceType(runway.surface)}`);
    console.log(`   ├─ Lighting: ${getLightingDescription(runway.lighting)}`);
    console.log(`   ├─ End 1: ${runway.end1.number} @ ${runway.end1.heading.toFixed(0)}°`);
    console.log(`   └─ End 2: ${runway.end2.number} @ ${runway.end2.heading.toFixed(0)}°`);
  });
  
  // Analyze best runway based on wind (example logic)
  const aircraftHeading = data.aircraftPosition.heading;
  const bestRunway = findBestRunway(data.airport.runways, aircraftHeading);
  
  if (bestRunway) {
    console.log(`\n🎯 Recommended Runway: ${bestRunway.runway.number}`);
    console.log(`   Reason: ${bestRunway.reason}`);
    console.log(`   Headwind Component: ${bestRunway.headwindComponent.toFixed(1)}° deviation`);
  }
  
  console.log("\n============================================\n");
});

// Handle AircraftData events
server.on("AircraftData", (data, ctx) => {
  if (data.Aircraft) {
    console.log(`✈️  Aircraft: ${data.Aircraft.PLANE_ALTITUDE?.toFixed(0)} ft, ` +
                `${data.Aircraft.AIRSPEED_INDICATED?.toFixed(0)} KIAS, ` +
                `HDG ${data.Aircraft.PLANE_HEADING_DEGREES_TRUE?.toFixed(0)}°`);
  }
});

// Handle errors
server.on("Error", (error) => {
  console.error("❌ Error:", error.message);
});

server.on("error", (err) => {
  console.error("❌ Server error:", err);
});

// Helper function to convert surface type code to readable string
function getSurfaceType(code: number): string {
  const surfaces: Record<number, string> = {
    0: "Concrete",
    1: "Grass",
    2: "Water",
    3: "Grass Bumpy",
    4: "Asphalt",
    5: "Short Grass",
    6: "Long Grass",
    7: "Hard Turf",
    8: "Snow",
    9: "Ice",
    10: "Urban",
    11: "Forest",
    12: "Dirt",
    13: "Coral",
    14: "Gravel",
    15: "Oil Treated",
    16: "Steel Mats",
    17: "Bituminous",
    18: "Brick",
    19: "Macadam",
    20: "Planks",
    21: "Sand",
    22: "Shale",
    23: "Tarmac"
  };
  return surfaces[code] || `Unknown (${code})`;
}

// Helper function to describe lighting
function getLightingDescription(flags: number): string {
  if (flags === 0) return "None";
  
  const lights: string[] = [];
  if (flags & 1) lights.push("Edge");
  if (flags & 2) lights.push("Center");
  if (flags & 4) lights.push("End");
  if (flags & 8) lights.push("REIL");
  if (flags & 16) lights.push("ALSF");
  if (flags & 32) lights.push("MALS");
  
  return lights.join(", ") || `Code ${flags}`;
}

// Helper function to find best runway based on aircraft heading
function findBestRunway(runways: NearestAirportData["airport"]["runways"], aircraftHeading: number): {
  runway: NearestAirportData["airport"]["runways"][0];
  reason: string;
  headwindComponent: number;
} | null {
  if (runways.length === 0) return null;
  
  let bestRunway = runways[0];
  let bestScore = Infinity;
  let bestReason = "";
  
  for (const runway of runways) {
    // Check both runway ends
    const end1Deviation = Math.abs(normalizeHeading(runway.end1.heading - aircraftHeading));
    const end2Deviation = Math.abs(normalizeHeading(runway.end2.heading - aircraftHeading));
    
    const deviation = Math.min(end1Deviation, end2Deviation);
    
    if (deviation < bestScore) {
      bestScore = deviation;
      bestRunway = runway;
      
      if (deviation < 30) {
        bestReason = "Most aligned with aircraft heading";
      } else if (deviation < 90) {
        bestReason = "Crosswind landing required";
      } else {
        bestReason = "Tailwind component - not recommended";
      }
    }
  }
  
  return {
    runway: bestRunway,
    reason: bestReason,
    headwindComponent: bestScore
  };
}

// Normalize heading to -180 to 180
function normalizeHeading(heading: number): number {
  while (heading > 180) heading -= 360;
  while (heading < -180) heading += 360;
  return heading;
}

// Example: Request nearest airport data every 30 seconds
// In a real application, you'd trigger this based on user input or specific conditions
console.log("\n📋 Nearest Airport Example Server");
console.log("================================");
console.log("This server will:");
console.log("1. Wait for MSFS to connect");
console.log("2. Listen for nearest airport data requests");
console.log("3. Display comprehensive runway information");
console.log("\nTo request nearest airport data, send:");
console.log(JSON.stringify({ 
  type: "request", 
  data: { type: "NearestAirportData" } 
}, null, 2));
console.log("\n");

// Optional: Auto-request nearest airport data periodically when simulator is connected
const AUTO_REQUEST_INTERVAL = 10000; // 10 seconds
let autoRequestTimer: NodeJS.Timeout | null = null;

server.on("Status", (payload) => {
  if (server.isSimulatorConnected()) {
    // Start auto-requesting
    if (!autoRequestTimer) {
      console.log("🔄 Starting auto-request for nearest airport (every 60s)");
      autoRequestTimer = setInterval(() => {
        if (server.isSimulatorConnected()) {
          console.log("🔄 Auto-requesting nearest airport data...");
          server.broadcast({
            type: "request",
            data: { type: "NearestAirportData" },
            ts: Date.now()
          });
        }
      }, AUTO_REQUEST_INTERVAL);
    }
  } else {
    // Stop auto-requesting
    if (autoRequestTimer) {
      console.log("🛑 Stopping auto-request (simulator disconnected)");
      clearInterval(autoRequestTimer);
      autoRequestTimer = null;
    }
  }
});

// Cleanup on exit
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down server...");
  if (autoRequestTimer) clearInterval(autoRequestTimer);
  server.close();
  process.exit(0);
});
