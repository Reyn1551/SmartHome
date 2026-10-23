import {
  DEFAULT_CONFIG,
  type ConfigPayload,
  type CountersPayload,
  type Mode,
  type StatePayload,
  type TelemetryPayload,
} from '@/core/mqttTopics';
import { evaluateRules, type RuleState, type RuleTelemetry } from '@/domain/ruleEvaluator';
import type {
  ConnectionPhase,
  IMqttService,
  MqttConnectionConfig,
  MqttServiceEvents,
} from './IMqttService';
import type { CounterBlock, TelemetryBucket } from '@/data/repository';

interface SimulatorOptions {
  /** Interval simulasi; default 5 detik sesuai kontrak. */
  tickMs?: number;
  /** Waktu awal, bisa diinjeksi di tes. */
  startTs?: number;
  random?: () => number;
}

/**
 * Simulator Mode Demo. Tidak mengakses jaringan dan tidak memakai MQTT.
 * Semua data di sini adalah data contoh; UI menampilkan banner bahwa data
 * bukan dari perangkat.
 *
 * Perilaku mengikuti tiga aturan firmware:
 * - lampu menyala saat terisi dan ADC <= dark_adc,
 * - kipas hysteresis 28/26°C,
 * - auto-off setelah kosong selama empty_timeout_s.
 */
export class DemoSimulator implements IMqttService {
  readonly kind = 'demo' as const;
  private events: MqttServiceEvents = {};
  private timer: ReturnType<typeof setInterval> | undefined;
  private tickMs: number;
  private now: number;
  private random: () => number;
  private connected = false;

  private temp = 27.2;
  private hum = 62;
  private ldr = 900;
  private presence: 'terisi' | 'mungkin_kosong' | 'kosong' = 'terisi';
  private presencePhaseMs = 0;
  private phaseDurationMs = 45_000;
  private phaseIndex = 0;
  private startedAt: number;
  private emptyPhaseDurationMs = 330_000;

  private mode: Mode = 'auto';
  private lamp = false;
  private fan = false;
  private occSince: number;
  private emptyForS = 0;
  private config: ConfigPayload = { ...DEFAULT_CONFIG };

  private countersDay: string;
  private lampOnS = 0;
  private fanOnS = 0;
  private occupiedS = 0;
  private dayStartMs: number;

  constructor(options: SimulatorOptions = {}) {
    this.tickMs = options.tickMs ?? 5000;
    this.random = options.random ?? Math.random;
    this.now = options.startTs ?? Date.now();
    this.startedAt = this.now;
    this.occSince = this.now;
    this.dayStartMs = startOfDay(this.now);
    this.countersDay = isoDay(this.now);
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
    this.connected = true;
    this.events.onConnectionChange?.('demo');
    this.events.onNodeStatus?.('online');
    this.emitState();
    this.emitCounters();
    this.emitTelemetry();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  async disconnect(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    this.connected = false;
    this.events.onConnectionChange?.('idle');
  }

  async setMode(mode: Mode): Promise<void> {
    this.mode = mode;
    this.emitState();
  }

  async setLamp(on: boolean): Promise<void> {
    if (this.mode !== 'manual') return;
    this.lamp = on;
    this.emitState();
  }

  async setFan(on: boolean): Promise<void> {
    if (this.mode !== 'manual') return;
    this.fan = on;
    this.emitState();
  }

  async publishConfig(config: ConfigPayload): Promise<void> {
    this.config = { ...config };
    this.events.onConfig?.(this.config);
    this.tick();
  }

  async testConnection(_config: MqttConnectionConfig): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'Mode demo aktif. Tidak memakai broker.' };
  }

  private tick(): void {
    if (!this.connected) return;
    this.now += this.tickMs;
    this.advancePresence();
    this.advanceSensors();
    this.advanceCounters();
    this.applyRules();
    this.emitTelemetry();
    this.emitState();
    this.emitCounters();
  }

  private advancePresence(): void {
    this.presencePhaseMs += this.tickMs;
    if (this.presencePhaseMs < this.phaseDurationMs) return;
    this.presencePhaseMs = 0;
    this.phaseIndex = (this.phaseIndex + 1) % 3;
    const next = (['terisi', 'mungkin_kosong', 'kosong'] as const)[this.phaseIndex];
    if (!next) return;
    this.presence = next;
    if (next === 'terisi') {
      this.occSince = this.now;
      this.emptyForS = 0;
    }
    // Fase kosong lebih panjang dari timeout default agar auto-off terlihat.
    this.phaseDurationMs =
      next === 'kosong'
        ? this.emptyPhaseDurationMs
        : 35_000 + Math.round(this.random() * 25_000);
  }

  private advanceSensors(): void {
    // Suhu berayun 25,5–30°C agar aturan hysteresis kipas terlihat.
    const elapsed = this.now - this.startedAt;
    const target = 27.8 + 2.2 * Math.sin(elapsed / 90_000);
    this.temp = clamp(this.temp + (target - this.temp) * 0.25 + (this.random() - 0.5) * 0.2, 25, 31);
    this.hum = clamp(this.hum + (this.random() - 0.5) * 1.2, 48, 78);

    // LDR KY-018: ADC tinggi saat terang, rendah saat gelap. Siklus siang/
    // malam 3 menit agar aturan "gelap + ada orang" bisa diamati saat demo.
    const isDay = Math.floor(elapsed / 180_000) % 2 === 0;
    const targetLdr = isDay ? 2800 : 900;
    this.ldr = Math.round(
      clamp(this.ldr + (targetLdr - this.ldr) * 0.22 + (this.random() - 0.5) * 80, 200, 3800)
    );
  }

  private advanceCounters(): void {
    const day = isoDay(this.now);
    if (day !== this.countersDay) {
      this.countersDay = day;
      this.lampOnS = 0;
      this.fanOnS = 0;
      this.occupiedS = 0;
      this.dayStartMs = startOfDay(this.now);
    }
    const seconds = this.tickMs / 1000;
    if (this.lamp) this.lampOnS += seconds;
    if (this.fan) this.fanOnS += seconds;
    if (this.presence === 'terisi') this.occupiedS += seconds;
    if (this.presence === 'kosong') {
      this.emptyForS += seconds;
    } else {
      this.emptyForS = 0;
    }
  }

  private applyRules(): void {
    const telemetry: RuleTelemetry = {
      temp: this.temp,
      hum: this.hum,
      ldr: this.ldr,
      presence: this.presence,
    };
    const state: RuleState = {
      lamp: this.lamp,
      fan: this.fan,
      emptyForS: this.emptyForS,
      mode: this.mode,
    };
    const evaluation = evaluateRules({
      telemetry,
      config: {
        fanOnC: this.config.fan_on_c,
        fanOffC: this.config.fan_off_c,
        emptyTimeoutS: this.config.empty_timeout_s,
        darkAdc: this.config.dark_adc,
        lampRule: this.config.lamp_rule,
        fanRule: this.config.fan_rule,
        autoOffRule: this.config.autooff_rule,
      },
      state,
    });

    if (this.mode === 'auto') {
      this.lamp = evaluation.lamp.resultOn;
      this.fan = evaluation.fan.resultOn;
      if (evaluation.autoOff.shouldTurnOff) {
        this.lamp = false;
        this.fan = false;
      }
    }
  }

  private emitTelemetry(): void {
    const payload: TelemetryPayload = {
      ts: Math.floor(this.now / 1000),
      temp: round(this.temp, 1),
      hum: round(this.hum, 0),
      ldr: this.ldr,
      presence: this.presence,
      dist_cm: this.presence === 'terisi' ? 90 + Math.round(this.random() * 120) : null,
    };
    this.events.onTelemetry?.(payload);
  }

  private emitState(): void {
    const payload: StatePayload = {
      mode: this.mode,
      lamp: this.lamp,
      fan: this.fan,
      occ_since: this.presence === 'terisi' ? Math.floor(this.occSince / 1000) : null,
      empty_for_s: Math.round(this.emptyForS),
    };
    this.events.onState?.(payload);
  }

  private emitCounters(): void {
    const payload: CountersPayload = {
      day: this.countersDay,
      lamp_on_s: Math.round(this.lampOnS),
      fan_on_s: Math.round(this.fanOnS),
      occupied_s: Math.round(this.occupiedS),
    };
    this.events.onCounters?.(payload);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function startOfDay(epochMs: number): number {
  const date = new Date(epochMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isoDay(epochMs: number): string {
  const date = new Date(epochMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Fase simulasi diekspor untuk tes deterministik. */
export const DEMO_PHASES = ['terisi', 'mungkin_kosong', 'kosong'] as const;

export type { ConnectionPhase };


/**
 * Riwayat contoh untuk layar Statistik saat Mode Demo. Data ini tidak ditulis
 * ke SQLite dan tidak muncul saat Mode Demo dimatikan. Nilainya dihitung dari
 * pola pemakaian, bukan angka tetap dari mock-up.
 */
export interface DemoHistory {
  telemetry: TelemetryBucket[];
  blocks: CounterBlock[];
  totals: { lampOnS: number; fanOnS: number; occupiedS: number; days: number };
}

export function buildDemoHistory(
  range: '24h' | '7d' | '30d',
  now: number
): DemoHistory {
  const days = range === '24h' ? 1 : range === '7d' ? 7 : 30;
  const bucketMs = range === '24h' ? 3_600_000 : 86_400_000;
  const bucketCount = range === '24h' ? 24 : days;
  const telemetry: TelemetryBucket[] = [];
  const blocks: CounterBlock[] = [];
  let lampOnS = 0;
  let fanOnS = 0;
  let occupiedS = 0;
  const hourMs = 3_600_000;

  for (let index = 0; index < bucketCount; index += 1) {
    const bucketTs =
      range === '24h'
        ? Math.floor(now / bucketMs) * bucketMs - (bucketCount - 1 - index) * bucketMs
        : startOfDay(now) - (bucketCount - 1 - index) * bucketMs;
    const date = new Date(bucketTs);
    const hourOfDay = range === '24h' ? date.getHours() : 12;
    const daylight = Math.max(0, Math.sin(((hourOfDay - 6) / 12) * Math.PI));
    const temp = 25.6 + 3.2 * daylight + 0.35 * Math.sin(index * 1.7);
    const hum = 68 - 10 * daylight + 1.4 * Math.cos(index * 1.3);
    telemetry.push({
      bucketTs,
      temp: Math.round(temp * 10) / 10,
      hum: Math.round(hum),
      samples: range === '24h' ? 720 : 17_280,
    });

    if (range === '24h') {
      // Satu blok = satu jam. Lampu lebih sering menyala malam hari.
      const lampFraction = hourOfDay >= 18 || hourOfDay < 6 ? 0.55 : 0.12;
      const fanFraction = temp >= 27.4 ? 0.5 : 0.15;
      const blockLamp = hourMs / 1000 * lampFraction;
      const blockFan = hourMs / 1000 * fanFraction;
      blocks.push({ bucketTs, lampOnS: Math.round(blockLamp), fanOnS: Math.round(blockFan) });
      lampOnS += blockLamp;
      fanOnS += blockFan;
      occupiedS += hourMs / 1000 * 0.5;
    } else {
      // Satu blok = satu hari. Pemakaian wajar 4–7 jam per hari.
      const dayFactor = 0.85 + 0.3 * Math.abs(Math.sin(index * 0.9));
      const blockLamp = (4.2 * 3600 + index * 37) * dayFactor;
      const blockFan = (5.6 * 3600 + index * 53) * dayFactor;
      blocks.push({ bucketTs, lampOnS: Math.round(blockLamp), fanOnS: Math.round(blockFan) });
      lampOnS += blockLamp;
      fanOnS += blockFan;
      occupiedS += 8.2 * 3600 * dayFactor;
    }
  }

  return {
    telemetry,
    blocks,
    totals: {
      lampOnS: Math.round(lampOnS),
      fanOnS: Math.round(fanOnS),
      occupiedS: Math.round(occupiedS),
      days,
    },
  };
}
