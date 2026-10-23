import { describe, expect, it } from '@jest/globals';
import {
  formatCountdown,
  formatDate,
  formatDecimal,
  formatHours,
  formatRelativeTime,
  formatRupiah,
  formatTemperature,
  parseLocaleNumber,
} from '../src/core/format';

describe('formatRupiah', () => {
  it('memakai titik ribuan tanpa desimal', () => {
    expect(formatRupiah(3850)).toBe('Rp 3.850');
    expect(formatRupiah(70500)).toBe('Rp 70.500');
    expect(formatRupiah(1444700)).toBe('Rp 1.444.700');
    expect(formatRupiah(0)).toBe('Rp 0');
  });

  it('membulatkan desimal', () => {
    expect(formatRupiah(3850.4)).toBe('Rp 3.850');
    expect(formatRupiah(3850.5)).toBe('Rp 3.851');
  });

  it('nilai tidak valid menjadi tanda hubung', () => {
    expect(formatRupiah(null)).toBe('-');
    expect(formatRupiah(undefined)).toBe('-');
    expect(formatRupiah(Number.NaN)).toBe('-');
    expect(formatRupiah(Number.POSITIVE_INFINITY)).toBe('-');
  });
});

describe('format durasi', () => {
  it('format jam dengan satu desimal dan koma', () => {
    expect(formatHours(4.2 * 3600)).toBe('4,2 jam');
    expect(formatHours(0)).toBe('0,0 jam');
    expect(formatHours(null)).toBe('-');
  });

  it('hitung mundur mm:ss', () => {
    expect(formatCountdown(200)).toBe('03:20');
    expect(formatCountdown(300)).toBe('05:00');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-10)).toBe('00:00');
    expect(formatCountdown(Number.NaN)).toBe('-');
  });

});

describe('format angka dan tanggal', () => {
  it('suhu satu desimal', () => {
    expect(formatTemperature(27.4)).toBe('27,4');
    expect(formatTemperature(28)).toBe('28,0');
    expect(formatTemperature(null)).toBe('-');
  });

  it('desimal dengan jumlah digit tetap', () => {
    expect(formatDecimal(1444.7, 2)).toBe('1.444,70');
  });

  it('tanggal Indonesia', () => {
    const date = new Date(2026, 9, 23, 12, 0, 0).getTime();
    expect(formatDate(date)).toBe('23 Okt 2026');
    expect(formatDate(new Date(2026, 0, 1).getTime())).toBe('1 Jan 2026');
  });

  it('membaca angka format Indonesia dan polos', () => {
    expect(parseLocaleNumber('1.444,70')).toBeCloseTo(1444.7, 6);
    expect(parseLocaleNumber('1444,7')).toBeCloseTo(1444.7, 6);
    expect(parseLocaleNumber('1444.7')).toBeCloseTo(1444.7, 6);
    expect(parseLocaleNumber('1.444')).toBe(1444);
    expect(parseLocaleNumber('28')).toBe(28);
    expect(parseLocaleNumber('')).toBeNull();
    expect(parseLocaleNumber('abc')).toBeNull();
  });

  it('waktu relatif', () => {
    const now = 1_730_000_000_000;
    expect(formatRelativeTime(now - 3_000, now)).toBe('baru saja');
    expect(formatRelativeTime(now - 42_000, now)).toBe('42 detik lalu');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 menit lalu');
    expect(formatRelativeTime(now - 2 * 3600_000, now)).toBe('2 jam lalu');
    expect(formatRelativeTime(now - 50 * 3600_000, now)).toBe('2 hari lalu');
  });
});
