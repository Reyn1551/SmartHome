import { describe, expect, it } from '@jest/globals';
import { themes, type ThemeColors } from '../src/core/theme/tokens';

/** Rasio kontras WCAG untuk dua warna heksadesimal. */
function contrast(foreground: string, background: string): number {
  const luminance = (hex: string): number => {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map((offset) => {
      const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

const textPairs: readonly Exclude<keyof ThemeColors, 'canvasGradient'>[] = [
  'text',
  'textSoft',
  'textFaint',
  'primary',
  'secondary',
  'alert',
  'warning',
  'accentText',
];

describe.each(['dark', 'light'] as const)('kontras tema %s', (mode) => {
  const colors = themes[mode].colors;

  it.each(textPairs)('%s terbaca di surface dan surfaceMuted', (token) => {
    expect(contrast(colors[token], colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors[token], colors.surfaceMuted)).toBeGreaterThanOrEqual(4.5);
  });

  it('teks di tombol utama terbaca', () => {
    expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('track switch menyala berbeda jelas dari permukaan', () => {
    expect(contrast(colors.trackOn, colors.surface)).toBeGreaterThanOrEqual(3);
  });

  it('garis tepi switch terlihat di permukaan', () => {
    expect(contrast(colors.thumbEdge, colors.surface)).toBeGreaterThanOrEqual(3);
  });

  it('thumb switch terlihat di kedua keadaan', () => {
    expect(contrast(colors.switchThumb, colors.trackOff)).toBeGreaterThanOrEqual(1.2);
    expect(contrast(colors.switchThumbOn, colors.trackOn)).toBeGreaterThanOrEqual(3);
  });

  it('garis grafik terlihat di atas kartu', () => {
    expect(contrast(colors.chartWarm, colors.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.chartCool, colors.surface)).toBeGreaterThanOrEqual(3);
  });
});
