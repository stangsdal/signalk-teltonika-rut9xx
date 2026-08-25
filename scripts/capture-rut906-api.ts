#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';

const host = process.env.TELTONIKA_HOST ?? '192.168.15.1';
const username = process.env.TELTONIKA_USER ?? 'signalk';
const outputDir = path.resolve(__dirname, '../../docs/teltonika-rut906-api-evidence');
const agent = new https.Agent({ rejectUnauthorized: false });

interface Endpoint {
  file: string;
  name: string;
  path: string;
}

interface HttpResponse {
  status?: number;
  data: any;
}

const endpoints: Endpoint[] = [
  { file: 'device-info.json', name: 'system device status', path: '/api/system/device/status' },
  { file: 'status.json', name: 'system usage status', path: '/api/system/device/usage/status' },
  { file: 'status.json', name: 'modem status', path: '/api/modems/status' },
  { file: 'status.json', name: 'modem signal status', path: '/api/modems/signal/status' },
  { file: 'status.json', name: 'SIM status', path: '/api/sim_cards/status' },
  { file: 'status.json', name: 'network device status', path: '/api/network/devices/status' },
  { file: 'gps.json', name: 'GNSS status', path: '/api/location/gnss/status' },
  { file: 'gps.json', name: 'GPS status', path: '/api/gps/status' },
  { file: 'gps.json', name: 'GPS position status', path: '/api/gps/position/status' },
  { file: 'gps.json', name: 'GPS NMEA status', path: '/api/gps/nmea/status' },
  { file: 'gps.json', name: 'GPS global status', path: '/api/gps/global' },
  { file: 'gps.json', name: 'GNSS device status', path: '/api/gnss/status' },
  { file: 'sms-status.json', name: 'SMS storage status', path: '/api/messages/storage/status' },
  { file: 'sms-status.json', name: 'SMS messages status', path: '/api/messages/status' },
];

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const input = process.stdin;
    process.stdout.write(question);
    input.setRawMode?.(true);
    let value = '';
    const onData = (chunk: Buffer) => {
      const character = chunk.toString();
      if (character === '\u0003') process.exit(130);
      if (character === '\r' || character === '\n') {
        input.setRawMode?.(false);
        input.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (character === '\u007f') value = value.slice(0, -1);
      else value += character;
    };
    input.on('data', onData);
  });
}

function request(method: string, requestPath: string, token?: string, body?: object): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const requestBody = body ? JSON.stringify(body) : undefined;
    const req = https.request({ hostname: host, port: 443, path: requestPath, method, agent, timeout: 10000, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(requestBody ? { 'Content-Length': Buffer.byteLength(requestBody) } : {}) } }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => { text += chunk; });
      response.on('end', () => {
        let data: any;
        try { data = text ? JSON.parse(text) : null; } catch { data = { rawResponse: '[non-JSON response]' }; }
        resolve({ status: response.statusCode, data });
      });
    });
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    if (requestBody) req.write(requestBody);
    req.end();
  });
}

const sensitiveKey = /(password|passwd|token|secret|authorization|cookie|imei|imsi|iccid|serial|mac|phone|sender|recipient|number|message|body|content|public.?ip)/i;
function sanitize(value: any, key = ''): any {
  if (sensitiveKey.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  return value;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.writeFile(path.join(outputDir, file), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function main(): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`Connecting to ${host} as ${username} (read-only capture)`);
  const password = process.env.TELTONIKA_PASSWORD ?? await promptHidden('Password: ');
  const login = await request('POST', '/api/login', undefined, { username, password });
  if ((login.status ?? 500) < 200 || (login.status ?? 500) >= 300 || !login.data?.data?.token) throw new Error(`Login failed with HTTP ${login.status}`);
  const token = login.data.data.token as string;
  const capabilities: Array<Record<string, unknown>> = [];
  const captures = new Map<string, { capturedAt: string; endpoints: Record<string, unknown> }>();
  for (const endpoint of endpoints) {
    try {
      const response = await request('GET', endpoint.path, token);
      const ok = (response.status ?? 500) >= 200 && (response.status ?? 500) < 300 && response.data?.success !== false;
      console.log(JSON.stringify(endpoint.path, null, 2));
      // Keep captures on disk (after sanitization) without echoing raw API
      // responses, which may contain fields that should not enter logs.
      capabilities.push({ name: endpoint.name, path: endpoint.path, method: 'GET', httpStatus: response.status, supported: ok });
      if (ok) {
        const existing = captures.get(endpoint.file) ?? { capturedAt: new Date().toISOString(), endpoints: {} };
        existing.endpoints[endpoint.path] = sanitize(response.data);
        captures.set(endpoint.file, existing);
      }
    } catch (error: any) { capabilities.push({ name: endpoint.name, path: endpoint.path, method: 'GET', supported: false, error: error.message }); }
  }
  for (const [file, value] of captures) await writeJson(file, value);
  await writeJson('api-capabilities.json', { capturedAt: new Date().toISOString(), host, endpoints: capabilities });
  console.log(`Captured ${captures.size} evidence files. Review redactions before committing.`);
}

main().catch((error: Error) => { console.error(`Capture failed: ${error.message}`); process.exitCode = 1; });
