import { describe, expect, it } from '@jest/globals';
import {
  shouldAlertEmptyWithLoad,
  shouldAlertHighTemp,
  shouldAlertNodeOffline,
} from '../src/data/notificationRules';

describe('ambang notifikasi lokal', () => {
  it('node offline lebih dari 1 menit', () => {
    expect(shouldAlertNodeOffline(true, 60_001)).toBe(true);
    expect(shouldAlertNodeOffline(true, 60_000)).toBe(false);
    expect(shouldAlertNodeOffline(false, 120_000)).toBe(false);
  });

  it('suhu di atas 32°C', () => {
    expect(shouldAlertHighTemp(true, 32.1)).toBe(true);
    expect(shouldAlertHighTemp(true, 32)).toBe(false);
    expect(shouldAlertHighTemp(true, null)).toBe(false);
    expect(shouldAlertHighTemp(false, 40)).toBe(false);
  });

  it('kosong dengan beban nyala lebih dari 10 menit', () => {
    expect(shouldAlertEmptyWithLoad(true, 601, true, false)).toBe(true);
    expect(shouldAlertEmptyWithLoad(true, 601, false, true)).toBe(true);
    expect(shouldAlertEmptyWithLoad(true, 601, false, false)).toBe(false);
    expect(shouldAlertEmptyWithLoad(true, 600, true, true)).toBe(false);
  });
});
