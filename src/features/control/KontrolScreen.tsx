import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/core/theme/ThemeProvider';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { SegmentedPill } from '@/components/SegmentedPill';
import { StatusPill } from '@/components/StatusPill';
import { GlassSwitch } from '@/components/GlassSwitch';
import { SectionTitle } from '@/components/SectionTitle';
import { Banner } from '@/components/Banner';
import { useDeviceRuntime } from '@/store/DeviceRuntimeProvider';
import { controlsEnabled, isTelemetryStale, useDeviceStore } from '@/store/deviceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { evaluateRules } from '@/domain/ruleEvaluator';
import { formatCountdown, formatDecimal, formatTemperature } from '@/core/format';
import type { Mode } from '@/core/mqttTopics';
import { useNow } from '@/core/useNow';

export default function KontrolScreen() {
  const theme = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const telemetry = useDeviceStore((s) => s.telemetry);
  const telemetryReceivedAt = useDeviceStore((s) => s.telemetryReceivedAt);
  const state = useDeviceStore((s) => s.state);
  const nodeStatus = useDeviceStore((s) => s.nodeStatus);
  const pending = useDeviceStore((s) => s.pending);
  const controls = useDeviceStore((s) => controlsEnabled(s));
  const lastCommandError = useDeviceStore((s) => s.lastCommandError);
  const { requestMode, requestLamp, requestFan, requestAllOff, commandError, dismissCommandError } =
    useDeviceRuntime();
  const now = useNow(5000);
  const stateReceivedAt = useDeviceStore((s) => s.stateReceivedAt);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const stale = isTelemetryStale(telemetryReceivedAt, now);
  const mode: Mode = state?.mode ?? 'auto';
  const isManual = mode === 'manual';
  const online = nodeStatus === 'online';
  const busy = pending.mode || pending.lamp || pending.fan;

  const evaluation = useMemo(
    () =>
      evaluateRules({
        telemetry: {
          temp: telemetry?.temp ?? null,
          hum: telemetry?.hum ?? null,
          ldr: telemetry?.ldr ?? null,
          presence: telemetry?.presence ?? null,
        },
        config: {
          fanOnC: settings.ruleConfig.fan_on_c,
          fanOffC: settings.ruleConfig.fan_off_c,
          emptyTimeoutS: settings.ruleConfig.empty_timeout_s,
          darkAdc: settings.ruleConfig.dark_adc,
          lampRule: settings.ruleConfig.lamp_rule,
          fanRule: settings.ruleConfig.fan_rule,
          autoOffRule: settings.ruleConfig.autooff_rule,
        },
        state: {
          lamp: state?.lamp ?? false,
          fan: state?.fan ?? false,
          emptyForS: state?.empty_for_s ?? 0,
          mode,
        },
      }),
    [telemetry, settings.ruleConfig, state, mode]
  );

  const canManualToggle = controls && isManual && !busy;
  const runAllOff = (): void => {
    setConfirmVisible(false);
    void requestAllOff();
  };

  return (
    <ScreenScaffold>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Kontrol"
          status={
            <StatusPill
              variant={online ? 'online' : nodeStatus === 'offline' ? 'offline' : 'info'}
              label={online ? 'Online' : nodeStatus === 'offline' ? 'Offline' : 'Menunggu'}
            />
          }
        />

        <View style={styles.modeBlock}>
          <SegmentedPill<Mode>
            accessibilityLabel="Mode kontrol"
            options={[
              { value: 'auto', label: 'Auto Pilot' },
              { value: 'manual', label: 'Manual' },
            ]}
            value={mode}
            disabled={!controls || pending.mode}
            onChange={(next) => void requestMode(next)}
          />
          <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
            {pending.mode
              ? 'Menunggu konfirmasi node.'
              : isManual
                ? 'Manual: saklar mengikuti perintah aplikasi.'
                : 'Auto: node memutuskan dari sensor.'}
          </Text>
        </View>

        <View style={styles.section}>
          <SectionTitle
            title="Perangkat"
            hint={`${Number(state?.lamp ?? false) + Number(state?.fan ?? false)} menyala`}
          />
          <GlassCard contentStyle={styles.deviceCard}>
            <DeviceRow
              icon="bulb-outline"
              name="Lampu"
              detail={pending.lamp ? 'Menunggu node' : state?.lamp ? 'Menyala' : 'Mati'}
              on={state?.lamp ?? false}
              disabled={!canManualToggle}
              accent={theme.colors.lamp}
              onToggle={(next) => void requestLamp(next)}
              hint={`Relay IN1 · ${settings.lampWatts} W nominal`}
            />
            <View style={[styles.rowDivider, { backgroundColor: theme.colors.border }]} />
            <DeviceRow
              icon="aperture-outline"
              name="Kipas"
              detail={pending.fan ? 'Menunggu node' : state?.fan ? 'Menyala' : 'Mati'}
              on={state?.fan ?? false}
              disabled={!canManualToggle}
              accent={theme.colors.secondary}
              onToggle={(next) => void requestFan(next)}
              hint={`Relay IN2 · ${settings.fanWatts} W nominal`}
            />
          </GlassCard>
          {!isManual ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
              Saklar hanya aktif di mode Manual.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionTitle title="Logika aktif" hint="data terakhir" />
          <GlassCard contentStyle={styles.logicCard}>
            <LogicRow
              title="Ada orang dan gelap"
              detail={
                stale
                  ? 'Data basi, memakai nilai terakhir.'
                  : `ADC ${telemetry?.ldr ?? '-'}, ambang ${settings.ruleConfig.dark_adc}.`
              }
              stateLabel={!evaluation.lamp.active ? 'Nonaktif' : evaluation.lamp.resultOn ? 'Terpenuhi' : 'Belum'}
              tone={
                !evaluation.lamp.active
                  ? 'muted'
                  : evaluation.lamp.resultOn
                    ? 'success'
                    : 'muted'
              }
            />
            <View style={[styles.rowDivider, { backgroundColor: theme.colors.border }]} />
            <LogicRow
              title="Suhu tinggi"
              detail={
                evaluation.fan.temp === null
                  ? 'Suhu tidak tersedia.'
                  : `${formatTemperature(evaluation.fan.temp)}°C, nyala ≥ ${formatDecimal(settings.ruleConfig.fan_on_c, 0)}°C, mati ≤ ${formatDecimal(settings.ruleConfig.fan_off_c, 0)}°C.`
              }
              stateLabel={
                !evaluation.fan.active
                  ? 'Nonaktif'
                  : evaluation.fan.aboveOn
                    ? 'Di atas batas'
                    : evaluation.fan.belowOff
                      ? 'Di bawah batas'
                      : 'Di antara batas'
              }
              tone={
                !evaluation.fan.active
                  ? 'muted'
                  : evaluation.fan.aboveOn
                    ? 'success'
                    : 'muted'
              }
            />
            <View style={[styles.rowDivider, { backgroundColor: theme.colors.border }]} />
            <LogicRow
              title="Auto-off saat kosong"
              detail={
                evaluation.autoOff.empty
                  ? 'Beban akan dimatikan saat waktu habis.'
                  : 'Ruangan tidak kosong.'
              }
              stateLabel={
                !evaluation.autoOff.active
                  ? 'Nonaktif'
                  : evaluation.autoOff.shouldTurnOff
                    ? 'Beban dimatikan'
                    : evaluation.autoOff.empty
                      ? 'Berjalan'
                      : 'Siaga'
              }
              tone={
                !evaluation.autoOff.active
                  ? 'muted'
                  : evaluation.autoOff.shouldTurnOff
                    ? 'alert'
                    : evaluation.autoOff.empty
                      ? 'success'
                      : 'muted'
              }
            />
          </GlassCard>
        </View>

        <AutoOffCountdown
          empty={evaluation.autoOff.empty}
          shouldTurnOff={evaluation.autoOff.shouldTurnOff}
          emptyForS={evaluation.autoOff.emptyForS}
          timeoutS={evaluation.autoOff.timeoutS}
          stateReceivedAt={stateReceivedAt}
        />

        {commandError || lastCommandError ? (
          <Banner
            tone="warning"
            title="Perintah tidak terkonfirmasi"
            message={commandError ?? lastCommandError ?? undefined}
            actionLabel="Tutup"
            onAction={() => {
              dismissCommandError();
              useDeviceStore.setState({ lastCommandError: null });
            }}
          />
        ) : null}

        <View style={styles.allOffBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !controls }}
            disabled={!controls}
            onPress={() => setConfirmVisible(true)}
            style={({ pressed }) => [
              styles.allOff,
              {
                borderColor: theme.colors.borderStrong,
                backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
                opacity: controls ? 1 : 0.4,
              },
            ]}
          >
            <Text style={[theme.typography.body, { color: theme.colors.alert, fontFamily: theme.fonts.bodySemiBold }]}>
              Mati semua
            </Text>
          </Pressable>
          <Text style={[theme.typography.caption, { color: theme.colors.textFaint, textAlign: 'center' }]}>
            Mengirim mode manual, lampu mati, kipas mati.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[theme.typography.title, { color: theme.colors.text }]}>Mati semua?</Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSoft }]}>
              Mode manual aktif dan kedua perangkat dimatikan.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmVisible(false)}
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
                  },
                ]}
              >
                <Text style={[theme.typography.body, { color: theme.colors.text }]}>Batal</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Konfirmasi mati semua"
                onPress={runAllOff}
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    backgroundColor: theme.colors.alert,
                    borderColor: theme.colors.alert,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.onPrimary, fontFamily: theme.fonts.bodySemiBold },
                  ]}
                >
                  Mati semua
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}

/**
 * Hitung mundur berdetak tiap detik. Nilai dari node hanya berubah saat
 * state berubah, jadi waktu berjalan ditambahkan dari jam lokal sejak
 * state diterima. Ini tampilan estimasi; keputusan tetap di node.
 */
function AutoOffCountdown({
  empty,
  shouldTurnOff,
  emptyForS,
  timeoutS,
  stateReceivedAt,
}: {
  empty: boolean;
  shouldTurnOff: boolean;
  emptyForS: number;
  timeoutS: number;
  stateReceivedAt: number | null;
}) {
  const theme = useTheme();
  const now = useNow(1000);
  const elapsedS = stateReceivedAt === null ? 0 : Math.max(0, (now - stateReceivedAt) / 1000);
  const effectiveEmptyS = empty ? Math.min(timeoutS, emptyForS + elapsedS) : emptyForS;
  const remainingS = Math.max(0, timeoutS - effectiveEmptyS);
  const progress = Math.min(100, Math.max(0, (effectiveEmptyS / Math.max(1, timeoutS)) * 100));

  return (
    <GlassCard contentStyle={styles.countdownCard}>
      <View style={styles.countdownHeader}>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text, fontFamily: theme.fonts.bodySemiBold },
          ]}
        >
          Auto-off
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
          {empty ? `${formatCountdown(timeoutS)} batas` : 'Belum berjalan'}
        </Text>
      </View>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>
        {empty
          ? shouldTurnOff || remainingS <= 0
            ? 'Waktu habis, menunggu node'
            : `Kosong ${formatCountdown(remainingS)} lagi`
          : 'Menunggu ruangan kosong'}
      </Text>
      {empty ? (
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceMuted }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: shouldTurnOff ? theme.colors.alert : theme.colors.primary,
                width: `${progress}%`,
              },
            ]}
          />
        </View>
      ) : (
        <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
          Dimulai saat node melaporkan ruangan kosong.
        </Text>
      )}
    </GlassCard>
  );
}

function DeviceRow({
  icon,
  name,
  detail,
  on,
  disabled,
  accent,
  onToggle,
  hint,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  name: string;
  detail: string;
  on: boolean;
  disabled: boolean;
  accent: string;
  onToggle: (next: boolean) => void;
  hint: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.deviceRow}>
      <View
        style={[
          styles.deviceIcon,
          {
            backgroundColor: on ? theme.colors.surfaceMuted : 'transparent',
            borderColor: on ? 'transparent' : theme.colors.border,
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={on ? accent : theme.colors.textFaint} />
      </View>
      <View style={styles.deviceText}>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text, fontFamily: theme.fonts.bodySemiBold },
          ]}
        >
          {name}
        </Text>
        <Text style={[theme.typography.caption, { color: on ? accent : theme.colors.textSoft }]}>
          {detail}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>{hint}</Text>
      </View>
      <GlassSwitch
        accessibilityLabel={`Saklar ${name.toLowerCase()}`}
        value={on}
        disabled={disabled}
        onValueChange={onToggle}
      />
    </View>
  );
}

function LogicRow({
  title,
  detail,
  stateLabel,
  tone,
}: {
  title: string;
  detail: string;
  stateLabel: string;
  tone: 'success' | 'alert' | 'muted';
}) {
  const theme = useTheme();
  const color =
    tone === 'success'
      ? theme.colors.success
      : tone === 'alert'
        ? theme.colors.alert
        : theme.colors.textFaint;
  return (
    <View style={styles.logicRow}>
      <View style={styles.logicText}>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text, fontFamily: theme.fonts.bodyMedium },
          ]}
        >
          {title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>{detail}</Text>
      </View>
      <View style={styles.logicState}>
        <View style={[styles.stateDot, { backgroundColor: color }]} />
        <Text style={[theme.typography.caption, { color }]}>{stateLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 16,
    paddingBottom: 8,
  },
  modeBlock: {
    gap: 8,
  },
  section: {
    gap: 10,
  },
  deviceCard: {
    padding: 16,
    gap: 14,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  logicCard: {
    padding: 16,
    gap: 14,
  },
  logicRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  logicText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  logicState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 3,
    flexShrink: 0,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  countdownCard: {
    padding: 16,
    gap: 10,
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
  },
  allOffBlock: {
    gap: 6,
  },
  allOff: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
  },
});
