import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/core/theme/ThemeProvider';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedPillProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const BORDER = 1;
const PADDING = 3;
const GAP = 2;

/**
 * Kontrol segmen dengan indikator yang meluncur ke pilihan aktif.
 * Lebar indikator dihitung dari lebar kontainer agar tetap presisi di
 * layar 360 dp sampai tablet.
 */
export function SegmentedPill<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  style,
  accessibilityLabel,
}: SegmentedPillProps<T>) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  // Lebar kontainer termasuk border dan padding; indikator harus memakai
  // kotak isi agar tepinya presisi di semua lebar layar.
  const segmentWidth =
    trackWidth > 0
      ? (trackWidth - BORDER * 2 - PADDING * 2 - GAP * (options.length - 1)) / options.length
      : 0;
  const offset = useSharedValue(0);

  useEffect(() => {
    const next = index * (segmentWidth + GAP);
    offset.value = reduceMotion ? next : withTiming(next, { duration: theme.motion.base });
  }, [index, offset, reduceMotion, segmentWidth, theme.motion.base]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              backgroundColor: theme.colors.primary,
            },
            indicatorStyle,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => {
              if (option.value === value) return;
              void Haptics.selectionAsync().catch(() => {
                // Haptic opsional.
              });
              onChange(option.value);
            }}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              style={[
                theme.typography.caption,
                {
                  color: selected ? theme.colors.onPrimary : theme.colors.textSoft,
                  fontFamily: selected ? theme.fonts.bodySemiBold : theme.fonts.bodyMedium,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: PADDING,
    borderWidth: 1,
    borderRadius: 12,
    gap: GAP,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: BORDER + PADDING,
    bottom: BORDER + PADDING,
    left: BORDER + PADDING,
    borderRadius: 9,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
