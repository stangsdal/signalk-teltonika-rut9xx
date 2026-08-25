import type { Rut906Snapshot, SignalKUpdate } from './types';

/** Convert raw RUTOS responses into a transport-independent diagnostic snapshot.
 *
 * RutOS returns many numeric fields as strings, so GPS values are normalized
 * here before they reach Signal K. Missing optional endpoints remain harmless.
 */
export function mapSnapshot(device: any, usage: any, modems: any[], smsStorage: any[], smsMessages: any[], gps: any): Rut906Snapshot {
  const modem = modems?.[0] ?? {};
  const storage = smsStorage?.[0] ?? {};
  const position = gps ?? {};
  const number = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
    return undefined;
  };
  const latitude = number(position.latitude);
  const longitude = number(position.longitude);
  const hasPosition = latitude !== undefined && longitude !== undefined;
  return {
    device: { model: device?.mnfinfo?.name, hardwareRevision: device?.mnfinfo?.hwver, bootloader: device?.mnfinfo?.blver },
    system: { uptimeSeconds: usage?.uptime_seconds, localTime: usage?.localtime, memory: usage?.memory, load: usage?.load },
    modem: { state: modem.state, operator: modem.operator ?? modem.provider, networkType: modem.ntype, signal: modem.signal, rsrp: modem.rsrp, rsrq: modem.rsrq, sinr: modem.sinr, temperature: modem.temperature, rxBytes: modem.rxbytes, txBytes: modem.txbytes, simState: modem.simstate, band: modem.band },
    sms: { used: storage.used, total: storage.total, messageCount: Array.isArray(smsMessages) ? smsMessages.length : undefined },
    gps: {
      available: hasPosition,
      latitude,
      longitude,
      altitudeMeters: number(position.altitude),
      accuracyMeters: number(position.accuracy),
      fixStatus: number(position.fix_status),
      timestamp: number(position.timestamp),
      utcTimestamp: number(position.utc_timestamp),
      satellites: number(position.satellites),
      speedMetersPerSecond: number(position.speed),
      angleDegrees: number(position.angle),
      ...(hasPosition ? {} : { reason: 'No GPS position response data' })
    }
  };
}

function add(updates: SignalKUpdate[], path: string, value: unknown): void {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') updates.push({ path, value });
}

export function snapshotToUpdates(snapshot: Rut906Snapshot): SignalKUpdate[] {
  const updates: SignalKUpdate[] = [];
  const base = 'networking.teltonika.rut906';
  add(updates, `${base}.connection.state`, 'connected');
  add(updates, `${base}.system.model`, snapshot.device?.model);
  add(updates, `${base}.system.hardwareRevision`, snapshot.device?.hardwareRevision);
  add(updates, `${base}.system.bootloader`, snapshot.device?.bootloader);
  add(updates, `${base}.system.uptimeSeconds`, snapshot.system?.uptimeSeconds);
  add(updates, `${base}.system.localTime`, snapshot.system?.localTime);
  add(updates, `${base}.system.memory.ramPercentage`, snapshot.system?.memory?.ram_percentage);
  add(updates, `${base}.system.memory.flashPercentage`, snapshot.system?.memory?.flash_percentage);
  add(updates, `${base}.cellular.state`, snapshot.modem?.state);
  add(updates, `${base}.cellular.operator`, snapshot.modem?.operator);
  add(updates, `${base}.cellular.networkType`, snapshot.modem?.networkType);
  add(updates, `${base}.cellular.signal`, snapshot.modem?.signal);
  add(updates, `${base}.cellular.rsrp`, snapshot.modem?.rsrp);
  add(updates, `${base}.cellular.rsrq`, snapshot.modem?.rsrq);
  add(updates, `${base}.cellular.sinr`, snapshot.modem?.sinr);
  add(updates, `${base}.cellular.temperature`, snapshot.modem?.temperature);
  add(updates, `${base}.cellular.rxBytes`, snapshot.modem?.rxBytes);
  add(updates, `${base}.cellular.txBytes`, snapshot.modem?.txBytes);
  add(updates, `${base}.cellular.simState`, snapshot.modem?.simState);
  add(updates, `${base}.cellular.band`, snapshot.modem?.band);
  add(updates, `${base}.sms.used`, snapshot.sms?.used);
  add(updates, `${base}.sms.total`, snapshot.sms?.total);
  add(updates, `${base}.sms.messageCount`, snapshot.sms?.messageCount);
  add(updates, `${base}.gps.available`, snapshot.gps?.available);
  if (snapshot.gps?.available) {
    // Signal K positions are decimal degrees; speed is metres per second.
    // RutOS accuracy is published as the GNSS horizontal dilution value used
    // by the existing RUT906 API capture.
    add(updates, 'navigation.position.latitude', snapshot.gps.latitude);
    add(updates, 'navigation.position.longitude', snapshot.gps.longitude);
    add(updates, 'navigation.gnss.altitude', snapshot.gps.altitudeMeters);
    add(updates, 'navigation.gnss.horizontalDilution', snapshot.gps.accuracyMeters);
    add(updates, 'navigation.gnss.satellites', snapshot.gps.satellites);
    add(updates, 'navigation.speedOverGround', snapshot.gps.speedMetersPerSecond);
    add(updates, `${base}.gps.fixStatus`, snapshot.gps.fixStatus);
    add(updates, `${base}.gps.timestamp`, snapshot.gps.timestamp);
    add(updates, `${base}.gps.utcTimestamp`, snapshot.gps.utcTimestamp);
    add(updates, `${base}.gps.accuracyMeters`, snapshot.gps.accuracyMeters);
  }
  return updates;
}
