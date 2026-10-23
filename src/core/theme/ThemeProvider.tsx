import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';
import { themes, type ResolvedTheme, type Theme, type ThemeMode } from './tokens';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const mode = useSettingsStore((s) => s.settings.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const hydrated = useSettingsStore((s) => s.hydrated);

  const resolved: ResolvedTheme =
    mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;

  useEffect(() => {
    if (!hydrated) return;
    // react-native-web belum menyediakan setColorScheme; abaikan di web.
    if (typeof Appearance.setColorScheme !== 'function') return;
    Appearance.setColorScheme(mode === 'system' ? 'auto' : mode);
  }, [mode, hydrated]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: themes[resolved], mode, resolved, setMode: setTheme }),
    [resolved, mode, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme harus dipakai di dalam ThemeProvider');
  return ctx.theme;
}

export function useThemeController(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeController harus dipakai di dalam ThemeProvider');
  return ctx;
}
