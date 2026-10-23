import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings, type ThemePreference } from './settingsTypes';

const STORAGE_KEY = 'smartroom.settings.v1';

interface SettingsState {
  settings: Settings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
  updateNotifications: (patch: Partial<Settings['notifications']>) => void;
  updateRuleConfig: (patch: Partial<Settings['ruleConfig']>) => void;
  setTheme: (theme: ThemePreference) => void;
  reset: () => void;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

function persist(settings: Settings): void {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {
      // Penyimpanan gagal tidak boleh menghentikan aplikasi.
    });
  }, 150);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      set({ settings: sanitizeSettings(parsed), hydrated: true });
    } catch {
      set({ settings: DEFAULT_SETTINGS, hydrated: true });
    }
  },

  update: (patch) => {
    const next = sanitizeSettings({ ...get().settings, ...patch });
    set({ settings: next });
    persist(next);
  },

  updateNotifications: (patch) => {
    const current = get().settings;
    const next = sanitizeSettings({
      ...current,
      notifications: { ...current.notifications, ...patch },
    });
    set({ settings: next });
    persist(next);
  },

  updateRuleConfig: (patch) => {
    const current = get().settings;
    const next = sanitizeSettings({
      ...current,
      ruleConfig: { ...current.ruleConfig, ...patch },
    });
    set({ settings: next });
    persist(next);
  },

  setTheme: (theme) => {
    const next = sanitizeSettings({ ...get().settings, theme });
    set({ settings: next });
    persist(next);
  },

  reset: () => {
    set({ settings: DEFAULT_SETTINGS, hydrated: true });
    persist(DEFAULT_SETTINGS);
  },
}));

export function getSettingsSnapshot(): Settings {
  return useSettingsStore.getState().settings;
}
