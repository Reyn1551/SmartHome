/**
 * Ambang notifikasi lokal sebagai fungsi murni, dipisah dari modul native
 * agar dapat diuji tanpa memuat expo-notifications.
 */

export const NODE_OFFLINE_ALERT_MS = 60_000;
export const HIGH_TEMP_ALERT_C = 32;
export const EMPTY_LOAD_ALERT_S = 600;

export function shouldAlertNodeOffline(enabled: boolean, offlineForMs: number): boolean {
  return enabled && offlineForMs > NODE_OFFLINE_ALERT_MS;
}

export function shouldAlertHighTemp(enabled: boolean, temperature: number | null): boolean {
  return (
    enabled &&
    temperature !== null &&
    Number.isFinite(temperature) &&
    temperature > HIGH_TEMP_ALERT_C
  );
}

export function shouldAlertEmptyWithLoad(
  enabled: boolean,
  emptyForS: number,
  lampOn: boolean,
  fanOn: boolean
): boolean {
  return enabled && emptyForS > EMPTY_LOAD_ALERT_S && (lampOn || fanOn);
}
