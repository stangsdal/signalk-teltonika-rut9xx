import https from 'node:https';
import type { Json, TeltonikaResponse } from './types';

export interface ClientOptions {
  host: string;
  username: string;
  password: string;
  port?: number;
  timeoutMs?: number;
  rejectUnauthorized?: boolean;
}

export class TeltonikaClient {
  private token?: string;
  private readonly options: Required<ClientOptions>;

  constructor(options: ClientOptions) {
    this.options = { port: 443, timeoutMs: 10000, rejectUnauthorized: true, ...options };
  }

  async login(): Promise<void> {
    const response = await this.request<{ token?: string }>('POST', '/api/login', { username: this.options.username, password: this.options.password });
    if (!response.token) throw new Error('Teltonika authentication failed');
    this.token = response.token;
  }

  async get<T extends Json>(path: string): Promise<T> {
    if (!this.token) await this.login();
    return this.request<T>('GET', path);
  }

  private request<T>(method: string, path: string, body?: Json): Promise<T> {
    return new Promise((resolve, reject) => {
      const encoded = body === undefined ? undefined : JSON.stringify(body);
      const req = https.request({ hostname: this.options.host, port: this.options.port, path, method, timeout: this.options.timeoutMs, rejectUnauthorized: this.options.rejectUnauthorized, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...(encoded ? { 'Content-Length': Buffer.byteLength(encoded) } : {}) } }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => {
          let parsed: TeltonikaResponse<T> | T;
          try { parsed = JSON.parse(text) as TeltonikaResponse<T> | T; } catch { reject(new Error(`Invalid JSON from ${path}`)); return; }
          if ((res.statusCode ?? 500) < 200 || (res.statusCode ?? 500) >= 300) { reject(new Error(`Teltonika GET failed: HTTP ${res.statusCode}`)); return; }
          const envelope = parsed as TeltonikaResponse<T>;
          if (envelope && typeof envelope === 'object' && 'success' in envelope && envelope.success === false) { reject(new Error(`Teltonika API rejected ${path}`)); return; }
          resolve(envelope && typeof envelope === 'object' && 'data' in envelope ? envelope.data : parsed as T);
        });
      });
      req.on('timeout', () => req.destroy(new Error('Teltonika request timeout')));
      req.on('error', reject);
      if (encoded) req.write(encoded);
      req.end();
    });
  }
}
