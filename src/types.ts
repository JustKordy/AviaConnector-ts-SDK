export type ISO8601 = string;

export interface MessageEnvelope<T = unknown> {
  type: string;
  ts?: number; // unix epoch ms
  seq?: number;
  data?: T;
}

export type AviaEventType =
  | "aircraftData"
  | "landing"
  | "airport"
  | "weather"
  | "status"
  | "error"
  | "pong"
  | "heartbeat"
  | "raw";

export interface AircraftData {
  simTime?: ISO8601;
  aircraft?: {
    name?: string;
    type?: string;
    icao?: string;
  };
  position?: {
    lat: number;
    lon: number;
    altFt?: number;
  };
  attitude?: {
    pitchDeg?: number;
    rollDeg?: number;
    headingDeg?: number;
  };
  speed?: {
    iasKts?: number;
    gsKts?: number;
    tasKts?: number;
    vsFpm?: number;
  };
  engine?: {
    n1Pct?: number;
    n2Pct?: number;
    throttlePct?: number;
    rpm?: number;
  };
}

export interface LandingAnalytics {
  rateOfDescentFpm?: number;
  gForce?: number;
  runwayId?: string;
  touchdown?: {
    lat: number;
    lon: number;
    distanceFromThresholdM?: number;
    lateralOffsetM?: number;
  };
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

export interface WeatherData {
  wind?: {
    dirDeg?: number;
    speedKts?: number;
    gustKts?: number;
  };
  visibilityM?: number;
  temperatureC?: number;
  qnhHpa?: number;
  clouds?: string;
  metar?: string;
}

export interface EventMap {
  listening: (info: { url: string }) => void;
  connection: (ctx: ClientContext) => void;
  disconnect: (ctx: { id: number; code?: number; reason?: string }) => void;
  error: (err: any) => void;
  aircraftData: (payload: AircraftData, ctx: ClientContext) => void;
  landing: (payload: LandingAnalytics, ctx: ClientContext) => void;
  airport: (payload: AirportRunwayInfo, ctx: ClientContext) => void;
  weather: (payload: WeatherData, ctx: ClientContext) => void;
  status: (payload: { message: string; code?: string | number }, ctx: ClientContext) => void;
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