import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';

export interface MetricTileProps {
  label: string;
  value: string;
  unit?: string;
  accent?: 'primary' | 'secondary' | 'text';
  footer?: string;
  compact?: boolean;
}

/**
 * Angka sensor besar dengan label di atas dan satuan sejajar baseline.
 * Tidak memakai kartu sendiri agar tidak ada kotak di dalam kotak.
 */
export const MetricTile = React.memo(function MetricTile({
  label,
  value,
  unit,
  accent = 'text',
  footer,
  compact,
}: MetricTileProps) {
  const theme = useTheme();
  const isEmpty = value === '-';
  const accentColor =
    accent === 'primary'
      ? theme.colors.accentText
      : accent === 'secondary'
        ? theme.colors.secondary
        : theme.colors.text;

  return (
    <View style={styles.container}>
      <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[
            compact ? theme.typography.title : theme.typography.display,
            {
              color: isEmpty ? theme.colors.textFaint : accentColor,
              fontSize: isEmpty ? 30 : compact ? 24 : 38,
              lineHeight: isEmpty ? 36 : compact ? 30 : 44,
            },
          ]}
        >
          {value}
        </Text>
        {unit ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textSoft, marginBottom: compact ? 2 : 6 },
            ]}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      {footer ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>{footer}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    minWidth: 0,
  },
});
