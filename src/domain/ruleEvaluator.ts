/**
 * Evaluasi aturan firmware dari data terakhir. Fungsi murni: tidak menyimpan
 * state, tidak melakukan I/O. Pemanggil memberikan state lampu/kipas
 * sebelumnya untuk aturan hysteresis dan auto-off.
 */

import { ldrToPercent, type LdrCalibration } from './ldr';

export type Presence = 'terisi' | 'mungkin_kosong' | 'kosong';
export type Mode = 'auto' | 'manual';

export interface RuleConfig {
  fanOnC: number;
  fanOffC: number;
  emptyTimeoutS: number;
  darkAdc: number;
  lampRule: boolean;
  fanRule: boolean;
  autoOffRule: boolean;
}

export interface RuleTelemetry {
  temp: number | null;
  hum: number | null;
  ldr: number | null;
  presence: Presence | null;
}

export interface RuleState {
  lamp: boolean;
  fan: boolean;
  emptyForS: number;
  mode: Mode;
}

export interface RuleEvaluationInput {
  telemetry: RuleTelemetry | null;
  config: RuleConfig;
  state: RuleState;
  calibration?: Partial<LdrCalibration> | null;
}

export interface LampCondition {
  active: boolean;
  presenceOk: boolean;
  darkOk: boolean;
  /** Persen cahaya bila kalibrasi tersedia. */
  lightPercent: number | null;
  /** Apakah nilai ADC mentah <= darkAdc (ADC rendah = gelap). */
  darkByAdc: boolean | null;
  resultOn: boolean;
}

export interface FanCondition {
  active: boolean;
  temp: number | null;
  /** true bila kipas seharusnya ON karena suhu >= fanOnC. */
  aboveOn: boolean;
  /** true bila suhu <= fanOffC sehingga kipas seharusnya OFF. */
  belowOff: boolean;
  /** Hasil setelah hysteresis dari state sebelumnya. */
  resultOn: boolean;
}

export interface AutoOffCondition {
  active: boolean;
  emptyForS: number;
  timeoutS: number;
  remainingS: number;
  /** true bila ruangan dianggap kosong (presence kosong). */
  empty: boolean;
  shouldTurnOff: boolean;
}

export interface RuleEvaluation {
  lamp: LampCondition;
  fan: FanCondition;
  autoOff: AutoOffCondition;
}

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  fanOnC: 28,
  fanOffC: 26,
  emptyTimeoutS: 300,
  darkAdc: 1200,
  lampRule: true,
  fanRule: true,
  autoOffRule: true,
};

export const MIN_HYSTERESIS_GAP_C = 1;
export const AUTO_OFF_MIN_S = 60;
export const AUTO_OFF_MAX_S = 900;

/** Validasi ON > OFF minimal 1°C. Mengembalikan pesan error atau null. */
export function validateHysteresis(fanOnC: number, fanOffC: number): string | null {
  if (!Number.isFinite(fanOnC) || !Number.isFinite(fanOffC)) {
    return 'Isi suhu dengan angka.';
  }
  if (fanOnC - fanOffC < MIN_HYSTERESIS_GAP_C) {
    return 'Suhu ON harus lebih tinggi minimal 1°C dari suhu OFF.';
  }
  return null;
}

export function validateAutoOffTimeout(seconds: number): string | null {
  if (!Number.isFinite(seconds)) return 'Isi durasi dengan angka.';
  if (seconds < AUTO_OFF_MIN_S) return 'Durasi minimal 1 menit.';
  if (seconds > AUTO_OFF_MAX_S) return 'Durasi maksimal 15 menit.';
  return null;
}

export function validateDarkAdc(value: number): string | null {
  if (!Number.isFinite(value)) return 'Isi ambang dengan angka.';
  if (value < 0 || value > 4095) return 'Ambang ADC harus 0 sampai 4095.';
  return null;
}

/** Kehadiran dianggap "ada orang" hanya saat status terisi. */
export function isOccupied(presence: Presence | null | undefined): boolean {
  return presence === 'terisi';
}

export function evaluateLampRule(input: RuleEvaluationInput): LampCondition {
  const { telemetry, config, calibration } = input;
  const presence = telemetry?.presence ?? null;
  const adc = telemetry?.ldr ?? null;

  const presenceOk = isOccupied(presence);
  // Konvensi wiring KY-018: LDR ke VCC dan resistor ke GND, sehingga ADC
  // naik saat terang. Nilai di bawah atau sama dengan ambang berarti gelap.
  const darkByAdc = adc === null || !Number.isFinite(adc) ? null : adc <= config.darkAdc;
  // Bila LDR tidak terbaca, aturan tidak boleh menyalakan lampu.
  const darkOk = darkByAdc === true;
  const lightPercent = ldrToPercent(adc, calibration ?? null);
  const resultOn = config.lampRule && presenceOk && darkOk;

  return {
    active: config.lampRule,
    presenceOk,
    darkOk,
    lightPercent,
    darkByAdc,
    resultOn,
  };
}

export function evaluateFanRule(input: RuleEvaluationInput): FanCondition {
  const { telemetry, config, state } = input;
  const temp = telemetry?.temp ?? null;

  if (!config.fanRule) {
    return { active: false, temp, aboveOn: false, belowOff: false, resultOn: false };
  }
  if (temp === null || !Number.isFinite(temp)) {
    // Tanpa suhu, pertahankan state sebelumnya (tidak memicu perubahan).
    return { active: true, temp, aboveOn: false, belowOff: false, resultOn: state.fan };
  }

  const aboveOn = temp >= config.fanOnC;
  const belowOff = temp <= config.fanOffC;
  let resultOn = state.fan;
  if (aboveOn) resultOn = true;
  else if (belowOff) resultOn = false;

  return { active: true, temp, aboveOn, belowOff, resultOn };
}

export function evaluateAutoOffRule(input: RuleEvaluationInput): AutoOffCondition {
  const { telemetry, config, state } = input;
  const emptyForS = Math.max(0, state.emptyForS);
  const timeoutS = config.emptyTimeoutS;
  const empty = telemetry?.presence === 'kosong';
  const remainingS = Math.max(0, timeoutS - emptyForS);
  const shouldTurnOff = config.autoOffRule && empty && emptyForS >= timeoutS;

  return {
    active: config.autoOffRule,
    emptyForS,
    timeoutS,
    remainingS,
    empty,
    shouldTurnOff,
  };
}

export function evaluateRules(input: RuleEvaluationInput): RuleEvaluation {
  return {
    lamp: evaluateLampRule(input),
    fan: evaluateFanRule(input),
    autoOff: evaluateAutoOffRule(input),
  };
}

/**
 * Apakah auto-off sebaiknya mematikan beban sekarang? Dipakai UI untuk
 * menampilkan status; keputusan tetap di firmware.
 */
export function autoOffActive(condition: AutoOffCondition, lamp: boolean, fan: boolean): boolean {
  return condition.shouldTurnOff && (lamp || fan);
}
