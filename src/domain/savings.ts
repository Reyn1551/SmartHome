/**
 * Rumus estimasi hemat energi. Semua masukan daya adalah daya nominal yang
 * diisi pengguna, bukan hasil pengukuran sensor.
 *
 *   beban_nyala_kWh = (lamp_on_s/3600 × W_lampu + fan_on_s/3600 × W_kipas) / 1000
 *   baseline_kWh    = (jam_pembanding_lampu × W_lampu + jam_pembanding_kipas × W_kipas) / 1000
 *   hemat_kWh       = max(0, baseline_kWh − beban_nyala_kWh)
 *   hemat_rupiah    = hemat_kWh × tarif
 *   hemat_persen    = hemat_kWh / baseline_kWh × 100
 *
 * Catatan satuan: W × jam / 1000 = kWh.
 */

export interface SavingsInput {
  lampOnSeconds: number;
  fanOnSeconds: number;
  lampWatts: number;
  fanWatts: number;
  /** Tarif listrik dalam rupiah per kWh. */
  tariffPerKwh: number;
  /** Jam pemakaian harian lampu tanpa otomasi (asumsi pengguna). */
  baselineLampHours: number;
  /** Jam pemakaian harian kipas tanpa otomasi (asumsi pengguna). */
  baselineFanHours: number;
}

export interface SavingsResult {
  /** kWh yang benar-benar dipakai selama periode data (nominal × jam nyala). */
  usedKwh: number;
  /** kWh pembanding per hari dari asumsi pengguna. */
  baselineKwh: number;
  /** kWh yang dihemat, tidak pernah negatif. */
  savedKwh: number;
  /** Rupiah yang dihemat (belum dibulatkan). */
  savedRupiah: number;
  /** Persentase terhadap baseline, 0..100. Baseline 0 → 0. */
  savedPercent: number;
  /** Baseline 0 berarti persentase tidak bermakna. */
  percentAvailable: boolean;
}

const HOURS_PER_SECOND = 1 / 3600;
const WH_PER_KWH = 1000;

function safeNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function calculateSavings(input: SavingsInput): SavingsResult {
  const lampOnSeconds = safeNonNegative(input.lampOnSeconds);
  const fanOnSeconds = safeNonNegative(input.fanOnSeconds);
  const lampWatts = safeNonNegative(input.lampWatts);
  const fanWatts = safeNonNegative(input.fanWatts);
  const tariff = safeNonNegative(input.tariffPerKwh);
  const baselineLampHours = safeNonNegative(input.baselineLampHours);
  const baselineFanHours = safeNonNegative(input.baselineFanHours);

  const usedKwh =
    (lampOnSeconds * HOURS_PER_SECOND * lampWatts +
      fanOnSeconds * HOURS_PER_SECOND * fanWatts) /
    WH_PER_KWH;

  const baselineKwh =
    (baselineLampHours * lampWatts + baselineFanHours * fanWatts) / WH_PER_KWH;

  const savedKwh = Math.max(0, baselineKwh - usedKwh);
  const savedRupiah = savedKwh * tariff;
  const percentAvailable = baselineKwh > 0;
  const savedPercent = percentAvailable ? clampPercent((savedKwh / baselineKwh) * 100) : 0;

  return {
    usedKwh,
    baselineKwh,
    savedKwh,
    savedRupiah,
    savedPercent,
    percentAvailable,
  };
}

/** Desimal dengan koma, tanpa pemisah ribuan (dipakai di baris rumus). */
function decimalComma(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

/**
 * Satu baris rumus untuk ditampilkan di kartu Statistik, memakai angka
 * sebenarnya agar transparan. Desimal memakai koma sesuai format Indonesia.
 */
export function savingsFormulaLine(input: SavingsInput, result: SavingsResult): string {
  const lampH = safeNonNegative(input.lampOnSeconds) / 3600;
  const fanH = safeNonNegative(input.fanOnSeconds) / 3600;
  const lampW = safeNonNegative(input.lampWatts);
  const fanW = safeNonNegative(input.fanWatts);
  return `((${decimalComma(lampH, 2)} jam × ${lampW} W) + (${decimalComma(fanH, 2)} jam × ${fanW} W)) / 1000 = ${decimalComma(result.usedKwh, 3)} kWh`;
}
