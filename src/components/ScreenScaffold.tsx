import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Banner } from '@/components/Banner';
import { FLOATING_NAV_HEIGHT } from '@/components/FloatingNavBar';
import { useDeviceStore, isTelemetryStale } from '@/store/deviceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatRelativeTime } from '@/core/format';
import { useNow } from '@/core/useNow';

export interface ScreenScaffoldProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Latar, area aman, dan banner status global. Waktu hanya diperbarui tiap
 * 5 detik karena banner memakai satuan menit.
 */
export function ScreenScaffold({ children, style }: ScreenScaffoldProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 10,
            paddingHorizontal: theme.screenMargin,
            paddingBottom: FLOATING_NAV_HEIGHT + insets.bottom + 16,
          },
          style,
        ]}
      >
        <StatusBanner />
        {children}
      </View>
    </View>
  );
}

/**
 * Banner status global. Komponen terpisah agar jam yang berdetak tidak
 * merender ulang seluruh isi layar.
 */
function StatusBanner() {
  const connection = useDeviceStore((s) => s.connection);
  const connectionDetail = useDeviceStore((s) => s.connectionDetail);
  const nodeStatus = useDeviceStore((s) => s.nodeStatus);
  const nodeStatusAt = useDeviceStore((s) => s.nodeStatusAt);
  const telemetryReceivedAt = useDeviceStore((s) => s.telemetryReceivedAt);
  const demoMode = useSettingsStore((s) => s.settings.demoMode);
  const now = useNow(5000);

  const brokerDown = connection === 'error' || connection === 'reconnecting';
  const stale = isTelemetryStale(telemetryReceivedAt, now);

  const banner = useMemo(() => {
    if (demoMode) {
      return <Banner tone="demo" title="Mode demo, data bukan dari perangkat" />;
    }
    if (brokerDown) {
      return (
        <Banner
          tone="offline"
          title="Broker tidak terjangkau"
          message={connectionDetail ?? 'Menyambung ulang otomatis.'}
        />
      );
    }
    if (nodeStatus === 'offline') {
      return (
        <Banner
          tone="offline"
          title="Node offline"
          message={`Nilai terakhir ${formatRelativeTime(nodeStatusAt, now)}.`}
        />
      );
    }
    if (nodeStatus === 'online' && stale && telemetryReceivedAt !== null) {
      return (
        <Banner
          tone="warning"
          title="Data sensor basi"
          message={`Telemetry terakhir ${formatRelativeTime(telemetryReceivedAt, now)}.`}
        />
      );
    }
    return null;
  }, [
    demoMode,
    brokerDown,
    nodeStatus,
    stale,
    telemetryReceivedAt,
    connectionDetail,
    nodeStatusAt,
    now,
  ]);

  return banner ? <View style={styles.bannerSlot}>{banner}</View> : null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  bannerSlot: {
    marginBottom: 12,
  },
});
