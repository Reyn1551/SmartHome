import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/core/theme/ThemeProvider';

export type BannerTone = 'offline' | 'demo' | 'warning' | 'info';

export interface BannerProps {
  tone: BannerTone;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Banner status. Hanya satu ikon, satu judul, satu keterangan singkat.
 * Latar memakai warna permukaan agar tidak menambah warna baru ke layar.
 */
export function Banner({ tone, title, message, actionLabel, onAction, style }: BannerProps) {
  const theme = useTheme();
  const toneColor =
    tone === 'offline'
      ? theme.colors.alert
      : tone === 'warning'
        ? theme.colors.warning
        : tone === 'demo'
          ? theme.colors.primary
          : theme.colors.secondary;
  const icon =
    tone === 'offline'
      ? 'cloud-offline-outline'
      : tone === 'warning'
        ? 'alert-circle-outline'
        : tone === 'demo'
          ? 'flask-outline'
          : 'information-circle-outline';

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={18} color={toneColor} style={styles.icon} />
      <View style={styles.textWrap}>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text, fontFamily: theme.fonts.bodySemiBold },
          ]}
        >
          {title}
        </Text>
        {message ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
            {message}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          {({ pressed }) => (
            <Text
              style={[
                theme.typography.caption,
                {
                  color: theme.colors.text,
                  fontFamily: theme.fonts.bodySemiBold,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              {actionLabel}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  icon: {
    marginTop: 1,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
});
