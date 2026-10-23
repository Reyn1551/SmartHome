import type { Settings } from '@/store/settingsTypes';
import type { ConfigPayload } from '@/core/mqttTopics';

/**
 * Penyimpanan riwayat lokal (SQLite di perangkat, memori saat web).
 * Antarmuka ini menjaga repository tetap bisa diuji tanpa native module.
 */
export interface TelemetryRow {
  ts: number;
  temp: number | null;
  hum: number | null;
  ldr: number | null;
  presence: string | null;
}

export interface CounterRow {
  day: string;
  lamp_on_s: number;
  fan_on_s: number;
  occupied_s: number;
  updated_ts: number;
}

export interface RangeQuery {
  fromTs: number;
  toTs: number;
}

export interface TelemetryBucket {
  bucketTs: number;
  temp: number | null;
  hum: number | null;
  samples: number;
}

export interface CounterBlock {
  bucketTs: number;
  lampOnS: number;
  fanOnS: number;
}

export interface DailyTotals {
  lampOnS: number;
  fanOnS: number;
  occupiedS: number;
  days: number;
}

export interface HistoryStore {
  init(): Promise<void>;
  insertTelemetry(row: TelemetryRow): Promise<void>;
  upsertCounters(row: CounterRow): Promise<void>;
  /** Rata-rata telemetry per bucket, bucket berukuran tetap. */
  queryTelemetry(range: RangeQuery, bucketMs: number): Promise<TelemetryBucket[]>;
  /** Selisih counters per blok. Hanya blok yang memiliki data yang dikembalikan. */
  queryCounterBlocks(range: RangeQuery, bucketMs: number): Promise<CounterBlock[]>;
  /** Total counters pada rentang, dihitung dari delta harian. */
  queryTotals(range: RangeQuery): Promise<DailyTotals>;
  pruneBefore(cutoffTs: number): Promise<void>;
  close(): Promise<void>;
}

const DAY_MS = 86_400_000;
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * DAY_MS;

/** Rentang tanggal untuk query counters: day adalah tanggal lokal "YYYY-MM-DD". */
export function isoDayToTs(day: string): number {
  const [year, month, date] = day.split('-').map((part) => Number(part));
  if (!year || !month || !date) return 0;
  return new Date(year, month - 1, date).getTime();
}

export function retentionCutoff(now: number): number {
  return now - RETENTION_MS;
}

export function settingsToConfigPayload(settings: Settings): ConfigPayload {
  return settings.ruleConfig;
}
