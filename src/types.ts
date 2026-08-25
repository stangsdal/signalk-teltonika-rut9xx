export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface TeltonikaResponse<T> {
  data: T;
  success?: boolean;
}

export interface Rut906Snapshot {
  device?: { model?: string; hardwareRevision?: string; bootloader?: string };
  system?: { uptimeSeconds?: number; localTime?: number; memory?: Record<string, number>; load?: Record<string, number> };
  modem?: { state?: string; operator?: string; networkType?: string; signal?: number; rsrp?: number; rsrq?: number; sinr?: number; temperature?: number; rxBytes?: number; txBytes?: number; simState?: string; band?: string };
  sms?: { used?: number; total?: number; messageCount?: number };
  gps?: {
    available: boolean;
    latitude?: number;
    longitude?: number;
    altitudeMeters?: number;
    accuracyMeters?: number;
    fixStatus?: number;
    timestamp?: number;
    utcTimestamp?: number;
    satellites?: number;
    speedMetersPerSecond?: number;
    angleDegrees?: number;
    reason?: string;
  };
}

export interface SignalKUpdate {
  path: string;
  value: string | number | boolean;
}
