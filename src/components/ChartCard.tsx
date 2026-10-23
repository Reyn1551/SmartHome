import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';
import { GlassCard } from './GlassCard';

export interface ChartCardProps {
  title?: string;
  subtitle?: string;
  legend?: readonly { color: string; label: string }[];
  children: React.ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Pembungkus grafik dengan judul, legenda, dan keadaan kosong. */
export function ChartCard({
  title,
  subtitle,
  legend,
  children,
  emptyMessage = 'Belum ada data untuk rentang ini.',
  isEmpty = false,
  style,
}: ChartCardProps) {
  const theme = useTheme();
  return (
    <GlassCard style={style} contentStyle={styles.content}>
      {title || subtitle ? (
        <View style={styles.header}>
          {title ? (
            <Text
              numberOfLines={1}
              style={[
                theme.typography.body,
                { color: theme.colors.text, fontFamily: theme.fonts.bodySemiBold },
              ]}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {legend && legend.length > 0 ? (
        <View style={styles.legend}>
          {legend.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {isEmpty ? (
        <View style={styles.empty}>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textSoft, textAlign: 'center' },
            ]}
          >
            {emptyMessage}
          </Text>
        </View>
      ) : (
        <View style={styles.chart}>{children}</View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
    padding: 16,
  },
  header: {
    gap: 1,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 3,
    borderRadius: 2,
  },
  chart: {
    minWidth: 0,
  },
  empty: {
    paddingVertical: 32,
    paddingHorizontal: 12,
  },
});
