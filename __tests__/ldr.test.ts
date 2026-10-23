import { describe, expect, it } from '@jest/globals';
import {
  ADC_MAX,
  ADC_MIN,
  darkThresholdFromCalibration,
  isCalibrationValid,
  ldrToPercent,
  lightLabel,
  lightReading,
} from '../src/domain/ldr';

describe('kalibrasi LDR', () => {
  it('nilai di titik terang = 100%, titik gelap = 0%', () => {
    const calibration = { brightAdc: 3200, darkAdc: 800 };
    expect(ldrToPercent(3200, calibration)).toBe(100);
    expect(ldrToPercent(800, calibration)).toBe(0);
  });

  it('interpolasi linear di antara dua titik', () => {
    const calibration = { brightAdc: 2800, darkAdc: 800 };
    // Titik tengah 1800 → 50%.
    expect(ldrToPercent(1800, calibration)).toBe(50);
    // 2300 → (2300-800)/(2800-800) = 75%.
    expect(ldrToPercent(2300, calibration)).toBe(75);
  });

  it('nilai di luar rentang dijepit 0..100', () => {
    const calibration = { brightAdc: 3200, darkAdc: 800 };
    expect(ldrToPercent(ADC_MAX, calibration)).toBe(100);
    expect(ldrToPercent(0, calibration)).toBe(0);
    expect(ldrToPercent(-50, calibration)).toBe(0);
  });

  it('kalibrasi terbalik (terang lebih kecil dari gelap) tetap bekerja', () => {
    const calibration = { brightAdc: 800, darkAdc: 3200 };
    expect(ldrToPercent(800, calibration)).toBe(100);
    expect(ldrToPercent(3200, calibration)).toBe(0);
    expect(ldrToPercent(2000, calibration)).toBe(50);
  });

  it('kalibrasi tidak valid mengembalikan null', () => {
    expect(ldrToPercent(1200, null)).toBeNull();
    expect(ldrToPercent(1200, { brightAdc: 1000 })).toBeNull();
    expect(ldrToPercent(1200, { brightAdc: 1000, darkAdc: 1000 })).toBeNull();
    expect(ldrToPercent(1200, { brightAdc: 1000, darkAdc: 5000 })).toBeNull();
    expect(ldrToPercent(null, { brightAdc: 1000, darkAdc: 3000 })).toBeNull();
    expect(ldrToPercent(Number.NaN, { brightAdc: 1000, darkAdc: 3000 })).toBeNull();
    expect(isCalibrationValid({ brightAdc: 1000, darkAdc: 3000 })).toBe(true);
  });

  it('label terang, redup, gelap memakai batas 60% dan 25%', () => {
    expect(lightLabel(100)).toBe('Terang');
    expect(lightLabel(60)).toBe('Terang');
    expect(lightLabel(59)).toBe('Redup');
    expect(lightLabel(25)).toBe('Redup');
    expect(lightLabel(24)).toBe('Gelap');
    expect(lightLabel(0)).toBe('Gelap');
    expect(lightLabel(null)).toBeNull();
    expect(lightLabel(Number.NaN)).toBeNull();
  });

  it('lightReading menggabungkan persen dan label', () => {
    expect(lightReading(1800, { brightAdc: 2800, darkAdc: 800 })).toEqual({
      percent: 50,
      label: 'Redup',
    });
    expect(lightReading(null, { brightAdc: 2800, darkAdc: 800 })).toBeNull();
  });

  it('ambang gelap diambil dari titik tengah kalibrasi', () => {
    expect(darkThresholdFromCalibration({ brightAdc: 2400, darkAdc: 800 })).toBe(1600);
    expect(darkThresholdFromCalibration({ brightAdc: 800, darkAdc: 2400 })).toBe(1600);
    expect(darkThresholdFromCalibration({ brightAdc: 0, darkAdc: ADC_MAX })).toBe(2048);
    expect(darkThresholdFromCalibration(null)).toBeNull();
  });
});
