import type {
  ConfigPayload,
  CountersPayload,
  Mode,
  NodeStatus,
  StatePayload,
  TelemetryPayload,
} from '@/core/mqttTopics';

export type ConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'demo';

export type NodePhase = 'unknown' | 'online' | 'offline';

export interface MqttConnectionConfig {
  host: string;
  port: number;
  topicPrefix: string;
}

/** Semua callback dipanggil dari klien; UI berlangganan lewat store. */
export interface MqttServiceEvents {
  onConnectionChange?: (phase: ConnectionPhase, detail?: string) => void;
  onNodeStatus?: (status: NodeStatus) => void;
  onTelemetry?: (payload: TelemetryPayload) => void;
  onState?: (payload: StatePayload) => void;
  onCounters?: (payload: CountersPayload) => void;
  onConfig?: (payload: ConfigPayload) => void;
  onBrokerMessage?: (topic: string, payload: string) => void;
  onInvalidPayload?: (topic: string, payload: string, reason: string) => void;
}

/**
 * Antarmuka yang sama untuk MQTT nyata dan DemoSimulator. UI tidak boleh tahu
 * implementasi mana yang aktif.
 */
export interface IMqttService {
  readonly kind: 'real' | 'demo';
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setMode(mode: Mode): Promise<void>;
  setLamp(on: boolean): Promise<void>;
  setFan(on: boolean): Promise<void>;
  publishConfig(config: ConfigPayload): Promise<void>;
  /** Uji koneksi singkat tanpa mengubah koneksi utama. */
  testConnection(config: MqttConnectionConfig): Promise<{ ok: boolean; message: string }>;
  isConnected(): boolean;
  /** Mode demo memakai waktu simulasi dan tidak menunggu broker. */
  subscribe(events: MqttServiceEvents): () => void;
}
