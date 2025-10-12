# Avia Connector SDK - Quick Reference (Simplified)

## Installation

```bash
npm install avia-connector-sdk
```

## Basic Usage

```typescript
import { AviaConnectorServer } from 'avia-connector-sdk';

// Create server with callbacks
const server = new AviaConnectorServer({
  port: 8080,
  
  onListening: (url) => {
    console.log(`Server listening on ${url}`);
  },
  
  onConnection: () => {
    console.log('AviaConnector connected');
  },
  
  onAircraftData: (data) => {
    console.log('Flight data:', data);
    console.log(`Altitude: ${data.PLANE_ALTITUDE} ft`);
    console.log(`Speed: ${data.AIRSPEED_INDICATED} kts`);
    console.log(`Heading: ${data.PLANE_HEADING_DEGREES_TRUE}°`);
  },
  
  onSimulatorStatus: (connected) => {
    console.log(`Simulator ${connected ? 'connected' : 'disconnected'}`);
  },
  
  onDisconnect: () => {
    console.log('AviaConnector disconnected');
  },
  
  onError: (error) => {
    console.error('Server error:', error);
  }
});

// Request flight data at regular intervals
setInterval(() => {
  if (server.isSimulatorConnected() && server.isClientConnected()) {
    server.requestAircraftData();
  }
}, 200); // Request every 200ms (5Hz)
```

## API Reference

### Constructor

```typescript
new AviaConnectorServer({
  port: number;                          // WebSocket port
  onListening?: (url: string) => void;   // Server started
  onConnection?: () => void;             // Client connected
  onDisconnect?: () => void;             // Client disconnected  
  onAircraftData?: (data: AircraftData) => void; // Flight data received
  onSimulatorStatus?: (connected: boolean) => void; // Sim status changed
  onError?: (error: Error) => void;      // Error occurred
})
```

### Methods

```typescript
// Request aircraft data from simulator
server.requestAircraftData(): void

// Check if simulator is connected
server.isSimulatorConnected(): boolean

// Check if client (AviaConnector.exe) is connected
server.isClientConnected(): boolean

// Send custom message to client
server.send(message: any): void

// Close server
server.close(): void
```

### Data Structure

All aircraft data comes in a **flat structure** with direct property access:

```typescript
interface AircraftData {
  // Common properties (example, actual properties depend on AviaConnector)
  PLANE_ALTITUDE?: number;              // Altitude in feet
  AIRSPEED_INDICATED?: number;          // Indicated airspeed in knots
  AIRSPEED_TRUE?: number;               // True airspeed in knots
  PLANE_HEADING_DEGREES_TRUE?: number;  // True heading in degrees
  VERTICAL_SPEED?: number;              // Vertical speed in feet per minute
  PLANE_LATITUDE?: number;              // Latitude in degrees
  PLANE_LONGITUDE?: number;             // Longitude in degrees
  
  // Extensible - any property can be added
  [key: string]: number | boolean | string | undefined;
}
```

## Examples

### Simple Logger

```typescript
const server = new AviaConnectorServer({
  port: 8080,
  onAircraftData: (data) => {
    const time = new Date().toISOString();
    console.log(`[${time}] Alt: ${data.PLANE_ALTITUDE}ft, Speed: ${data.AIRSPEED_INDICATED}kts`);
  }
});
```

### Data Recorder

```typescript
const flightLog: AircraftData[] = [];

const server = new AviaConnectorServer({
  port: 8080,
  onAircraftData: (data) => {
    flightLog.push({ ...data, timestamp: Date.now() });
  }
});

// Save log every 10 seconds
setInterval(() => {
  if (flightLog.length > 0) {
    fs.writeFileSync('flight-log.json', JSON.stringify(flightLog, null, 2));
  }
}, 10000);
```

### Live Dashboard

```typescript
const server = new AviaConnectorServer({
  port: 8080,
  
  onConnection: () => {
    console.clear();
    console.log('✅ AviaConnector Connected');
  },
  
  onAircraftData: (data) => {
    // Clear console and redraw dashboard
    console.clear();
    console.log('═══════════════════════════════');
    console.log('   FLIGHT DATA DASHBOARD');
    console.log('═══════════════════════════════');
    console.log(`Altitude:    ${data.PLANE_ALTITUDE?.toFixed(0) || '--'} ft`);
    console.log(`Speed (IAS): ${data.AIRSPEED_INDICATED?.toFixed(0) || '--'} kts`);
    console.log(`Speed (TAS): ${data.AIRSPEED_TRUE?.toFixed(0) || '--'} kts`);
    console.log(`Heading:     ${data.PLANE_HEADING_DEGREES_TRUE?.toFixed(0) || '--'}°`);
    console.log(`V/S:         ${data.VERTICAL_SPEED?.toFixed(0) || '--'} fpm`);
    console.log(`Position:    ${data.PLANE_LATITUDE?.toFixed(4)}, ${data.PLANE_LONGITUDE?.toFixed(4)}`);
    console.log('═══════════════════════════════');
  }
});

// Request data every 500ms
setInterval(() => {
  if (server.isClientConnected()) {
    server.requestAircraftData();
  }
}, 500);
```

### HTTP API Server

```typescript
import express from 'express';

const app = express();
let latestData: AircraftData | null = null;

const server = new AviaConnectorServer({
  port: 8080,
  onAircraftData: (data) => {
    latestData = data;
  }
});

// HTTP endpoint to get latest flight data
app.get('/api/flight-data', (req, res) => {
  if (!latestData) {
    return res.status(503).json({ error: 'No data available' });
  }
  res.json(latestData);
});

// HTTP endpoint to get status
app.get('/api/status', (req, res) => {
  res.json({
    simulatorConnected: server.isSimulatorConnected(),
    clientConnected: server.isClientConnected()
  });
});

app.listen(3000, () => {
  console.log('HTTP API server running on http://localhost:3000');
});

// Request data continuously
setInterval(() => {
  if (server.isClientConnected()) {
    server.requestAircraftData();
  }
}, 200);
```

## Migration from Old API

### Old (Event-based, Multi-client)

```typescript
// ❌ OLD WAY
server.on('connection', (info) => {
  console.log(`Client ${info.id} connected`);
});

server.on('AircraftData', (data) => {
  const flightData = data.flightData.Aircraft; // Nested structure
  console.log(`Client ${data.clientId}: ${flightData.PLANE_ALTITUDE}`);
});

server.on('disconnect', (info) => {
  console.log(`Client ${info.id} disconnected`);
});
```

### New (Callback-based, Single-client)

```typescript
// ✅ NEW WAY
const server = new AviaConnectorServer({
  port: 8080,
  
  onConnection: () => {
    console.log('Client connected');
  },
  
  onAircraftData: (data) => {
    // Flat structure - direct access
    console.log(`Altitude: ${data.PLANE_ALTITUDE}`);
  },
  
  onDisconnect: () => {
    console.log('Client disconnected');
  }
});
```

## Key Changes

1. **No more `.on()` / `.off()`** - Use constructor callbacks
2. **No more client IDs** - Single client only
3. **Flat data structure** - Access `data.PROPERTY` not `data.Aircraft.PROPERTY`
4. **No more nearest airport** - Feature removed
5. **Simpler API** - Less code, easier to use

## TypeScript Support

Full TypeScript support with type definitions:

```typescript
import { 
  AviaConnectorServer, 
  AircraftData, 
  AviaConnectorServerConfig 
} from 'avia-connector-sdk';

const config: AviaConnectorServerConfig = {
  port: 8080,
  onAircraftData: (data: AircraftData) => {
    // Full type safety
    const altitude: number | undefined = data.PLANE_ALTITUDE;
  }
};

const server = new AviaConnectorServer(config);
```

## Common Patterns

### Auto-reconnect Handler

```typescript
let reconnectInterval: NodeJS.Timeout | null = null;

const server = new AviaConnectorServer({
  port: 8080,
  
  onConnection: () => {
    console.log('✅ Connected');
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  },
  
  onDisconnect: () => {
    console.log('❌ Disconnected');
    // Auto request data when reconnected
    reconnectInterval = setInterval(() => {
      if (server.isClientConnected()) {
        server.requestAircraftData();
      }
    }, 200);
  }
});
```

### Conditional Data Requests

```typescript
let requestInterval: NodeJS.Timeout;

const server = new AviaConnectorServer({
  port: 8080,
  
  onConnection: () => {
    // Start requesting when connected
    requestInterval = setInterval(() => {
      server.requestAircraftData();
    }, 200);
  },
  
  onDisconnect: () => {
    // Stop requesting when disconnected
    if (requestInterval) {
      clearInterval(requestInterval);
    }
  }
});
```

### Error Handling

```typescript
const server = new AviaConnectorServer({
  port: 8080,
  
  onError: (error) => {
    console.error('Server error:', error.message);
    
    // Handle specific error types
    if (error.message.includes('EADDRINUSE')) {
      console.error('Port already in use!');
    }
  },
  
  onAircraftData: (data) => {
    try {
      // Process data safely
      const altitude = data.PLANE_ALTITUDE ?? 0;
      console.log(`Altitude: ${altitude}`);
    } catch (error) {
      console.error('Data processing error:', error);
    }
  }
});
```

## Best Practices

1. **Always check connection status** before requesting data
2. **Use reasonable request intervals** (200-500ms recommended)
3. **Handle undefined values** (properties might not always be present)
4. **Implement error handlers** for production use
5. **Clean up intervals** when server is closed

## Support

For issues or questions:
- Check the examples in `avia-connector-sdk/examples/`
- Review the TypeScript definitions in `src/types.ts`
- Examine the implementation in `src/server/AviaConnectorServer.ts`
