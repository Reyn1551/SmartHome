/**
 * Kontrak topik MQTT Smart Room. Firmware ESP32 wajib mengikuti nama, arah,
 * dan bentuk payload di sini. Salinan dokumentasi: docs/MQTT.md.
 *
 * Prefix default `smartroom/node1`, dapat diubah di Pengaturan.
 * Semua payload JSON UTF-8.
 */

export const DEFAULT_TOPIC_PREFIX = 'smartroom/node1';

export const TOPIC_SUFFIX = {
  status: 'status',
  telemetry: 'telemetry',
  state: 'state',
  counters: 'counters',
  cmdMode: 'cmd/mode',
  cmdLamp: 'cmd/lamp',
  cmdFan: 'cmd/fan',
  config: 'config',
} as const;

export type TopicKey = keyof typeof TOPIC_SUFFIX;

export interface MqttTopics {
  status: string;
  telemetry: string;
  state: string;
  counters: string;
  cmdMode: string;
  cmdLamp: string;
  cmdFan: string;
  config: string;
  /** Wildcard untuk subscribe semua topik node. */
  all: string;
}

/** Normalisasi prefix: buang spasi, garis miring di ujung, dan garis miring ganda. */
export function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '');
  const cleaned = trimmed.replace(/\/{2,}/g, '/');
  return cleaned.length > 0 ? cleaned : DEFAULT_TOPIC_PREFIX;
}

export function buildTopics(prefix: string): MqttTopics {
  const base = normalizePrefix(prefix);
  return {
    status: `${base}/${TOPIC_SUFFIX.status}`,
    telemetry: `${base}/${TOPIC_SUFFIX.telemetry}`,
    state: `${base}/${TOPIC_SUFFIX.state}`,
    counters: `${base}/${TOPIC_SUFFIX.counters}`,
    cmdMode: `${base}/${TOPIC_SUFFIX.cmdMode}`,
    cmdLamp: `${base}/${TOPIC_SUFFIX.cmdLamp}`,
    cmdFan: `${base}/${TOPIC_SUFFIX.cmdFan}`,
    config: `${base}/${TOPIC_SUFFIX.config}`,
    all: `${base}/#`,
  };
}

/** Payload status node. Bukan JSON string berisi JSON. */
export type NodeStatus = 'online' | 'offline';

export type Presence = 'terisi' | 'mungkin_kosong' | 'kosong';
export type Mode = 'auto' | 'manual';

export interface TelemetryPayload {
  ts: number;
  temp: number | null;
  hum: number | null;
  ldr: number | null;
  presence: Presence | null;
  dist_cm?: number | null;
}

export interface StatePayload {
  mode: Mode;
  lamp: boolean;
  fan: boolean;
  occ_since: number | null;
  empty_for_s: number;
}

export interface CountersPayload {
  day: string;
  lamp_on_s: number;
  fan_on_s: number;
  occupied_s: number;
}

export interface ConfigPayload {
  fan_on_c: number;
  fan_off_c: number;
  empty_timeout_s: number;
  dark_adc: number;
  lamp_rule: boolean;
  fan_rule: boolean;
  autooff_rule: boolean;
}

export interface ModeCommandPayload {
  mode: Mode;
}

export interface OnOffCommandPayload {
  on: boolean;
}

/** Topik yang di-subscribe aplikasi (semua topik node, termasuk cmd untuk uji). */
export const SUBSCRIBE_TOPICS = (prefix: string): string[] => [buildTopics(prefix).all];

export const DEFAULT_CONFIG: ConfigPayload = {
  fan_on_c: 28,
  fan_off_c: 26,
  empty_timeout_s: 300,
  dark_adc: 1200,
  lamp_rule: true,
  fan_rule: true,
  autooff_rule: true,
};

/**
 * Parser defensif. Mengembalikan null bila payload bukan JSON yang sesuai.
 * Jangan pernah melempar ke UI; pemanggil mencatat payload rusak.
 */
export function parseJsonObject(payload: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function isPresence(value: unknown): value is Presence {
  return value === 'terisi' || value === 'mungkin_kosong' || value === 'kosong';
}

function isMode(value: unknown): value is Mode {
  return value === 'auto' || value === 'manual';
}

export function parseTelemetry(payload: string): TelemetryPayload | null {
  const raw = parseJsonObject(payload);
  if (!raw) return null;
  const ts = finiteOrNull(raw.ts);
  if (ts === null) return null;
  return {
    ts,
    temp: finiteOrNull(raw.temp),
    hum: finiteOrNull(raw.hum),
    ldr: finiteOrNull(raw.ldr),
    presence: isPresence(raw.presence) ? raw.presence : null,
    dist_cm: finiteOrNull(raw.dist_cm),
  };
}

export function parseState(payload: string): StatePayload | null {
  const raw = parseJsonObject(payload);
  if (!raw) return null;
  if (!isMode(raw.mode) || typeof raw.lamp !== 'boolean' || typeof raw.fan !== 'boolean') {
    return null;
  }
  return {
    mode: raw.mode,
    lamp: raw.lamp,
    fan: raw.fan,
    occ_since: finiteOrNull(raw.occ_since),
    empty_for_s: Math.max(0, finiteOrNull(raw.empty_for_s) ?? 0),
  };
}

export function parseCounters(payload: string): CountersPayload | null {
  const raw = parseJsonObject(payload);
  if (!raw) return null;
  if (typeof raw.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) return null;
  const lamp = finiteOrNull(raw.lamp_on_s);
  const fan = finiteOrNull(raw.fan_on_s);
  const occupied = finiteOrNull(raw.occupied_s);
  if (lamp === null || fan === null || occupied === null) return null;
  return {
    day: raw.day,
    lamp_on_s: Math.max(0, lamp),
    fan_on_s: Math.max(0, fan),
    occupied_s: Math.max(0, occupied),
  };
}

export function parseConfig(payload: string): ConfigPayload | null {
  const raw = parseJsonObject(payload);
  if (!raw) return null;
  const fanOn = finiteOrNull(raw.fan_on_c);
  const fanOff = finiteOrNull(raw.fan_off_c);
  const empty = finiteOrNull(raw.empty_timeout_s);
  const dark = finiteOrNull(raw.dark_adc);
  if (fanOn === null || fanOff === null || empty === null || dark === null) return null;
  return {
    fan_on_c: fanOn,
    fan_off_c: fanOff,
    empty_timeout_s: empty,
    dark_adc: dark,
    lamp_rule: raw.lamp_rule !== false,
    fan_rule: raw.fan_rule !== false,
    autooff_rule: raw.autooff_rule !== false,
  };
}

/** Payload status: string "online"/"offline". */
export function parseStatus(payload: string): NodeStatus | null {
  const text = payload.trim().replace(/^"|"$/g, '');
  if (text === 'online' || text === 'offline') return text;
  return null;
}

/** Tentukan jenis topik dari path lengkap, dipakai oleh router pesan. */
export function classifyTopic(topic: string, prefix: string): TopicKey | null {
  const base = normalizePrefix(prefix);
  if (!topic.startsWith(`${base}/`)) return null;
  const rest = topic.slice(base.length + 1);
  const entries = Object.entries(TOPIC_SUFFIX) as [TopicKey, string][];
  for (const [key, suffix] of entries) {
    if (rest === suffix) return key;
  }
  return null;
}
