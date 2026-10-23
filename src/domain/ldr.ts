/**
 * Pemetaan nilai ADC LDR (0..4095) ke persen terkalibrasi.
 *
 * Kalibrasi dua titik: nilai saat terang (ADC rendah karena pembagi tegangan
 * modul LDR umumnya menurun ketika cahaya naik) dan nilai saat gelap.
 * Interpolasi linear dilakukan pada rentang di antara kedua titik tersebut.
 * Kalibrasi terbalik (gelap < terang) juga diterima; hasilnya tetap 0..100.
 */

export const ADC_MIN = 0;
export const ADC_MAX = 4095;

/** Batas label: >= 60% terang, >= 25% redup, sisanya gelap. */
export const LIGHT_BRIGHT_PERCENT = 60;
export const LIGHT_DIM_PERCENT = 25;

export type LightLabel = 'Terang' | 'Redup' | 'Gelap';

export interface LdrCalibration {
  brightAdc: number;
  darkAdc: number;
}

export interface LightReading {
  percent: number;
  label: LightLabel;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function isValidAdc(value: unknown): value is number {
  return isFiniteNumber(value) && value >= ADC_MIN && value <= ADC_MAX;
}

/**
 * Apakah dua titik kalibrasi bisa dipakai? Keduanya harus angka ADC valid dan
 * berbeda minimal 1 satuan. Urutan boleh terbalik.
 */
export function isCalibrationValid(
  calibration: Partial<LdrCalibration> | null | undefined
): calibration is LdrCalibration {
  if (!calibration) return false;
  const { brightAdc, darkAdc } = calibration;
  if (!isValidAdc(brightAdc) || !isValidAdc(darkAdc)) return false;
  return Math.abs(brightAdc - darkAdc) >= 1;
}

/**
 * Persen cahaya 0..100 dari nilai ADC mentah. Mengembalikan null bila nilai
 * mentah atau kalibrasi tidak valid (UI menampilkan "—").
 */
export function ldrToPercent(
  adc: number | null | undefined,
  calibration: Partial<LdrCalibration> | null | undefined
): number | null {
  if (!isFiniteNumber(adc)) return null;
  if (!isCalibrationValid(calibration)) return null;

  // Nilai mentah di luar 0..4095 (noise ADC) dijepit, bukan dibuang.
  const clampedAdc = clamp(adc, ADC_MIN, ADC_MAX);
  const bright = calibration.brightAdc;
  const dark = calibration.darkAdc;
  // Terang = 100%, gelap = 0%. Jika bright < dark, selisihnya negatif dan
  // rumus yang sama otomatis menangani kalibrasi terbalik.
  const ratio = (clampedAdc - dark) / (bright - dark);
  const percent = clamp(ratio * 100, 0, 100);
  return Math.round(percent);
}

export function lightLabel(percent: number | null | undefined): LightLabel | null {
  if (!isFiniteNumber(percent)) return null;
  if (percent >= LIGHT_BRIGHT_PERCENT) return 'Terang';
  if (percent >= LIGHT_DIM_PERCENT) return 'Redup';
  return 'Gelap';
}

export function lightReading(
  adc: number | null | undefined,
  calibration: Partial<LdrCalibration> | null | undefined
): LightReading | null {
  const percent = ldrToPercent(adc, calibration);
  const label = lightLabel(percent);
  if (percent === null || label === null) return null;
  return { percent, label };
}

/**
 * Ambang gelap dalam ADC diturunkan dari kalibrasi: titik tengah antara nilai
 * terang dan gelap. Nilai ini dipakai sebagai `dark_adc` pada aturan lampu.
 */
export function darkThresholdFromCalibration(
  calibration: Partial<LdrCalibration> | null | undefined
): number | null {
  if (!isCalibrationValid(calibration)) return null;
  const mid = (calibration.brightAdc + calibration.darkAdc) / 2;
  return Math.round(clamp(mid, ADC_MIN, ADC_MAX));
}
