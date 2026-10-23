import type { TextStyle } from 'react-native';

export type ThemeMode = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

/**
 * Satu set warna untuk kedua tema. Setiap warna teks diuji terhadap
 * `surface` dan `canvas`; aksen dipakai hanya untuk satu makna.
 */
export interface ThemeColors {
  canvas: string;
  canvasGradient: readonly [string, string, string];
  /** Permukaan kartu. */
  surface: string;
  /** Permukaan di dalam kartu: input, baris info, segmen. */
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSoft: string;
  textFaint: string;
  /** Aksi utama dan pilihan aktif. */
  primary: string;
  onPrimary: string;
  primaryMuted: string;
  /** Kondisi normal dan status online. */
  secondary: string;
  success: string;
  warning: string;
  alert: string;
  /** Hanya untuk lampu. */
  lamp: string;
  chartWarm: string;
  chartCool: string;
  grid: string;
  field: string;
  fieldBorder: string;
  /** Track switch saat mati. */
  trackOff: string;
  /** Track switch saat hidup. */
  trackOn: string;
  switchThumb: string;
  thumbEdge: string;
  switchThumbOn: string;
  /** Teks aksen hangat (hemat, suhu) yang tetap terbaca. */
  accentText: string;
  overlay: string;
  shadow: string;
}

export interface ThemeTypography {
  display: TextStyle;
  headline: TextStyle;
  title: TextStyle;
  bodyLg: TextStyle;
  body: TextStyle;
  caption: TextStyle;
  label: TextStyle;
}

export interface Theme {
  mode: ResolvedTheme;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: typeof spacing;
  radius: typeof radius;
  motion: typeof motion;
  screenMargin: number;
  fonts: {
    head: string;
    headStrong: string;
    body: string;
    bodyMedium: string;
    bodySemiBold: string;
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  base: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
} as const;

export const motion = {
  fast: 120,
  base: 180,
  slow: 260,
} as const;

/** Font dimuat lewat @expo-google-fonts. Nama keluarga mengikuti file font. */
export const fontFamilies = {
  spaceGrotesk: 'SpaceGrotesk_500Medium',
  spaceGroteskSemiBold: 'SpaceGrotesk_600SemiBold',
  inter: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
} as const;

const darkColors: ThemeColors = {
  canvas: '#101817',
  canvasGradient: ['#0E1514', '#141D1B', '#101817'],
  surface: '#19221F',
  surfaceMuted: '#212B28',
  border: '#2B3733',
  borderStrong: '#3B4843',
  text: '#E9EFEC',
  textSoft: '#A3B0AB',
  textFaint: '#8B9993',
  primary: '#D9B49B',
  onPrimary: '#1A2422',
  primaryMuted: 'rgba(217,180,155,0.14)',
  secondary: '#8FB6A1',
  success: '#8FB6A1',
  warning: '#EBC97F',
  alert: '#E5A094',
  lamp: '#EBC97F',
  chartWarm: '#E0A578',
  chartCool: '#8FB6A1',
  grid: 'rgba(233,239,236,0.10)',
  field: '#212B28',
  fieldBorder: '#33403B',
  trackOff: '#46534D',
  trackOn: '#D9B49B',
  switchThumb: '#F5F8F6',
  thumbEdge: '#64726B',
  switchThumbOn: '#1A2422',
  accentText: '#E3C2AC',
  overlay: 'rgba(0,0,0,0.58)',
  shadow: '#000000',
};

const lightColors: ThemeColors = {
  canvas: '#F4F2EC',
  canvasGradient: ['#F7F5F0', '#F2EFE8', '#EFEAE1'],
  surface: '#FFFFFF',
  surfaceMuted: '#F5F3ED',
  border: '#E4DFD5',
  borderStrong: '#D2CCC0',
  text: '#1F2A26',
  textSoft: '#59665F',
  textFaint: '#5F6B64',
  primary: '#2F5D4A',
  onPrimary: '#FFFFFF',
  primaryMuted: 'rgba(47,93,74,0.10)',
  secondary: '#3E6B57',
  success: '#2F6B4F',
  warning: '#8A5A00',
  alert: '#B3261E',
  lamp: '#9A6B0F',
  chartWarm: '#A25A34',
  chartCool: '#3E6B57',
  grid: 'rgba(31,42,38,0.12)',
  field: '#F7F5EF',
  fieldBorder: '#DCD6CB',
  trackOff: '#E8E3D9',
  trackOn: '#2F5D4A',
  switchThumb: '#FFFFFF',
  thumbEdge: '#9A9488',
  switchThumbOn: '#FFFFFF',
  accentText: '#7F4626',
  overlay: 'rgba(15,23,20,0.45)',
  shadow: '#2B241D',
};

function makeTypography(): ThemeTypography {
  return {
    display: {
      fontFamily: fontFamilies.spaceGrotesk,
      fontSize: 44,
      lineHeight: 48,
      letterSpacing: -1.4,
      fontVariant: ['tabular-nums'],
    },
    headline: {
      fontFamily: fontFamilies.spaceGrotesk,
      fontSize: 26,
      lineHeight: 32,
      letterSpacing: -0.5,
    },
    title: {
      fontFamily: fontFamilies.spaceGrotesk,
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.2,
    },
    bodyLg: {
      fontFamily: fontFamilies.inter,
      fontSize: 16,
      lineHeight: 24,
    },
    body: {
      fontFamily: fontFamilies.inter,
      fontSize: 14,
      lineHeight: 20,
    },
    caption: {
      fontFamily: fontFamilies.inter,
      fontSize: 12,
      lineHeight: 16,
    },
    label: {
      fontFamily: fontFamilies.interMedium,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
  };
}

const typography = makeTypography();

function makeTheme(mode: ResolvedTheme, colors: ThemeColors): Theme {
  return {
    mode,
    colors,
    typography,
    spacing,
    radius,
    motion,
    screenMargin: 20,
    fonts: {
      head: fontFamilies.spaceGrotesk,
      headStrong: fontFamilies.spaceGroteskSemiBold,
      body: fontFamilies.inter,
      bodyMedium: fontFamilies.interMedium,
      bodySemiBold: fontFamilies.interSemiBold,
    },
  };
}

export const themes: Record<ResolvedTheme, Theme> = {
  dark: makeTheme('dark', darkColors),
  light: makeTheme('light', lightColors),
};

export const themeModes: ThemeMode[] = ['system', 'dark', 'light'];
