import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { NotificationSettings, Settings } from '@/store/settingsTypes';
import {
  shouldAlertEmptyWithLoad,
  shouldAlertHighTemp,
  shouldAlertNodeOffline,
} from './notificationRules';

/**
 * Notifikasi lokal saja. Tidak ada push dari server. Notifikasi dipicu oleh
 * perubahan state di aplikasi (bukan oleh firmware), jadi hanya muncul saat
 * aplikasi hidup.
 */

export const NOTIFICATION_CHANNEL_ID = 'smartroom-alerts';

let handlerInstalled = false;

export function installNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'Peringatan Smart Room',
    // eslint-disable-next-line import/namespace -- enum diekspor lewat export * dari .d.ts
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lightColor: '#E3B7A0',
  });
}

async function notify(title: string, body: string, identifier: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const granted = await ensureNotificationPermissions();
  if (!granted) return;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body },
    trigger: null,
  });
}

export interface AlertContext {
  nodeOfflineForMs: number;
  temperature: number | null;
  emptyForS: number;
  lampOn: boolean;
  fanOn: boolean;
}

/**
 * Dipanggil berkala (misalnya tiap 5 detik) oleh provider. Notifikasi yang
 * sama tidak diulang dalam 10 menit agar tidak membanjiri pengguna.
 */
export class LocalAlertEngine {
  private lastSent = new Map<string, number>();

  constructor(
    private readonly settings: NotificationSettings,
    private readonly now: () => number = Date.now
  ) {}

  async evaluate(context: AlertContext): Promise<void> {
    const now = this.now();
    if (shouldAlertNodeOffline(this.settings.nodeOffline, context.nodeOfflineForMs)) {
      await this.sendOnce('node-offline', 'Node offline', 'Node tidak terhubung lebih dari 1 menit.', now);
    }
    if (shouldAlertHighTemp(this.settings.highTemp, context.temperature)) {
      await this.sendOnce(
        'high-temp',
        'Suhu ruangan tinggi',
        `Suhu ${context.temperature?.toFixed(1) ?? '-'}°C melewati 32°C.`,
        now
      );
    }
    if (
      shouldAlertEmptyWithLoad(
        this.settings.emptyWithLoad,
        context.emptyForS,
        context.lampOn,
        context.fanOn
      )
    ) {
      await this.sendOnce(
        'empty-load',
        'Ruangan kosong, beban masih menyala',
        'Lampu atau kipas menyala lebih dari 10 menit saat ruangan kosong.',
        now
      );
    }
  }

  private async sendOnce(
    key: string,
    title: string,
    body: string,
    now: number
  ): Promise<void> {
    const last = this.lastSent.get(key) ?? 0;
    if (now - last < 10 * 60_000) return;
    this.lastSent.set(key, now);
    try {
      await notify(title, body, `smartroom-${key}`);
    } catch {
      // Notifikasi gagal tidak boleh mengganggu alur utama.
    }
  }
}

export function notificationSettingsOf(settings: Settings): NotificationSettings {
  return settings.notifications;
}
