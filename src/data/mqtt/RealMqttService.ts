import mqtt, { type MqttClient } from 'mqtt';
import {
  buildTopics,
  classifyTopic,
  parseConfig,
  parseCounters,
  parseState,
  parseStatus,
  parseTelemetry,
  type ConfigPayload,
  type Mode,
} from '@/core/mqttTopics';
import type {
  ConnectionPhase,
  IMqttService,
  MqttConnectionConfig,
  MqttServiceEvents,
} from './IMqttService';

const CONNECT_TIMEOUT_MS = 8_000;
const INITIAL_RECONNECT_MS = 2_000;
const MAX_RECONNECT_MS = 30_000;

/**
 * Klien MQTT nyata lewat WebSocket (mqtt.js). Broker Mosquitto harus punya
 * listener websockets (lihat docs/mosquitto.conf).
 *
 * Aplikasi tidak pernah mengubah state lampu/kipas secara lokal. Semua
 * perintah hanya publish; UI menunggu `state` dari node.
 */
export class RealMqttService implements IMqttService {
  readonly kind = 'real' as const;
  private client: MqttClient | null = null;
  private events: MqttServiceEvents = {};
  private config: MqttConnectionConfig;
  private connected = false;
  private lastError: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectAttempt = 0;
  private closedByUser = false;

  constructor(config: MqttConnectionConfig) {
    this.config = config;
  }

  subscribe(events: MqttServiceEvents): () => void {
    this.events = { ...this.events, ...events };
    return () => {
      this.events = {};
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (!this.config.host) {
      this.emitConnection('error', 'Alamat broker belum diisi.');
      return;
    }
    this.closedByUser = false;
    this.reconnectAttempt = 0;
    this.emitConnection('connecting');
    await this.openClient();
  }

  private brokerUrl(): string {
    const host = this.config.host.trim().replace(/^wss?:\/\//, '').replace(/\/+$/, '');
    return `ws://${host}:${this.config.port}/mqtt`;
  }

  private async openClient(): Promise<void> {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    if (this.client) {
      this.client.removeAllListeners();
      this.client.end(true);
      this.client = null;
    }

    const url = this.brokerUrl();
    const client = mqtt.connect(url, {
      clean: true,
      // Reconnect dikelola sendiri agar bisa memakai backoff eksponensial.
      reconnectPeriod: 0,
      connectTimeout: CONNECT_TIMEOUT_MS,
      keepalive: 30,
      protocolVersion: 4,
      clientId: `smartroom-app-${Math.random().toString(16).slice(2, 10)}`,
    });
    this.client = client;

    client.on('connect', () => {
      this.connected = true;
      this.reconnectAttempt = 0;
      this.lastError = null;
      this.emitConnection('connected');
      this.resubscribe();
    });

    client.on('close', () => {
      if (this.closedByUser) return;
      if (this.connected) {
        this.connected = false;
        this.lastError = 'Koneksi broker terputus.';
      }
      this.scheduleReconnect();
    });

    client.on('error', (error: Error) => {
      if (this.closedByUser) return;
      this.lastError = error.message;
      this.connected = false;
      // Pesan error mentah (mis. ECONNREFUSED) tidak ditampilkan ke pengguna;
      // scheduleReconnect mengirim pesan yang ramah.
      this.scheduleReconnect();
    });

    client.on('message', (topic: string, payload: Buffer) => {
      this.handleMessage(topic, payload.toString('utf8'));
    });

    client.on('offline', () => {
      if (this.closedByUser) return;
      this.connected = false;
      this.scheduleReconnect();
    });
  }

  /**
   * Backoff eksponensial: 2, 4, 8, 16, lalu maksimal 30 detik. Timer hanya
   * satu agar error/close/offline tidak menumpuk percobaan.
   */
  private scheduleReconnect(): void {
    if (this.closedByUser || this.reconnectTimer) return;
    const delay = Math.min(
      MAX_RECONNECT_MS,
      INITIAL_RECONNECT_MS * 2 ** Math.min(this.reconnectAttempt, 4)
    );
    this.reconnectAttempt += 1;
    this.emitConnection(
      'reconnecting',
      this.lastError
        ? `${this.lastError} Mencoba lagi dalam ${Math.round(delay / 1000)} detik.`
        : `Broker tidak terjangkau. Mencoba lagi dalam ${Math.round(delay / 1000)} detik.`
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.closedByUser) return;
      void this.openClient();
    }, delay);
  }

  private resubscribe(): void {
    if (!this.client || !this.connected) return;
    const topics = buildTopics(this.config.topicPrefix);
    this.client.subscribe(topics.all, { qos: 1 }, (error) => {
      if (error) {
        this.events.onInvalidPayload?.(topics.all, '', `Gagal subscribe: ${error.message}`);
      }
    });
    // Retained state sering tiba tepat setelah subscribe. Jika node baru
    // kembali online tanpa publish ulang, minta status terkini dengan
    // mempublikasikan permintaan ringan? Tidak ada topik permintaan di
    // kontrak, jadi aplikasi menunggu pesan retain dari broker.
  }

  private handleMessage(topic: string, payload: string): void {
    this.events.onBrokerMessage?.(topic, payload);
    const key = classifyTopic(topic, this.config.topicPrefix);
    if (!key) return;

    switch (key) {
      case 'status': {
        const status = parseStatus(payload);
        if (!status) {
          this.reportInvalid(topic, payload, 'Status bukan online/offline.');
          return;
        }
        this.events.onNodeStatus?.(status);
        return;
      }
      case 'telemetry': {
        const telemetry = parseTelemetry(payload);
        if (!telemetry) {
          this.reportInvalid(topic, payload, 'Telemetry tidak sesuai kontrak.');
          return;
        }
        this.events.onTelemetry?.(telemetry);
        return;
      }
      case 'state': {
        const state = parseState(payload);
        if (!state) {
          this.reportInvalid(topic, payload, 'State tidak sesuai kontrak.');
          return;
        }
        this.events.onState?.(state);
        return;
      }
      case 'counters': {
        const counters = parseCounters(payload);
        if (!counters) {
          this.reportInvalid(topic, payload, 'Counters tidak sesuai kontrak.');
          return;
        }
        this.events.onCounters?.(counters);
        return;
      }
      case 'config': {
        const config = parseConfig(payload);
        if (!config) {
          this.reportInvalid(topic, payload, 'Config tidak sesuai kontrak.');
          return;
        }
        this.events.onConfig?.(config);
        return;
      }
      default:
        // cmd/* dari node tidak dipakai aplikasi.
        return;
    }
  }

  private reportInvalid(topic: string, payload: string, reason: string): void {
    this.events.onInvalidPayload?.(topic, payload, reason);
  }

  private emitConnection(phase: ConnectionPhase, detail?: string): void {
    this.events.onConnectionChange?.(phase, detail);
  }

  private publish(topic: string, payload: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.connected) {
        reject(new Error('Broker tidak tersambung.'));
        return;
      }
      this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Perintah yang butuh konfirmasi state. UI memanggil ini lalu menunggu
   * state; batas tunggu 3 detik diterapkan di store, bukan di sini.
   */
  private async sendCommand(topic: string, payload: unknown): Promise<void> {
    await this.publish(topic, payload);
  }

  async setMode(mode: Mode): Promise<void> {
    const topics = buildTopics(this.config.topicPrefix);
    await this.sendCommand(topics.cmdMode, { mode });
  }

  async setLamp(on: boolean): Promise<void> {
    const topics = buildTopics(this.config.topicPrefix);
    await this.sendCommand(topics.cmdLamp, { on });
  }

  async setFan(on: boolean): Promise<void> {
    const topics = buildTopics(this.config.topicPrefix);
    await this.sendCommand(topics.cmdFan, { on });
  }

  async publishConfig(config: ConfigPayload): Promise<void> {
    const topics = buildTopics(this.config.topicPrefix);
    await new Promise<void>((resolve, reject) => {
      if (!this.client || !this.connected) {
        reject(new Error('Broker tidak tersambung.'));
        return;
      }
      this.client.publish(topics.config, JSON.stringify(config), { qos: 1, retain: true }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async testConnection(config: MqttConnectionConfig): Promise<{ ok: boolean; message: string }> {
    const host = config.host.trim().replace(/^wss?:\/\//, '').replace(/\/+$/, '');
    if (!host) return { ok: false, message: 'Alamat broker belum diisi.' };
    const url = `ws://${host}:${config.port}/mqtt`;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok: boolean, message: string): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          probe.end(true);
        } catch {
          // Abaikan kegagalan penutupan probe.
        }
        resolve({ ok, message });
      };
      const probe = mqtt.connect(url, {
        clean: true,
        reconnectPeriod: 0,
        connectTimeout: CONNECT_TIMEOUT_MS,
        protocolVersion: 4,
        clientId: `smartroom-probe-${Math.random().toString(16).slice(2, 10)}`,
      });
      const timer = setTimeout(() => {
        finish(false, 'Waktu koneksi habis (8 detik).');
      }, CONNECT_TIMEOUT_MS);
      probe.on('connect', () => finish(true, 'Broker terjangkau.'));
      probe.on('error', (error: Error) => finish(false, error.message));
    });
  }

  async disconnect(): Promise<void> {
    this.closedByUser = true;
    this.connected = false;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    if (this.client) {
      this.client.removeAllListeners();
      this.client.end(true);
      this.client = null;
    }
    this.emitConnection('idle');
  }
}
