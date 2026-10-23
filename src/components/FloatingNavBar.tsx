import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/core/theme/ThemeProvider';

export interface FloatingNavItem {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  activeIcon: React.ComponentProps<typeof Ionicons>['name'];
}

export const FLOATING_NAV_ITEMS: FloatingNavItem[] = [
  { name: 'index', label: 'Beranda', icon: 'home-outline', activeIcon: 'home' },
  { name: 'kontrol', label: 'Kontrol', icon: 'options-outline', activeIcon: 'options' },
  { name: 'otomasi', label: 'Otomasi', icon: 'flash-outline', activeIcon: 'flash' },
  { name: 'statistik', label: 'Statistik', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  {
    name: 'pengaturan',
    label: 'Pengaturan',
    icon: 'settings-outline',
    activeIcon: 'settings',
  },
];

export interface FloatingNavBarProps {
  activeName: string;
  onNavigate: (name: string) => void;
}

/**
 * Bilah navigasi bawah. Aktif ditandai pil berisi warna aksen, bukan
 * lingkaran penuh, agar label tetap punya ruang dan tidak terpotong.
 */
export function FloatingNavBar({ activeName, onNavigate }: FloatingNavBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: theme.colors.canvas,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        {FLOATING_NAV_ITEMS.map((item) => {
          const active = item.name === activeName;
          return (
            <Pressable
              key={item.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              onPress={() => {
                if (active) return;
                void Haptics.selectionAsync().catch(() => {
                  // Haptic opsional.
                });
                onNavigate(item.name);
              }}
              style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                style={[
                  styles.iconPill,
                  active ? { backgroundColor: theme.colors.primary } : null,
                ]}
              >
                <Ionicons
                  name={active ? item.activeIcon : item.icon}
                  size={18}
                  color={active ? theme.colors.onPrimary : theme.colors.textSoft}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  theme.typography.caption,
                  {
                    fontSize: 11,
                    lineHeight: 14,
                    color: active ? theme.colors.text : theme.colors.textSoft,
                    fontFamily: active ? theme.fonts.bodySemiBold : theme.fonts.body,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const FLOATING_NAV_HEIGHT = 68;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconPill: {
    width: 44,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
