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



export interface StatusData {
  data?: {
    /**
   * Status codes for simulator connection states:
   * - "600" - simulator connected
   * - "601" - simulator disconnected
   */
  code?: string;
  
  /**
   * Message describing the simulator:
   * - "MSFS" - Microsoft Flight Simulator is connected
   * - May vary depending on implementation or simulator type
   * 
   * Note: In some AviaConnector messages, the message might be at the
   * top level of the envelope rather than inside the data object
   */
  message?: string;
  }
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