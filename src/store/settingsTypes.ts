import type { ConfigPayload } from '@/core/mqttTopics';

export type ThemePreference = 'system' | 'dark' | 'light';

export interface NotificationSettings {
  nodeOffline: boolean;
  highTemp: boolean;
  emptyWithLoad: boolean;
}

export interface Settings {
  /** Nama ruang yang ditampilkan di header dan kartu ringkasan. */
  roomName: string;
  /** Sudah pernah membuka aplikasi; dipakai untuk tawaran Mode Demo. */
  hasLaunched: boolean;
  brokerHost: string;
  brokerPort: number;
  topicPrefix: string;
  demoMode: boolean;
  /** Daya nominal, bukan pengukuran. */
  lampWatts: number;
  fanWatts: number;
  tariffPerKwh: number;
  baselineLampHours: number;
  baselineFanHours: number;
  /** Kalibrasi LDR dalam ADC mentah. */
  ldrBrightAdc: number | null;
  ldrDarkAdc: number | null;
  theme: ThemePreference;
  notifications: NotificationSettings;
  /** Konfigurasi aturan terakhir yang dikirim/diterima. */
  ruleConfig: ConfigPayload;
}

export const DEFAULT_SETTINGS: Settings = {
  roomName: 'Kamar 1',
  hasLaunched: false,
  brokerHost: '',
  brokerPort: 9001,
  topicPrefix: 'smartroom/node1',
  demoMode: false,
  lampWatts: 8,
  fanWatts: 24,
  tariffPerKwh: 1444.7,
  baselineLampHours: 12,
  baselineFanHours: 12,
  ldrBrightAdc: null,
  ldrDarkAdc: null,
  theme: 'dark',
  notifications: {
    nodeOffline: false,
    highTemp: false,
    emptyWithLoad: false,
  },
  ruleConfig: {
    fan_on_c: 28,
    fan_off_c: 26,
    empty_timeout_s: 300,
    dark_adc: 1200,
    lamp_rule: true,
    fan_rule: true,
    autooff_rule: true,
  },
};

/**
 * Sanitasi nilai dari AsyncStorage. Semua field divalidasi agar data lama
 * atau rusak tidak membuat aplikasi crash.
 */
export function sanitizeSettings(input: unknown): Settings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<Settings>;
  const notifications = (raw.notifications ?? {}) as Partial<NotificationSettings>;
  const rules = (raw.ruleConfig ?? {}) as Partial<ConfigPayload>;
  const clampNumber = (value: unknown, fallback: number, min: number, max: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  };
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

  const theme: ThemePreference =
    raw.theme === 'dark' || raw.theme === 'light' || raw.theme === 'system'
      ? raw.theme
      : DEFAULT_SETTINGS.theme;

  const brokerPort = Math.round(clampNumber(raw.brokerPort, DEFAULT_SETTINGS.brokerPort, 1, 65535));
  const topicPrefix =
    typeof raw.topicPrefix === 'string' && raw.topicPrefix.trim().length > 0
      ? raw.topicPrefix.trim()
      : DEFAULT_SETTINGS.topicPrefix;

  return {
    roomName:
      typeof raw.roomName === 'string' && raw.roomName.trim().length > 0
        ? raw.roomName.trim().slice(0, 40)
        : DEFAULT_SETTINGS.roomName,
    hasLaunched: bool(raw.hasLaunched, DEFAULT_SETTINGS.hasLaunched),
    brokerHost: typeof raw.brokerHost === 'string' ? raw.brokerHost.trim() : '',
    brokerPort,
    topicPrefix,
    demoMode: bool(raw.demoMode, DEFAULT_SETTINGS.demoMode),
    lampWatts:
      typeof raw.lampWatts === 'number' && Number.isFinite(raw.lampWatts) && raw.lampWatts > 0
        ? Math.min(2000, raw.lampWatts)
        : DEFAULT_SETTINGS.lampWatts,
    fanWatts:
      typeof raw.fanWatts === 'number' && Number.isFinite(raw.fanWatts) && raw.fanWatts > 0
        ? Math.min(2000, raw.fanWatts)
        : DEFAULT_SETTINGS.fanWatts,
    tariffPerKwh: clampNumber(raw.tariffPerKwh, DEFAULT_SETTINGS.tariffPerKwh, 0, 100_000),
    baselineLampHours: clampNumber(
      raw.baselineLampHours,
      DEFAULT_SETTINGS.baselineLampHours,
      0,
      24
    ),
    baselineFanHours: clampNumber(
      raw.baselineFanHours,
      DEFAULT_SETTINGS.baselineFanHours,
      0,
      24
    ),
    ldrBrightAdc:
      typeof raw.ldrBrightAdc === 'number' && Number.isFinite(raw.ldrBrightAdc)
        ? Math.min(4095, Math.max(0, Math.round(raw.ldrBrightAdc)))
        : null,
    ldrDarkAdc:
      typeof raw.ldrDarkAdc === 'number' && Number.isFinite(raw.ldrDarkAdc)
        ? Math.min(4095, Math.max(0, Math.round(raw.ldrDarkAdc)))
        : null,
    theme,
    notifications: {
      nodeOffline: bool(notifications.nodeOffline, false),
      highTemp: bool(notifications.highTemp, false),
      emptyWithLoad: bool(notifications.emptyWithLoad, false),
    },
    ruleConfig: {
      fan_on_c: clampNumber(rules.fan_on_c, DEFAULT_SETTINGS.ruleConfig.fan_on_c, 0, 60),
      fan_off_c: clampNumber(rules.fan_off_c, DEFAULT_SETTINGS.ruleConfig.fan_off_c, 0, 60),
      empty_timeout_s: clampNumber(
        rules.empty_timeout_s,
        DEFAULT_SETTINGS.ruleConfig.empty_timeout_s,
        60,
        900
      ),
      dark_adc: clampNumber(rules.dark_adc, DEFAULT_SETTINGS.ruleConfig.dark_adc, 0, 4095),
      lamp_rule: bool(rules.lamp_rule, true),
      fan_rule: bool(rules.fan_rule, true),
      autooff_rule: bool(rules.autooff_rule, true),
    },
  };
}
