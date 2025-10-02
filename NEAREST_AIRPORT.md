# Nearest Airport Feature - SDK Documentation

## Overview

The AviaConnector SDK now supports requesting and receiving comprehensive nearest airport information from Microsoft Flight Simulator, including detailed runway data, distance calculations, and bearing information.

## Features

✅ **Nearest Airport Detection** - Automatically finds closest airport in MSFS reality bubble (~200km)  
✅ **Complete Runway Information** - All runways with detailed specifications  
✅ **Distance & Bearing** - Calculated from current aircraft position  
✅ **Runway Details** - Length, width, surface type, lighting, heading, coordinates  
✅ **Both Runway Ends** - Individual threshold data for each runway direction  
✅ **Type-Safe** - Full TypeScript support with comprehensive interfaces

## Installation

```bash
npm install avia-connector-sdk
```

## Type Definitions

### `NearestAirportData`

The main interface for nearest airport data:

```typescript
interface NearestAirportData {
  airport: Airport;              // Complete airport info
  distanceNM: number;            // Distance in nautical miles
  bearing: number;               // True bearing (0-360°)
  aircraftPosition: AircraftPosition; // Aircraft position snapshot
}
```

### `Airport`

```typescript
interface Airport {
  icao: string;        // ICAO code (e.g., "KJFK")
  name: string;        // Full airport name
  lat: number;         // Latitude (decimal degrees)
  lon: number;         // Longitude (decimal degrees)
  alt: number;         // Elevation (meters MSL)
  runways: Runway[];   // Array of all runways
}
```

### `Runway`

```typescript
interface Runway {
  number: string;      // Runway designator (e.g., "09L/27R")
  lat: number;         // Center latitude
  lon: number;         // Center longitude
  alt: number;         // Center altitude (meters)
  heading: number;     // True heading (0-360°)
  length: number;      // Length (meters)
  width: number;       // Width (meters)
  surface: number;     // Surface type code
  lighting: number;    // Lighting flags (bitfield)
  end1: RunwayEnd;     // Primary threshold
  end2: RunwayEnd;     // Opposite threshold
}
```

### `RunwayEnd`

```typescript
interface RunwayEnd {
  number: string;      // End designator (e.g., "09L")
  lat: number;         // Threshold latitude
  lon: number;         // Threshold longitude
  alt: number;         // Threshold altitude (meters)
  heading: number;     // True heading (0-360°)
}
```

### `AircraftPosition`

```typescript
interface AircraftPosition {
  lat: number;         // Aircraft latitude
  lon: number;         // Aircraft longitude
  alt: number;         // Aircraft altitude (feet MSL)
  heading: number;     // True heading (0-360°)
}
```

## Surface Type Codes

| Code | Surface Type |
|------|-------------|
| 0 | Concrete |
| 1 | Grass |
| 2 | Water |
| 3 | Grass Bumpy |
| 4 | Asphalt |
| 5 | Short Grass |
| 6 | Long Grass |
| 7 | Hard Turf |
| 8 | Snow |
| 9 | Ice |
| 10 | Urban |
| 11 | Forest |
| 12 | Dirt |
| 13 | Coral |
| 14 | Gravel |

## Lighting Flags

Bitfield flags for runway lighting:

| Bit | Light Type |
|-----|-----------|
| 1 | Edge Lights |
| 2 | Center Lights |
| 4 | End Lights |
| 8 | REIL (Runway End Identifier Lights) |
| 16 | ALSF (Approach Light System) |
| 32 | MALS (Medium Intensity Approach Light System) |

## Server Usage

### Basic Server Setup

```typescript
import { AviaConnectorServer } from "avia-connector-sdk";

const server = new AviaConnectorServer({
  port: 8080,
  host: "0.0.0.0",
  autoPong: true
});

// Handle nearest airport data
server.on("NearestAirportData", (data, ctx) => {
  console.log(`Nearest airport: ${data.airport.icao}`);
  console.log(`Distance: ${data.distanceNM.toFixed(2)} NM`);
  console.log(`Bearing: ${data.bearing.toFixed(0)}°`);
  console.log(`Runways: ${data.airport.runways.length}`);
  
  // Process runway data
  data.airport.runways.forEach(runway => {
    console.log(`  ${runway.number}: ${runway.length}m x ${runway.width}m`);
  });
});

// Check simulator connection status
server.on("Status", (payload) => {
  if (server.isSimulatorConnected()) {
    console.log(`Simulator connected: ${server.getSimulatorType()}`);
  }
});
```

### Requesting Data

The client sends a request message:

```typescript
// Request nearest airport data
const request = {
  type: "request",
  data: { type: "NearestAirportData" },
  ts: Date.now()
};

// Send via WebSocket
ws.send(JSON.stringify(request));
```

### Broadcasting to Clients

```typescript
// Broadcast nearest airport data to all connected clients
server.broadcast({
  type: "NearestAirportData",
  data: nearestAirportData,
  ts: Date.now()
});

// Send to specific client
server.sendTo(clientId, {
  type: "NearestAirportData",
  data: nearestAirportData
});
```

## Client Usage

### WebSocket Client Example

```typescript
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

ws.on("message", (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === "NearestAirportData") {
    const airport = message.data;
    
    console.log(`Nearest: ${airport.airport.icao}`);
    console.log(`Distance: ${airport.distanceNM.toFixed(2)} NM`);
    
    // Find best runway for landing
    const bestRunway = findBestRunway(
      airport.airport.runways,
      airport.aircraftPosition.heading
    );
  }
});

// Request nearest airport
ws.send(JSON.stringify({
  type: "request",
  data: { type: "NearestAirportData" }
}));
```

## Practical Examples

### Finding Suitable Landing Runways

```typescript
function findSuitableRunways(data: NearestAirportData, minLength: number = 1500) {
  return data.airport.runways.filter(runway => {
    const lengthMeters = runway.length;
    const lengthFeet = lengthMeters * 3.28084;
    
    return lengthFeet >= minLength &&
           (runway.surface === 0 || runway.surface === 4) && // Concrete or Asphalt
           runway.lighting > 0; // Has lighting
  });
}
```

### Calculating Best Runway Based on Wind

```typescript
function findBestRunwayForWind(
  runways: Runway[],
  windDirection: number,
  windSpeed: number
): Runway | null {
  let bestRunway: Runway | null = null;
  let bestHeadwind = -Infinity;
  
  for (const runway of runways) {
    // Check both ends
    const end1Headwind = calculateHeadwind(
      windDirection,
      windSpeed,
      runway.end1.heading
    );
    const end2Headwind = calculateHeadwind(
      windDirection,
      windSpeed,
      runway.end2.heading
    );
    
    const headwind = Math.max(end1Headwind, end2Headwind);
    
    if (headwind > bestHeadwind) {
      bestHeadwind = headwind;
      bestRunway = runway;
    }
  }
  
  return bestRunway;
}

function calculateHeadwind(
  windDir: number,
  windSpeed: number,
  runwayHeading: number
): number {
  const angle = windDir - runwayHeading;
  return windSpeed * Math.cos(angle * Math.PI / 180);
}
```

### Finding Closest Runway to Aircraft

```typescript
function findClosestRunway(data: NearestAirportData): {
  runway: Runway;
  distance: number;
} | null {
  if (data.airport.runways.length === 0) return null;
  
  const acLat = data.aircraftPosition.lat;
  const acLon = data.aircraftPosition.lon;
  
  let closest = data.airport.runways[0];
  let minDist = calculateDistance(acLat, acLon, closest.lat, closest.lon);
  
  for (const runway of data.airport.runways) {
    const dist = calculateDistance(acLat, acLon, runway.lat, runway.lon);
    if (dist < minDist) {
      minDist = dist;
      closest = runway;
    }
  }
  
  return { runway: closest, distance: minDist };
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

### Display Runway Information

```typescript
function displayRunwayInfo(runway: Runway) {
  console.log(`Runway ${runway.number}`);
  console.log(`  Length: ${(runway.length * 3.28084).toFixed(0)} ft`);
  console.log(`  Width: ${(runway.width * 3.28084).toFixed(0)} ft`);
  console.log(`  Heading: ${runway.heading.toFixed(0)}°`);
  console.log(`  Surface: ${getSurfaceName(runway.surface)}`);
  console.log(`  Lighting: ${describeLighting(runway.lighting)}`);
  console.log(`  Ends: ${runway.end1.number} (${runway.end1.heading}°) ` +
              `↔ ${runway.end2.number} (${runway.end2.heading}°)`);
}
```

## Error Handling

The SDK automatically validates simulator connection:

```typescript
server.on("Error", (error, ctx) => {
  console.error("Error:", error.message);
  
  if (error.message === "Simulator isnt connected") {
    // Handle simulator disconnection
    ctx.send({
      type: "status",
      data: { message: "Please start MSFS and connect" }
    });
  }
});
```

## Important Notes

### Reality Bubble Limitation

The nearest airport feature uses MSFS's "reality bubble" which has a radius of approximately 200km. This means:

- ✅ Fast and efficient
- ✅ Returns only relevant nearby airports
- ❌ Won't find airports beyond 200km
- ❌ Won't work over oceans far from land

### Data Accuracy

- All coordinates are in decimal degrees
- Altitudes are in meters MSL (multiply by 3.28084 for feet)
- Runway lengths/widths are in meters
- Headings are true north (0-360°)
- Distance calculations use the Haversine formula

### Performance

- Requesting nearest airport data involves multiple SimConnect API calls
- Expected response time: < 2 seconds
- Don't request more frequently than every 10-30 seconds
- Cache results when appropriate

## Examples

Run the included examples:

```bash
# Server example with comprehensive logging
npm run dev examples/server-nearest-airport.ts

# Interactive client example
npm run dev examples/client-nearest-airport.ts
```

## API Reference

### Server Methods

```typescript
// Listen for nearest airport data
server.on("NearestAirportData", (data: NearestAirportData, ctx: ClientContext) => void)

// Check simulator connection
server.isSimulatorConnected(): boolean
server.getSimulatorType(): string | null

// Broadcast to all clients
server.broadcast(payload: unknown): void

// Send to specific client
server.sendTo(clientId: number, payload: unknown): void
```

### Message Format

**Request:**
```json
{
  "type": "request",
  "data": {
    "type": "NearestAirportData"
  },
  "ts": 1696262400000
}
```

**Response:**
```json
{
  "type": "NearestAirportData",
  "ts": 1696262400000,
  "data": {
    "airport": {
      "icao": "KJFK",
      "name": "John F Kennedy International Airport",
      "lat": 40.6398,
      "lon": -73.7789,
      "alt": 4.0,
      "runways": [...]
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

## Troubleshooting

**No airports returned:**
- Aircraft may be over ocean >200km from land
- MSFS reality bubble may not have loaded airports yet
- Try flying closer to land

**Incorrect distance:**
- Ensure aircraft position data is fresh
- Check coordinate formats (should be decimal degrees)

**Missing runway data:**
- Some airports may have incomplete data in MSFS
- Verify airport exists in MSFS database

## Support

For issues or questions:
- GitHub: https://github.com/JustKordy/AviaConnector
- Documentation: See `NEAREST_AIRPORT_FEATURE.md` in AviaConnector repository
