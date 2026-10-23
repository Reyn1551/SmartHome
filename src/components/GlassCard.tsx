import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';

export type GlassTier = 1 | 2;

export interface GlassCardProps {
  children: React.ReactNode;
  tier?: GlassTier;
  radius?: number;
  /** Sorotan halus saat lampu atau kipas menyala. */
  glow?: 'lamp' | 'fan' | null;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  padded?: boolean;
}

/**
 * Permukaan kartu dasar. Sengaja tanpa blur dan tanpa lapisan tint:
 * pembedaan kedalaman dibuat lewat warna permukaan dan garis tepi.
 * Saat perangkat menyala, hanya warna garis tepi yang berubah.
 */
export function GlassCard({
  children,
  tier = 1,
  radius,
  glow = null,
  style,
  contentStyle,
  padded = true,
}: GlassCardProps) {
  const theme = useTheme();
  const resolvedRadius = radius ?? theme.radius.lg;
  const backgroundColor = tier === 1 ? theme.colors.surface : theme.colors.surfaceMuted;
  const borderColor =
    glow === 'lamp'
      ? theme.colors.lamp
      : glow === 'fan'
        ? theme.colors.secondary
        : theme.colors.border;

  return (
    <View
      style={[
        styles.outer,
        {
          borderRadius: resolvedRadius,
          backgroundColor,
          borderColor,
          shadowColor: theme.colors.shadow,
        },
        style,
      ]}
    >
      <View style={[padded ? { padding: theme.spacing.lg } : null, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
