import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/core/theme/ThemeProvider';

export interface GlassSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const INSET = 3;
const THUMB = TRACK_HEIGHT - INSET * 2;
const TRAVEL = TRACK_WIDTH - THUMB - INSET * 2;

/**
 * Switch 48×28 di kedua tema. Thumb bergerak dengan animasi pendek dan
 * warnanya berubah bersamaan; tidak ada perbedaan ukuran antar tema.
 */
export function GlassSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  style,
}: GlassSwitchProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);
  const pressed = useSharedValue(0);
  const lastPressRef = React.useRef(0);

  useEffect(() => {
    const next = value ? 1 : 0;
    progress.value = reduceMotion
      ? next
      : withSpring(next, { damping: 18, stiffness: 220, mass: 0.6 });
  }, [progress, reduceMotion, value]);

  // Latar track dipisah dari thumb supaya peredupan saat nonaktif tidak
  // ikut memudarkan thumb.
  const trackFillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.trackOff, theme.colors.trackOn]
    ),
    opacity: disabled ? 0.55 : 1,
  }));

  // Border tidak memakai opacity pada kontainer: itu akan ikut memudarkan
  // thumb. Hanya isian track yang diredupkan saat nonaktif.
  const trackStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.thumbEdge, theme.colors.trackOn]
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: INSET + progress.value * TRAVEL },
      { scale: 1 - pressed.value * 0.04 },
    ],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.switchThumb, theme.colors.switchThumbOn]
    ),
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        // Cegah dua perintah dalam satu gestur cepat (double tap).
        const now = Date.now();
        if (now - lastPressRef.current < 250) return;
        lastPressRef.current = now;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          // Sebagian perangkat tidak punya haptic.
        });
        onValueChange(!value);
      }}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: theme.motion.fast });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: theme.motion.fast });
      }}
      hitSlop={10}
      style={[styles.hit, style]}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View pointerEvents="none" style={[styles.trackFill, trackFillStyle]} />
        <Animated.View
          style={[
            styles.thumb,
            {
              shadowColor: theme.colors.shadow,
              borderColor: theme.colors.thumbEdge,
            },
            thumbStyle,
          ]}
        >
          <View style={[styles.check, { opacity: value ? 1 : 0 }]}>
            <Ionicons name="checkmark" size={13} color={theme.colors.trackOn} />
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    borderWidth: 1,
  },
  trackFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
