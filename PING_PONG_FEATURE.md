# Ping/Pong Feature - Implementation

## Overview
Added a `ping()` function to the avia-connector-sdk that allows detecting the simulator type by sending a ping request to AviaConnector and receiving a pong response.

## Changes Made

### 1. **New Type: `PongResponse`** (types.ts)

```typescript
/**
 * Pong response data from ping request
 */
export interface PongResponse {
  simulator: "MSFS" | "P3DV5" | string;
}
```

**Purpose:** Defines the structure of the pong response received from AviaConnector.

---

### 2. **Updated `AviaConnectorServerOptions`** (AviaConnectorServer.ts)

Added new callback option:

```typescript
export interface AviaConnectorServerOptions {
  port: number;
  host?: string;
  path?: string;
  
  onListening?: (url: string) => void;
  onConnection?: () => void;
  onDisconnect?: () => void;
  onAircraftData?: (data: AircraftData) => void;
  onSimulatorStatus?: (status: SimulatorStatus) => void;
  onPong?: (response: PongResponse) => void;  // NEW
  onError?: (error: Error) => void;
}
```

**Purpose:** Allows users to register a callback for pong responses.

---

### 3. **New Method: `ping()`** (AviaConnectorServer.ts)

```typescript
/**
 * Send a ping request to AviaConnector
 * Response will be received via onPong callback
 */
ping(): boolean {
  return this.send({
    type: "ping"
  });
}
```

**Usage:**
```typescript
server.ping(); // Sends ping request
```

**Returns:** 
- `true` if message was sent successfully
- `false` if client is not connected or send failed

---

### 4. **Pong Message Handler** (AviaConnectorServer.ts)

Added handler in `handleMessage()` method:

```typescript
// Handle pong response
else if (type === "pong") {
  if (!data) return;
  
  // Extract payload from nested data structure
  const payload = (data as any).payload ?? data;
  const pongResponse: PongResponse = {
    simulator: payload.simulator || ""
  };
  this.onPong?.(pongResponse);
}
```

**Purpose:** Parses incoming pong messages and triggers the `onPong` callback.

---

### 5. **Updated Example** (examples/simple-server.ts)

Added ping demonstration:

```typescript
onConnection: () => {
  console.log(`✅ AviaConnector connected!`);
  
  // Send a ping to detect simulator type
  server.ping();
  
  // Request aircraft data every second
  setInterval(() => {
    if (server.isSimulatorConnected()) {
      server.requestAircraftData();
    }
  }, 1000);
},

onPong: (response) => {
  console.log(`🏓 Pong received! Simulator type: ${response.simulator}`);
},
```

---

## AviaConnector Response Format

Based on the provided C++ code, AviaConnector sends this response:

```json
{
  "type": "pong",
  "data": {
    "payload": {
      "simulator": "MSFS"
    }
  }
}
```

or

```json
{
  "type": "pong",
  "data": {
    "payload": {
      "simulator": "P3DV5"
    }
  }
}
```

or (when no simulator is connected):

```json
{
  "type": "pong",
  "data": {
    "payload": {
      "simulator": ""
    }
  }
}
```

**Possible Values:**
- `"MSFS"` - Microsoft Flight Simulator
- `"P3DV5"` - Prepar3D version 5
- `""` - No simulator connected

---

## Usage Examples

### Example 1: Basic Ping on Connection

```typescript
import { AviaConnectorServer } from 'avia-connector-sdk';

const server = new AviaConnectorServer({
  port: 8765,
  
  onConnection: () => {
    console.log('Connected!');
    server.ping(); // Check simulator type
  },
  
  onPong: (response) => {
    console.log(`Simulator: ${response.simulator}`);
    if (response.simulator === 'MSFS') {
      console.log('Microsoft Flight Simulator detected!');
    } else if (response.simulator === 'P3DV5') {
      console.log('Prepar3D V5 detected!');
    } else {
      console.log('No simulator detected');
    }
  }
});
```

### Example 2: Periodic Ping (Heartbeat)

```typescript
const server = new AviaConnectorServer({
  port: 8765,
  
  onConnection: () => {
    // Ping every 30 seconds to check connection
    setInterval(() => {
      server.ping();
    }, 30000);
  },
  
  onPong: (response) => {
    console.log(`Heartbeat OK - Simulator: ${response.simulator}`);
  }
});
```

### Example 3: Conditional Logic Based on Simulator

```typescript
let currentSimulator: string = '';

const server = new AviaConnectorServer({
  port: 8765,
  
  onConnection: () => {
    server.ping(); // Detect simulator on connection
  },
  
  onPong: (response) => {
    currentSimulator = response.simulator;
    
    // Adjust behavior based on simulator
    if (currentSimulator === 'MSFS') {
      // MSFS-specific configuration
      console.log('Using MSFS optimized settings');
    } else if (currentSimulator === 'P3DV5') {
      // P3D-specific configuration
      console.log('Using P3D optimized settings');
    }
  },
  
  onAircraftData: (data) => {
    // Process data differently based on simulator
    if (currentSimulator === 'MSFS') {
      // MSFS data processing
    } else if (currentSimulator === 'P3DV5') {
      // P3D data processing
    }
  }
});
```

### Example 4: Promise-Based Ping with Timeout

```typescript
function pingWithTimeout(server: AviaConnectorServer, timeout: number = 5000): Promise<PongResponse> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Ping timeout'));
    }, timeout);
    
    // Store original callback
    const originalOnPong = server['onPong'];
    
    // Temporary callback for this ping
    server['onPong'] = (response) => {
      clearTimeout(timer);
      // Restore original callback
      server['onPong'] = originalOnPong;
      resolve(response);
    };
    
    // Send ping
    if (!server.ping()) {
      clearTimeout(timer);
      reject(new Error('Failed to send ping'));
    }
  });
}

// Usage
try {
  const response = await pingWithTimeout(server, 5000);
  console.log(`Simulator: ${response.simulator}`);
} catch (error) {
  console.error('Ping failed:', error);
}
```

---

## Flow Diagram

```
┌─────────────┐                                    ┌─────────────────┐
│   SDK       │                                    │  AviaConnector  │
│   Server    │                                    │      (C++)      │
└─────────────┘                                    └─────────────────┘
      │                                                      │
      │  1. User calls server.ping()                        │
      ├─────────────────────────────────────────────────────>
      │          { "type": "ping" }                         │
      │                                                      │
      │  2. AviaConnector checks simulator type            │
      │                                                      │
      │  3. Sends pong response                             │
      <─────────────────────────────────────────────────────┤
      │  { "type": "pong",                                  │
      │    "data": {                                        │
      │      "payload": {                                   │
      │        "simulator": "MSFS"                          │
      │      }                                              │
      │    }                                                │
      │  }                                                  │
      │                                                      │
      │  4. SDK parses response                             │
      │  5. Calls onPong callback                           │
      │                                                      │
┌─────┴─────┐                                              │
│  onPong   │                                              │
│ callback  │                                              │
└───────────┘                                              │
```

---

## API Reference

### Method: `server.ping()`

**Description:** Sends a ping request to AviaConnector to detect the simulator type.

**Parameters:** None

**Returns:** 
- `boolean` - `true` if sent successfully, `false` otherwise

**Example:**
```typescript
if (server.ping()) {
  console.log('Ping sent successfully');
} else {
  console.error('Failed to send ping - client not connected');
}
```

---

### Callback: `onPong`

**Description:** Called when a pong response is received from AviaConnector.

**Type:** `(response: PongResponse) => void`

**Parameters:**
- `response: PongResponse` - The pong response object
  - `simulator: string` - The detected simulator type ("MSFS", "P3DV5", or "")

**Example:**
```typescript
onPong: (response) => {
  console.log(`Detected: ${response.simulator}`);
}
```

---

## Benefits

### 1. **Simulator Detection**
- Know which simulator is connected before requesting data
- Adjust behavior based on simulator type
- Display simulator info in UI

### 2. **Connection Health Check**
- Use as heartbeat to verify connection is alive
- Detect connection issues early
- Monitor latency (time between ping and pong)

### 3. **Lightweight**
- Minimal payload (just `{ "type": "ping" }`)
- Fast response from AviaConnector
- Low overhead for periodic checks

### 4. **Flexible**
- Can be called at any time
- No side effects (doesn't modify state)
- Non-blocking (callback-based)

---

## Testing Scenarios

### Test 1: Basic Ping
1. Connect AviaConnector with MSFS
2. Call `server.ping()`
3. **Expected:** `onPong` called with `{ simulator: "MSFS" }`

### Test 2: Ping with P3D
1. Connect AviaConnector with P3D V5
2. Call `server.ping()`
3. **Expected:** `onPong` called with `{ simulator: "P3DV5" }`

### Test 3: Ping Without Simulator
1. Connect AviaConnector (no simulator running)
2. Call `server.ping()`
3. **Expected:** `onPong` called with `{ simulator: "" }`

### Test 4: Ping Before Connection
1. Call `server.ping()` before client connects
2. **Expected:** Returns `false`, no pong received

### Test 5: Multiple Pings
1. Call `server.ping()` multiple times rapidly
2. **Expected:** Multiple pong responses, all handled correctly

---

## Implementation Details

### Message Format Sent to AviaConnector

```json
{
  "type": "ping"
}
```

**Simple and minimal** - just the type field.

### Expected Response from AviaConnector

```json
{
  "type": "pong",
  "data": {
    "payload": {
      "simulator": "MSFS"
    }
  }
}
```

**Nested structure** - data → payload → simulator

### Parser Logic

The SDK handles the nested structure automatically:

```typescript
const payload = (data as any).payload ?? data;
const pongResponse: PongResponse = {
  simulator: payload.simulator || ""
};
```

This ensures compatibility even if the response format varies slightly.

---

## Error Handling

### Scenario 1: Client Not Connected
```typescript
if (!server.ping()) {
  console.error('Cannot ping - client not connected');
}
```

### Scenario 2: Timeout (No Response)
Use a timer to detect if pong never arrives:

```typescript
let pongReceived = false;

server.ping();

setTimeout(() => {
  if (!pongReceived) {
    console.error('Pong timeout - no response after 5 seconds');
  }
}, 5000);

onPong: (response) => {
  pongReceived = true;
  console.log(`Received: ${response.simulator}`);
}
```

---

## Comparison with Status Messages

### Ping/Pong vs Status Messages

| Feature | Ping/Pong | Status Messages |
|---------|-----------|-----------------|
| **Purpose** | Query simulator type | Notify connection changes |
| **Initiated by** | SDK (user calls `ping()`) | AviaConnector (automatic) |
| **Timing** | On-demand | Event-driven |
| **Response** | Immediate | On change only |
| **Info provided** | Simulator type | Connected/disconnected |
| **Use case** | Detection & heartbeat | State monitoring |

**Both are useful** - Status for state changes, Ping for active checks.

---

## Status: ✅ COMPLETE

Successfully implemented ping/pong functionality:
- ✅ Added `PongResponse` type
- ✅ Added `onPong` callback option
- ✅ Implemented `ping()` method
- ✅ Added pong message handler
- ✅ Updated example with usage
- ✅ Zero compile errors
- ✅ Ready for testing with AviaConnector

**The SDK now supports active simulator detection via ping/pong!** 🏓✈️
