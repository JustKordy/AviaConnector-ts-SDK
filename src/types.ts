export type ISO8601 = string;

export interface MessageEnvelope<T = unknown> {
  type: string;
  ts?: number; // unix epoch ms
  seq?: number;
  data?: T;
}

export enum SimulatorStatusCodes {
  MSFS_CONNECTED = "600",
  MSFS_DISCONNECTED = "601"
}

export type AviaEventType =
  | "AircraftData"
  | "Landing"
  | "Airport"
  | "NearestAirportData"
  | "Weather"
  | "Status"
  | "Error"
  | "Pong"
  | "Heartbeat"
  | "Raw"
  | "simulator";

export interface AircraftData {
  Aircraft?: {
    // Core flight parameters
    PLANE_ALTITUDE?: number; // feet
    PLANE_LATITUDE?: number; // degrees
    PLANE_LONGITUDE?: number; // degrees
    PLANE_ALT_ABOVE_GROUND?: number; // feet
    AIRSPEED_INDICATED?: number; // knots
    AIRSPEED_TRUE?: number; // knots
    VERTICAL_SPEED?: number; // feet per second
    PLANE_HEADING_DEGREES_TRUE?: number; // degrees
    PLANE_PITCH_DEGREES?: number; // degrees
    PLANE_BANK_DEGREES?: number; // degrees
    SIM_ON_GROUND?: boolean; // bool
    
    // Engine data
    GENERAL_ENG_RPM_INDEX?: number; // rpm
    GENERAL_ENG_THROTTLE_LEVER_POSITION_INDEX?: number; // percent
    GENERAL_ENG_MIXTURE_LEVER_POSITION_INDEX?: number; // percent
    ENG_FUEL_FLOW_GPH_INDEX?: number; // gallons per hour
    GENERAL_ENG_OIL_TEMPERATURE_INDEX?: number; // temperature
    GENERAL_ENG_OIL_PRESSURE_INDEX?: number; // pressure
    
    // Additional flight data
    KOHLSMAN_SETTING_HG_INDEX?: number; // inches of mercury
    WISKEY_COMPASS_INDICATION_DEGREES?: number; // degrees
    
    // Additional properties available as per AircraftData.h
    // These are commented out but can be uncommented as needed
    /*
    NUMBER_OF_ENGINES?: number;
    GENERAL_ENG_GENERATOR_ACTIVE_INDEX?: boolean;
    GENERAL_ENG_GENERATOR_SWITCH_INDEX?: boolean;
    GENERAL_ENG_STARTER_INDEX?: boolean;
    CANOPY_OPEN?: number; // percent
    TAILHOOK_POSITION?: number; // percent
    */
  }
}

export interface AirportRunwayInfo {
  icao?: string;
  iata?: string;
  name?: string;
  runway?: {
    id: string;
    headingDeg?: number;
    lengthM?: number;
    surface?: string;
  };
}

/**
 * Runway end (threshold) information
 */
export interface RunwayEnd {
  /** Runway end designator (e.g., "09L", "27R") */
  number: string;
  /** Latitude of the runway threshold in decimal degrees */
  lat: number;
  /** Longitude of the runway threshold in decimal degrees */
  lon: number;
  /** Altitude of the runway threshold in meters */
  alt: number;
  /** True heading of the runway end in degrees (0-360) */
  heading: number;
}

/**
 * Complete runway information including both ends
 */
export interface Runway {
  /** Runway designator (e.g., "09L/27R") */
  number: string;
  /** Latitude of the runway center in decimal degrees */
  lat: number;
  /** Longitude of the runway center in decimal degrees */
  lon: number;
  /** Altitude of the runway center in meters */
  alt: number;
  /** True heading of the runway in degrees */
  heading: number;
  /** Runway length in meters */
  length: number;
  /** Runway width in meters */
  width: number;
  /**
   * Surface type code:
   * 0: Concrete, 1: Grass, 2: Water, 3: Grass Bumpy, 4: Asphalt,
   * 5: Short Grass, 6: Long Grass, 7: Hard Turf, 8: Snow, 9: Ice,
   * 10: Urban, 11: Forest, 12: Dirt, 13: Coral, 14: Gravel, etc.
   */
  surface: number;
  /**
   * Lighting flags (bit field):
   * 1: Edge lights, 2: Center lights, 4: End lights,
   * 8: REIL, 16: ALSF, 32: MALS
   */
  lighting: number;
  /** Primary runway end (first threshold) */
  end1: RunwayEnd;
  /** Secondary runway end (opposite threshold) */
  end2: RunwayEnd;
}

/**
 * Airport information with all runways
 */
export interface Airport {
  /** ICAO airport code (e.g., "KJFK") */
  icao: string;
  /** Full airport name */
  name: string;
  /** Airport latitude in decimal degrees */
  lat: number;
  /** Airport longitude in decimal degrees */
  lon: number;
  /** Airport altitude/elevation in meters MSL */
  alt: number;
  /** Array of all runways at the airport */
  runways: Runway[];
}

/**
 * Aircraft position snapshot
 */
export interface AircraftPosition {
  /** Aircraft latitude in decimal degrees */
  lat: number;
  /** Aircraft longitude in decimal degrees */
  lon: number;
  /** Aircraft altitude in feet MSL */
  alt: number;
  /** Aircraft true heading in degrees */
  heading: number;
}

/**
 * Nearest airport data including distance and bearing from aircraft
 */
export interface NearestAirportData {
  /** Complete airport information with all runways */
  airport: Airport;
  /** Distance from aircraft to airport in nautical miles */
  distanceNM: number;
  /** True bearing from aircraft to airport in degrees (0-360) */
  bearing: number;
  /** Aircraft position when the request was made */
  aircraftPosition: AircraftPosition;
}



/**
 * Status data received from AviaConnector.
 * Note: The server's route method extracts the inner data.data object before emitting,
 * so handlers receive the flattened structure.
 */
export interface StatusData {
  /**
   * Status codes for simulator connection states:
   * - "600" - simulator connected
   * - "601" - simulator disconnected
   */
  code?: string;
  /**
   * Message describing the simulator (e.g. "MSFS Connected", "MSFS Disconnected")
   */
  message?: string;
}

export interface ErrorData {
  message: string;
}

export interface EventMap {
  listening: (info: { url: string }) => void;
  connection: (ctx: ClientContext) => void;
  disconnect: (ctx: { id: number; code?: number; reason?: string }) => void;
  error: (err: any) => void;
  AircraftData: (payload: AircraftData, ctx: ClientContext) => void;
  NearestAirport: (payload: AirportRunwayInfo, ctx: ClientContext) => void;
  NearestAirportData: (payload: NearestAirportData, ctx: ClientContext) => void;
  Status: (payload: StatusData, ctx: ClientContext) => void;
  Error: (payload: ErrorData, ctx: ClientContext) => void;
}

export type EventName = keyof EventMap;
export type EventHandler<K extends EventName = EventName> = (payload: EventMap[K], ctx: ClientContext) => void;

export interface ClientContext {
  id: number;
  remoteAddress?: string | null;
  subs: ReadonlySet<string>;
  send: (payload: unknown) => void;
  subscribe: (stream: string) => void;
  unsubscribe: (stream: string) => void;
  close: (code?: number, reason?: string) => void;
}