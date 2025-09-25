export type ISO8601 = string;

export interface MessageEnvelope<T = unknown> {
  type: string;
  ts?: number; // unix epoch ms
  seq?: number;
  data?: T;
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
  | "Raw";

export interface AircraftData {
  Aircraft?: {
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


export interface EventMap {
  listening: (info: { url: string }) => void;
  connection: (ctx: ClientContext) => void;
  disconnect: (ctx: { id: number; code?: number; reason?: string }) => void;
  error: (err: any) => void;
  AircraftData: (payload: AircraftData, ctx: ClientContext) => void;
  NearestAirport: (payload: AirportRunwayInfo, ctx: ClientContext) => void;
  Status: (payload: {code?: string, message?: string }, ctx: ClientContext) => void;
  // If there's both generic "error" and typed error contexts, disambiguate as needed
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