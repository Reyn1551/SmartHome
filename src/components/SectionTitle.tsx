import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';

export interface SectionTitleProps {
  title: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Judul bagian: teks tenang, tanpa garis atau ikon dekoratif. */
export const SectionTitle = React.memo(function SectionTitle({
  title,
  hint,
  style,
}: SectionTitleProps) {
  const theme = useTheme();
  return (
    <View style={[styles.row, style]}>
      <Text
        numberOfLines={1}
        style={[
          theme.typography.body,
          { color: theme.colors.text, fontFamily: theme.fonts.bodySemiBold },
        ]}
      >
        {title}
      </Text>
      {hint ? (
        <Text
          numberOfLines={1}
          style={[theme.typography.caption, { color: theme.colors.textFaint }]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
  },
});
