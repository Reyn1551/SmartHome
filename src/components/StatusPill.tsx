import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';

export type StatusVariant = 'online' | 'offline' | 'presence' | 'info' | 'warning' | 'demo';

export interface StatusPillProps {
  variant: StatusVariant;
  label: string;
  compact?: boolean;
}

const VARIANT_LABEL: Record<StatusVariant, string> = {
  online: 'Online',
  offline: 'Offline',
  presence: 'Kehadiran',
  info: 'Info',
  warning: 'Perhatian',
  demo: 'Demo',
};

/**
 * Pil status ringkas: titik berwarna + label. Latar netral agar tidak
 * bersaing dengan tombol dan angka.
 */
export const StatusPill = React.memo(function StatusPill({
  variant,
  label,
  compact = false,
}: StatusPillProps) {
  const theme = useTheme();
  const tone =
    variant === 'online'
      ? theme.colors.success
      : variant === 'offline'
        ? theme.colors.alert
        : variant === 'warning'
          ? theme.colors.warning
          : variant === 'presence' || variant === 'demo'
            ? theme.colors.primary
            : theme.colors.textSoft;

  return (
    <View
      accessible
      accessibilityLabel={`${VARIANT_LABEL[variant]}: ${label}`}
      style={[
        styles.pill,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
          paddingVertical: compact ? 3 : 4,
          paddingHorizontal: compact ? 8 : 9,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text
        numberOfLines={1}
        style={[
          theme.typography.caption,
          {
            color: variant === 'info' ? theme.colors.textSoft : tone,
            fontFamily: theme.fonts.bodyMedium,
            fontSize: compact ? 11 : 12,
            lineHeight: compact ? 14 : 16,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
    maxWidth: '100%',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
