import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/core/theme/ThemeProvider';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { StatusPill } from '@/components/StatusPill';
import { MetricTile } from '@/components/MetricTile';
import { SectionTitle } from '@/components/SectionTitle';
import { DeviceTile } from '@/components/DeviceTile';
import { useDeviceRuntime } from '@/store/DeviceRuntimeProvider';
import { controlsEnabled, isTelemetryStale, useDeviceStore } from '@/store/deviceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { lightReading } from '@/domain/ldr';
import { calculateSavings } from '@/domain/savings';
import {
  formatCountdown,
  formatHours,
  formatHumidity,
  formatRelativeTime,
  formatRupiah,
  formatTemperature,
  formatTime,
  formatDecimal,
} from '@/core/format';
import { presenceLabel } from '@/features/home/presenceLabel';
import { useNow } from '@/core/useNow';

export default function BerandaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const telemetry = useDeviceStore((s) => s.telemetry);
  const telemetryReceivedAt = useDeviceStore((s) => s.telemetryReceivedAt);
  const state = useDeviceStore((s) => s.state);
  const counters = useDeviceStore((s) => s.counters);
  const nodeStatus = useDeviceStore((s) => s.nodeStatus);
  const pending = useDeviceStore((s) => s.pending);
  const controls = useDeviceStore((s) => controlsEnabled(s));
  const { requestLamp, requestFan } = useDeviceRuntime();
  const now = useNow(5000);
  const handleLampToggle = React.useCallback(
    (next: boolean) => {
      void requestLamp(next);
    },
    [requestLamp]
  );
  const handleFanToggle = React.useCallback(
    (next: boolean) => {
      void requestFan(next);
    },
    [requestFan]
  );

  const hasTelemetry = telemetryReceivedAt !== null;
  const stale = isTelemetryStale(telemetryReceivedAt, now);
  const isManual = state?.mode === 'manual';
  const light = lightReading(telemetry?.ldr ?? null, {
    brightAdc: settings.ldrBrightAdc ?? undefined,
    darkAdc: settings.ldrDarkAdc ?? undefined,
  });
  const presence = presenceLabel(telemetry?.presence ?? null);
  const online = nodeStatus === 'online';
  const savings = calculateSavings({
    lampOnSeconds: counters?.lamp_on_s ?? 0,
    fanOnSeconds: counters?.fan_on_s ?? 0,
    lampWatts: settings.lampWatts,
    fanWatts: settings.fanWatts,
    tariffPerKwh: settings.tariffPerKwh,
    baselineLampHours: settings.baselineLampHours,
    baselineFanHours: settings.baselineFanHours,
  });

  const presenceDetail = stale
    ? hasTelemetry
      ? 'Data basi'
      : 'Belum ada data'
    : telemetry?.presence === 'kosong' && state
      ? `Kosong ${formatCountdown(state.empty_for_s)}`
      : telemetry?.presence === 'terisi' && state?.occ_since
        ? `Sejak ${formatTime(state.occ_since * 1000)}`
        : presence.hint;

  return (
    <ScreenScaffold>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Beranda"
          status={
            <StatusPill
              variant={online ? 'online' : nodeStatus === 'offline' ? 'offline' : 'info'}
              label={online ? 'Online' : nodeStatus === 'offline' ? 'Offline' : 'Menunggu'}
            />
          }
        />

        <GlassCard contentStyle={styles.summary}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryTitle}>
              <Text style={[theme.typography.title, { color: theme.colors.text }]}>
                {settings.roomName}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                {hasTelemetry
                  ? `${stale ? 'Data basi' : 'Diperbarui'} ${formatRelativeTime(telemetryReceivedAt, now)}`
                  : 'Belum ada data sensor'}
              </Text>
            </View>
          </View>

          <View style={styles.metrics}>
            <MetricTile
              label="Suhu"
              value={formatTemperature(telemetry?.temp ?? null)}
              unit="°C"
              accent="primary"
            />
            <View style={[styles.verticalDivider, { backgroundColor: theme.colors.border }]} />
            <MetricTile
              label="Kelembapan"
              value={formatHumidity(telemetry?.hum ?? null)}
              unit="%"
              accent="secondary"
            />
          </View>

          <View style={[styles.horizontalDivider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.presenceRow}>
            <View style={styles.presenceText}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                Kehadiran
              </Text>
              <Text
                numberOfLines={1}
                style={[theme.typography.title, { color: theme.colors.text }]}
              >
                {presence.short}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
                {presenceDetail}
              </Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <SectionTitle title="Sensor" />
          <GlassCard contentStyle={styles.sensorCard}>
            <View style={styles.sensorColumn}>
              <View style={styles.sensorHeader}>
                <Ionicons name="radio-outline" size={15} color={theme.colors.textSoft} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                  LD2410C
                </Text>
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[theme.typography.title, { color: theme.colors.text }]}
              >
                {stale
                  ? hasTelemetry
                    ? 'Data basi'
                    : '-'
                  : telemetry?.dist_cm != null
                    ? `${Math.round(telemetry.dist_cm)} cm`
                    : 'Tanpa target'}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
                {stale ? (hasTelemetry ? 'Data basi' : 'Belum ada data') : 'Jarak target'}
              </Text>
            </View>
            <View style={[styles.verticalDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.sensorColumn}>
              <View style={styles.sensorHeader}>
                <Ionicons name="sunny-outline" size={15} color={theme.colors.textSoft} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                  Cahaya
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[theme.typography.title, { color: theme.colors.text }]}
              >
                {light
                  ? `${light.percent}%`
                  : telemetry?.ldr != null
                    ? `ADC ${Math.round(telemetry.ldr)}`
                    : '-'}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
                {light ? light.label : 'Belum dikalibrasi'}
              </Text>
            </View>
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Perangkat" hint={isManual ? 'Manual' : 'Auto'} />
          <View style={styles.grid}>
            <DeviceTile
              kind="lamp"
              name="Lampu"
              on={state?.lamp ?? false}
              powerWatts={settings.lampWatts}
              disabled={!controls || !isManual || pending.lamp}
              pending={pending.lamp}
              onToggle={handleLampToggle}
            />
            <DeviceTile
              kind="fan"
              name="Kipas"
              on={state?.fan ?? false}
              powerWatts={settings.fanWatts}
              disabled={!controls || !isManual || pending.fan}
              pending={pending.fan}
              onToggle={handleFanToggle}
            />
          </View>
          {!isManual ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
              Mode auto mengatur perangkat. Ubah ke Manual untuk menyalakan sendiri.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionTitle title="Hari ini" hint="Estimasi" />
          <GlassCard contentStyle={styles.todayCard}>
            <View style={styles.todayRow}>
              <TodayStat label="Lampu" value={formatHours(counters?.lamp_on_s ?? 0)} />
              <TodayStat label="Kipas" value={formatHours(counters?.fan_on_s ?? 0)} />
              <TodayStat
                label="Hemat"
                value={formatRupiah(savings.savedRupiah)}
                highlight={savings.percentAvailable}
              />
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
              {formatDecimal(savings.usedKwh, 2)} kWh terpakai
              {savings.percentAvailable
                ? ` · ${Math.round(savings.savedPercent)}% di bawah baseline`
                : ' · baseline belum diisi'}
            </Text>
            <View style={[styles.linkRow, { borderTopColor: theme.colors.border }]}>
              <LinkRow
                icon="bar-chart-outline"
                label="Statistik"
                onPress={() => router.navigate('/statistik' as never)}
              />
              <LinkRow
                icon="wifi-outline"
                label="Status koneksi"
                onPress={() => router.navigate('/pengaturan' as never)}
              />
            </View>
          </GlassCard>
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

function TodayStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.todayStat}>
      <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[
          theme.typography.title,
          { color: highlight ? theme.colors.accentText : theme.colors.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={14} color={theme.colors.textSoft} />
      <Text style={[theme.typography.caption, { color: theme.colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={theme.colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 20,
    paddingBottom: 8,
  },
  summary: {
    gap: 14,
    padding: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  metrics: {
    flexDirection: 'row',
    gap: 16,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  horizontalDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  presenceText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  section: {
    gap: 10,
  },
  sensorCard: {
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  sensorColumn: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  todayCard: {
    gap: 12,
    padding: 16,
  },
  todayRow: {
    flexDirection: 'row',
    gap: 12,
  },
  todayStat: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  linkRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  link: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
  },
});
