import { describe, expect, it } from '@jest/globals';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/store/settingsTypes';

describe('sanitizeSettings', () => {
  it('memakai default untuk data kosong', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('menolak angka di luar rentang dan tipe salah', () => {
    const result = sanitizeSettings({
      brokerPort: 99999,
      lampWatts: -5,
      fanWatts: 'besar',
      baselineLampHours: 100,
      tariffPerKwh: Number.NaN,
      ldrBrightAdc: 9999,
    });
    expect(result.brokerPort).toBe(65535);
    expect(result.lampWatts).toBe(DEFAULT_SETTINGS.lampWatts);
    expect(result.fanWatts).toBe(DEFAULT_SETTINGS.fanWatts);
    expect(result.baselineLampHours).toBe(24);
    expect(result.tariffPerKwh).toBe(DEFAULT_SETTINGS.tariffPerKwh);
    expect(result.ldrBrightAdc).toBe(4095);
  });

  it('menjaga nilai valid dan tema yang dikenal', () => {
    const result = sanitizeSettings({
      roomName: '  Ruang Tamu  ',
      brokerHost: ' 192.168.1.7 ',
      brokerPort: 9001,
      topicPrefix: 'smartroom/kelas',
      demoMode: true,
      theme: 'light',
      lampWatts: 12,
      fanWatts: 40,
      tariffPerKwh: 1500,
      notifications: { highTemp: true },
      ruleConfig: { fan_on_c: 30, fan_off_c: 27 },
    });
    expect(result.roomName).toBe('Ruang Tamu');
    expect(result.brokerHost).toBe('192.168.1.7');
    expect(result.demoMode).toBe(true);
    expect(result.theme).toBe('light');
    expect(result.notifications.highTemp).toBe(true);
    expect(result.notifications.nodeOffline).toBe(false);
    expect(result.ruleConfig.fan_on_c).toBe(30);
    expect(result.ruleConfig.fan_off_c).toBe(27);
    expect(result.ruleConfig.lamp_rule).toBe(true);
  });
});
