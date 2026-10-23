import { Platform } from 'react-native';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type {
  CounterBlock,
  CounterRow,
  DailyTotals,
  HistoryStore,
  RangeQuery,
  TelemetryBucket,
  TelemetryRow,
} from './repository';
import { isoDayToTs, retentionCutoff } from './repository';

/**
 * Implementasi SQLite memakai expo-sqlite. Di web (dipakai untuk pratinjau
 * tata letak) modul native tidak tersedia, jadi kelas ini memakai penyimpanan
 * memori dengan antarmuka yang sama. Android selalu memakai SQLite.
 */

class SqliteHistoryStore implements HistoryStore {
  private dbPromise: Promise<SQLiteDatabase> | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    const db = await this.getDb();
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS telemetry (
        ts INTEGER PRIMARY KEY,
        temp REAL,
        hum REAL,
        ldr INTEGER,
        presence TEXT
      );
      CREATE TABLE IF NOT EXISTS counters (
        day TEXT PRIMARY KEY,
        lamp_on_s REAL NOT NULL,
        fan_on_s REAL NOT NULL,
        occupied_s REAL NOT NULL,
        updated_ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(ts);
    `);
  }

  private async getDb(): Promise<SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDatabaseAsync('smartroom.db');
    }
    return this.dbPromise;
  }

  async insertTelemetry(row: TelemetryRow): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO telemetry (ts, temp, hum, ldr, presence) VALUES (?, ?, ?, ?, ?)',
      row.ts,
      row.temp,
      row.hum,
      row.ldr,
      row.presence
    );
  }

  async upsertCounters(row: CounterRow): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO counters (day, lamp_on_s, fan_on_s, occupied_s, updated_ts)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET
         lamp_on_s = excluded.lamp_on_s,
         fan_on_s = excluded.fan_on_s,
         occupied_s = excluded.occupied_s,
         updated_ts = excluded.updated_ts`,
      row.day,
      row.lamp_on_s,
      row.fan_on_s,
      row.occupied_s,
      row.updated_ts
    );
  }

  async queryTelemetry(range: RangeQuery, bucketMs: number): Promise<TelemetryBucket[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{
      bucket: number;
      temp: number | null;
      hum: number | null;
      samples: number;
    }>(
      `SELECT (ts / ?) * ? AS bucket,
              AVG(temp) AS temp,
              AVG(hum) AS hum,
              COUNT(*) AS samples
       FROM telemetry
       WHERE ts >= ? AND ts <= ? AND (temp IS NOT NULL OR hum IS NOT NULL)
       GROUP BY bucket
       ORDER BY bucket ASC`,
      bucketMs,
      bucketMs,
      range.fromTs,
      range.toTs
    );
    return rows.map((row) => ({
      bucketTs: row.bucket,
      temp: typeof row.temp === 'number' ? row.temp : null,
      hum: typeof row.hum === 'number' ? row.hum : null,
      samples: row.samples,
    }));
  }

  async queryCounterBlocks(range: RangeQuery, bucketMs: number): Promise<CounterBlock[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<CounterRow>(
      'SELECT * FROM counters WHERE updated_ts >= ? AND updated_ts <= ? ORDER BY day ASC',
      range.fromTs,
      range.toTs
    );
    // Untuk rentang harian, blok mengikuti tanggal lokal; untuk 24 jam,
    // counter per hari digabung ke blok jam berjalan agar grafik tetap terisi.
    return buildCounterBlocks(rows, range, bucketMs);
  }

  async queryTotals(range: RangeQuery): Promise<DailyTotals> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<CounterRow>(
      'SELECT * FROM counters WHERE updated_ts >= ? AND updated_ts <= ? ORDER BY day ASC',
      range.fromTs,
      range.toTs
    );
    return sumCounterRows(rows);
  }

  async pruneBefore(cutoffTs: number): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM telemetry WHERE ts < ?', cutoffTs);
    const cutoffDay = new Date(cutoffTs).toISOString().slice(0, 10);
    await db.runAsync('DELETE FROM counters WHERE day < ?', cutoffDay);
  }

  async close(): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    await db.closeAsync();
    this.dbPromise = null;
    this.initPromise = null;
  }
}

/**
 * Counter dari firmware adalah total per hari (bukan kumulatif lintas hari).
 * Satu baris = satu blok harian. Untuk rentang 24 jam hanya ada satu blok
 * (hari ini), karena firmware tidak mengirim histori per jam.
 */
export function buildCounterBlocks(
  rows: CounterRow[],
  range: RangeQuery,
  bucketMs: number
): CounterBlock[] {
  if (rows.length === 0) return [];
  const buckets = new Map<number, CounterBlock>();

  for (const row of rows) {
    const dayTs = isoDayToTs(row.day);
    const bucketTs = Math.floor(dayTs / bucketMs) * bucketMs;
    const existing = buckets.get(bucketTs);
    if (existing) {
      existing.lampOnS += row.lamp_on_s;
      existing.fanOnS += row.fan_on_s;
    } else {
      buckets.set(bucketTs, {
        bucketTs,
        lampOnS: row.lamp_on_s,
        fanOnS: row.fan_on_s,
      });
    }
  }

  const from = Math.floor(range.fromTs / bucketMs) * bucketMs;
  return Array.from(buckets.values())
    .filter((block) => block.bucketTs >= from)
    .sort((a, b) => a.bucketTs - b.bucketTs);
}

export function sumCounterRows(rows: CounterRow[]): DailyTotals {
  let lampOnS = 0;
  let fanOnS = 0;
  let occupiedS = 0;
  for (const row of rows) {
    lampOnS += Math.max(0, row.lamp_on_s);
    fanOnS += Math.max(0, row.fan_on_s);
    occupiedS += Math.max(0, row.occupied_s);
  }
  return { lampOnS, fanOnS, occupiedS, days: rows.length };
}

class MemoryHistoryStore implements HistoryStore {
  private telemetry: TelemetryRow[] = [];
  private counters: Map<string, CounterRow> = new Map();

  async init(): Promise<void> {
    // Tidak ada yang perlu disiapkan.
  }

  async insertTelemetry(row: TelemetryRow): Promise<void> {
    this.telemetry.push(row);
    if (this.telemetry.length > 20_000) {
      this.telemetry = this.telemetry.slice(-20_000);
    }
  }

  async upsertCounters(row: CounterRow): Promise<void> {
    this.counters.set(row.day, row);
  }

  async queryTelemetry(range: RangeQuery, bucketMs: number): Promise<TelemetryBucket[]> {
    const buckets = new Map<number, { temp: number[]; hum: number[] }>();
    for (const row of this.telemetry) {
      if (row.ts < range.fromTs || row.ts > range.toTs) continue;
      if (row.temp === null && row.hum === null) continue;
      const bucketTs = Math.floor(row.ts / bucketMs) * bucketMs;
      const bucket = buckets.get(bucketTs) ?? { temp: [], hum: [] };
      if (row.temp !== null) bucket.temp.push(row.temp);
      if (row.hum !== null) bucket.hum.push(row.hum);
      buckets.set(bucketTs, bucket);
    }
    return Array.from(buckets.entries())
      .map(([bucketTs, values]) => ({
        bucketTs,
        temp: average(values.temp),
        hum: average(values.hum),
        samples: Math.max(values.temp.length, values.hum.length),
      }))
      .sort((a, b) => a.bucketTs - b.bucketTs);
  }

  async queryCounterBlocks(range: RangeQuery, bucketMs: number): Promise<CounterBlock[]> {
    const rows = Array.from(this.counters.values())
      .filter((row) => row.updated_ts >= range.fromTs && row.updated_ts <= range.toTs)
      .sort((a, b) => a.day.localeCompare(b.day));
    // Untuk rentang harian, blok mengikuti tanggal lokal; untuk 24 jam,
    // counter per hari digabung ke blok jam berjalan agar grafik tetap terisi.
    return buildCounterBlocks(rows, range, bucketMs);
  }

  async queryTotals(range: RangeQuery): Promise<DailyTotals> {
    const rows = Array.from(this.counters.values())
      .filter((row) => row.updated_ts >= range.fromTs && row.updated_ts <= range.toTs)
      .sort((a, b) => a.day.localeCompare(b.day));
    return sumCounterRows(rows);
  }

  async pruneBefore(cutoffTs: number): Promise<void> {
    this.telemetry = this.telemetry.filter((row) => row.ts >= cutoffTs);
    const cutoffDay = new Date(cutoffTs).toISOString().slice(0, 10);
    for (const day of Array.from(this.counters.keys())) {
      if (day < cutoffDay) this.counters.delete(day);
    }
  }

  async close(): Promise<void> {
    this.telemetry = [];
    this.counters.clear();
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

let storeInstance: HistoryStore | null = null;

export function getHistoryStore(): HistoryStore {
  if (!storeInstance) {
    storeInstance = Platform.OS === 'web' ? new MemoryHistoryStore() : new SqliteHistoryStore();
  }
  return storeInstance;
}

/** Dipakai di tes dan pratinjau web untuk mengosongkan penyimpanan. */
export async function resetHistoryStoreForTests(): Promise<void> {
  if (storeInstance) await storeInstance.close();
  storeInstance = null;
}

export { retentionCutoff };
