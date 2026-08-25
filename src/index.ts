import { TeltonikaClient } from './teltonika-client';
import { mapSnapshot, snapshotToUpdates } from './mappings';

module.exports = function rut906Plugin(app: any) {
  let timer: NodeJS.Timeout | undefined;
  let client: TeltonikaClient;
  const plugin = {
    id: 'signalk-teltonika-rut906',
    name: 'Teltonika RUT906',
    schema: {
      type: 'object', required: ['host', 'username', 'password'],
      properties: { host: { type: 'string', default: '192.168.15.1' }, port: { type: 'number', default: 443, minimum: 1, maximum: 65535 }, username: { type: 'string', default: 'signalk' }, password: { type: 'string', title: 'API password', format: 'password' }, pollIntervalMs: { type: 'number', default: 30000, minimum: 5000 }, timeoutMs: { type: 'number', default: 10000, minimum: 1000 }, rejectUnauthorized: { type: 'boolean', default: true, title: 'Verify TLS certificate' } }
    },
    start: (options: any) => {
      client = new TeltonikaClient({ host: options.host, username: options.username, password: options.password, port: options.port, timeoutMs: options.timeoutMs, rejectUnauthorized: options.rejectUnauthorized });
      const safeGet = async (path: string) => {
        try { return await client.get<any>(path); } catch { return undefined; }
      };
      const poll = async () => {
        try {
          const [device, usage, modems, smsStorage, smsMessages, gps] = await Promise.all([
            safeGet('/api/system/device/status'), safeGet('/api/system/device/usage/status'), safeGet('/api/modems/status'), safeGet('/api/messages/storage/status'), safeGet('/api/messages/status'), safeGet('/api/gps/position/status')
          ]);
          const snapshot = mapSnapshot(device, usage, modems, smsStorage, smsMessages, gps);
          app.handleMessage(plugin.id, { updates: [{ source: { label: 'teltonika.rut906' }, values: snapshotToUpdates(snapshot) }] });
          app.setPluginStatus?.('Running');
        } catch (error: any) { app.setPluginError?.(`RUT906 read-only poll failed: ${error.message}`); }
      };
      void poll();
      timer = setInterval(poll, options.pollIntervalMs ?? 30000);
    },
    stop: () => { if (timer) clearInterval(timer); timer = undefined; },
    statusMessage: 'Read-only monitoring with GPS position polling; SMS sending remains disabled.'
  };
  return plugin;
};
