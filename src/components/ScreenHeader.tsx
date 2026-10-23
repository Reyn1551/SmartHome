import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';

export interface ScreenHeaderProps {
  title: string;
  /** Keterangan kecil di atas judul. Opsional. */
  eyebrow?: string;
  status?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Header bersama: judul layar dan satu status di kanan. */
export function ScreenHeader({ title, eyebrow, status, style }: ScreenHeaderProps) {
  const theme = useTheme();
  return (
    <View style={[styles.header, style]}>
      <View style={styles.titleBlock}>
        {eyebrow ? (
          <Text
            numberOfLines={1}
            style={[theme.typography.label, { color: theme.colors.textFaint }]}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={[theme.typography.headline, { color: theme.colors.text }]}
        >
          {title}
        </Text>
      </View>
      {status ? <View style={styles.status}>{status}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 4,
    paddingBottom: 4,
  },
  titleBlock: {
    flexShrink: 1,
    gap: 2,
  },
  status: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
});
