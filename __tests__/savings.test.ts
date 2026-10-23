import { describe, expect, it } from '@jest/globals';
import { calculateSavings, savingsFormulaLine } from '../src/domain/savings';

describe('calculateSavings', () => {
  it('menghitung kWh, rupiah, dan persen dari rumus kontrak', () => {
    // Lampu 10 W menyala 4,2 jam = 42 Wh; kipas 35 W menyala 6,5 jam = 227,5 Wh.
    const result = calculateSavings({
      lampOnSeconds: 4.2 * 3600,
      fanOnSeconds: 6.5 * 3600,
      lampWatts: 10,
      fanWatts: 35,
      tariffPerKwh: 1444.7,
      baselineLampHours: 12,
      baselineFanHours: 12,
    });

    expect(result.usedKwh).toBeCloseTo(0.2695, 6);
    expect(result.baselineKwh).toBeCloseTo(0.54, 6);
    expect(result.savedKwh).toBeCloseTo(0.2705, 6);
    expect(result.savedRupiah).toBeCloseTo(390.79, 2);
    expect(result.savedPercent).toBeCloseTo(50.09, 2);
    expect(result.percentAvailable).toBe(true);
  });

  it('baseline 0 menghasilkan persen 0 dan tidak membagi nol', () => {
    const result = calculateSavings({
      lampOnSeconds: 3600,
      fanOnSeconds: 3600,
      lampWatts: 10,
      fanWatts: 20,
      tariffPerKwh: 1444.7,
      baselineLampHours: 0,
      baselineFanHours: 0,
    });
    expect(result.baselineKwh).toBe(0);
    expect(result.savedKwh).toBe(0);
    expect(result.savedPercent).toBe(0);
    expect(result.percentAvailable).toBe(false);
  });

  it('beban di atas baseline tidak menghasilkan hemat negatif', () => {
    const result = calculateSavings({
      lampOnSeconds: 24 * 3600,
      fanOnSeconds: 24 * 3600,
      lampWatts: 10,
      fanWatts: 35,
      tariffPerKwh: 1444.7,
      baselineLampHours: 1,
      baselineFanHours: 1,
    });
    expect(result.savedKwh).toBe(0);
    expect(result.savedRupiah).toBe(0);
    expect(result.savedPercent).toBe(0);
  });

  it('tarif berubah mengubah rupiah tetapi bukan kWh', () => {
    const base = {
      lampOnSeconds: 4.2 * 3600,
      fanOnSeconds: 6.5 * 3600,
      lampWatts: 10,
      fanWatts: 35,
      baselineLampHours: 12,
      baselineFanHours: 12,
    };
    const cheap = calculateSavings({ ...base, tariffPerKwh: 1000 });
    const pricey = calculateSavings({ ...base, tariffPerKwh: 2000 });
    expect(cheap.savedKwh).toBeCloseTo(pricey.savedKwh, 9);
    expect(pricey.savedRupiah).toBeCloseTo(cheap.savedRupiah * 2, 6);
  });

  it('mengabaikan nilai negatif dan NaN', () => {
    const result = calculateSavings({
      lampOnSeconds: -50,
      fanOnSeconds: Number.NaN,
      lampWatts: 10,
      fanWatts: 20,
      tariffPerKwh: 1444.7,
      baselineLampHours: 12,
      baselineFanHours: 12,
    });
    expect(result.usedKwh).toBe(0);
    expect(result.baselineKwh).toBeCloseTo(0.36, 6);
    expect(result.savedKwh).toBeCloseTo(0.36, 6);
  });

  it('menyusun baris rumus dengan angka sebenarnya', () => {
    const input = {
      lampOnSeconds: 4.2 * 3600,
      fanOnSeconds: 6.5 * 3600,
      lampWatts: 10,
      fanWatts: 35,
      tariffPerKwh: 1444.7,
      baselineLampHours: 12,
      baselineFanHours: 12,
    };
    const result = calculateSavings(input);
    expect(savingsFormulaLine(input, result)).toBe(
      '((4,20 jam × 10 W) + (6,50 jam × 35 W)) / 1000 = 0,270 kWh'
    );
  });
});
