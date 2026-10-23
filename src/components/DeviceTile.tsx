import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/core/theme/ThemeProvider';
import { GlassCard } from './GlassCard';
import { GlassSwitch } from './GlassSwitch';

export type DeviceKind = 'lamp' | 'fan';

export interface DeviceTileProps {
  kind: DeviceKind;
  name: string;
  on: boolean;
  powerWatts: number;
  disabled: boolean;
  pending?: boolean;
  onToggle: (next: boolean) => void;
  subtitle?: string;
}

/**
 * Kartu perangkat dua kolom. Baris atas: ikon, nama, status, switch.
 * Baris bawah: satu keterangan daya nominal.
 */
export const DeviceTile = React.memo(function DeviceTile({
  kind,
  name,
  on,
  powerWatts,
  disabled,
  pending = false,
  onToggle,
  subtitle,
}: DeviceTileProps) {
  const theme = useTheme();
  const accent = kind === 'lamp' ? theme.colors.lamp : theme.colors.secondary;
  const icon = kind === 'lamp' ? 'bulb-outline' : 'aperture-outline';

  return (
    <GlassCard
      glow={on ? (kind === 'lamp' ? 'lamp' : 'fan') : null}
      radius={theme.radius.lg}
      contentStyle={styles.content}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: on ? theme.colors.surfaceMuted : 'transparent',
              borderColor: on ? 'transparent' : theme.colors.border,
            },
          ]}
        >
          <Ionicons name={icon} size={19} color={on ? accent : theme.colors.textFaint} />
        </View>
        <GlassSwitch
          value={on}
          disabled={disabled}
          accessibilityLabel={`Saklar ${name}`}
          onValueChange={onToggle}
        />
      </View>
      <View style={styles.bottom}>
        <Text
          numberOfLines={1}
          style={[
            theme.typography.body,
            { color: theme.colors.text, fontFamily: theme.fonts.bodySemiBold },
          ]}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            theme.typography.caption,
            { color: on ? accent : theme.colors.textSoft },
          ]}
        >
          {pending ? 'Menunggu node' : on ? 'Menyala' : 'Mati'}
          {subtitle ? ` · ${subtitle}` : ''}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
          {powerWatts} W nominal
        </Text>
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    gap: 12,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    gap: 1,
  },
});
