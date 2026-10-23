import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/core/theme/ThemeProvider';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { GlassSwitch } from '@/components/GlassSwitch';
import { SectionTitle } from '@/components/SectionTitle';
import { SegmentedPill } from '@/components/SegmentedPill';
import { StatusPill } from '@/components/StatusPill';
import { useDeviceRuntime } from '@/store/DeviceRuntimeProvider';
import { useDeviceStore } from '@/store/deviceStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { ThemePreference } from '@/store/settingsTypes';
import {
  ADC_MAX,
  darkThresholdFromCalibration,
  isCalibrationValid,
  lightReading,
} from '@/domain/ldr';
import { formatDecimal, formatTime, parseLocaleNumber } from '@/core/format';
import { ensureAndroidChannel, ensureNotificationPermissions } from '@/data/notifications';
import { normalizePrefix } from '@/core/mqttTopics';

export default function PengaturanScreen() {
  const theme = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const updateNotifications = useSettingsStore((s) => s.updateNotifications);
  const updateRuleConfig = useSettingsStore((s) => s.updateRuleConfig);
  const telemetry = useDeviceStore((s) => s.telemetry);
  const nodeStatus = useDeviceStore((s) => s.nodeStatus);
  const connection = useDeviceStore((s) => s.connection);
  const connectionDetail = useDeviceStore((s) => s.connectionDetail);
  const { testConnection, reconnect, brokerTestResult, clearBrokerTest } = useDeviceRuntime();

  const [host, setHost] = useState(settings.brokerHost);
  const [port, setPort] = useState(String(settings.brokerPort));
  const [prefix, setPrefix] = useState(settings.topicPrefix);
  const [lampWatts, setLampWatts] = useState(String(settings.lampWatts));
  const [fanWatts, setFanWatts] = useState(String(settings.fanWatts));
  const [tariff, setTariff] = useState(formatDecimal(settings.tariffPerKwh, 2));
  const [baselineLamp, setBaselineLamp] = useState(String(settings.baselineLampHours));
  const [baselineFan, setBaselineFan] = useState(String(settings.baselineFanHours));
  const [roomName, setRoomName] = useState(settings.roomName);
  const [testing, setTesting] = useState(false);

  const liveAdc = telemetry?.ldr ?? null;
  const savedCalibration = {
    brightAdc: settings.ldrBrightAdc ?? undefined,
    darkAdc: settings.ldrDarkAdc ?? undefined,
  };
  const calibrationValid = isCalibrationValid(savedCalibration);
  const preview = lightReading(liveAdc, savedCalibration);
  const derivedThreshold = darkThresholdFromCalibration(savedCalibration);
  const staleLdr = liveAdc === null;
  const calibrationGap =
    settings.ldrBrightAdc !== null && settings.ldrDarkAdc !== null
      ? Math.abs(settings.ldrBrightAdc - settings.ldrDarkAdc)
      : null;
  const calibrationTooClose = calibrationGap !== null && calibrationGap < 300;

  const connectionTone = useMemo(() => {
    if (settings.demoMode) return { variant: 'online' as const, label: 'Tersambung' };
    if (connection === 'connected') return { variant: 'online' as const, label: 'Tersambung' };
    if (connection === 'connecting') return { variant: 'info' as const, label: 'Menyambung' };
    if (connection === 'reconnecting')
      return { variant: 'warning' as const, label: 'Menyambung ulang' };
    if (connection === 'error') return { variant: 'offline' as const, label: 'Gagal' };
    return { variant: 'info' as const, label: 'Belum tersambung' };
  }, [settings.demoMode, connection]);

  const saveConnection = (): void => {
    const portNumber = parseLocaleNumber(port);
    update({
      brokerHost: host.trim(),
      brokerPort: portNumber === null ? 9001 : Math.round(portNumber),
      topicPrefix: normalizePrefix(prefix),
    });
    void reconnect();
  };

  const saveDevice = (): void => {
    update({
      roomName: roomName.trim() || 'Kamar 1',
      lampWatts: parseLocaleNumber(lampWatts) ?? settings.lampWatts,
      fanWatts: parseLocaleNumber(fanWatts) ?? settings.fanWatts,
      tariffPerKwh: parseLocaleNumber(tariff) ?? settings.tariffPerKwh,
      baselineLampHours: parseLocaleNumber(baselineLamp) ?? settings.baselineLampHours,
      baselineFanHours: parseLocaleNumber(baselineFan) ?? settings.baselineFanHours,
    });
  };

  const takeBright = (): void => {
    if (liveAdc === null) {
      Alert.alert('Nilai LDR belum ada', 'Tunggu telemetry dari node sebelum mengambil nilai.');
      return;
    }
    update({ ldrBrightAdc: Math.round(liveAdc) });
  };

  const takeDark = (): void => {
    if (liveAdc === null) {
      Alert.alert('Nilai LDR belum ada', 'Tunggu telemetry dari node sebelum mengambil nilai.');
      return;
    }
    update({ ldrDarkAdc: Math.round(liveAdc) });
  };

  const applyThreshold = (): void => {
    if (derivedThreshold === null) return;
    updateRuleConfig({ dark_adc: derivedThreshold });
  };

  const toggleNotification = async (
    key: 'nodeOffline' | 'highTemp' | 'emptyWithLoad',
    value: boolean
  ): Promise<void> => {
    if (value && Platform.OS !== 'web') {
      const granted = await ensureNotificationPermissions();
      if (!granted) {
        Alert.alert('Izin notifikasi ditolak', 'Aktifkan izin notifikasi di pengaturan Android.');
        return;
      }
      await ensureAndroidChannel();
    }
    updateNotifications({ [key]: value });
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScreenScaffold>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Pengaturan"
          status={
            <StatusPill variant={connectionTone.variant} label={connectionTone.label} compact />
          }
        />

        <View style={styles.section}>
          <SectionTitle title="Koneksi" hint={settings.demoMode ? 'Simulator' : 'MQTT WebSocket'} />
          <GlassCard contentStyle={styles.card}>
            <View style={styles.demoRow}>
              <View style={styles.demoText}>
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.text, fontFamily: theme.fonts.bodyMedium },
                  ]}
                >
                  Mode Demo
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
                  Data dari simulator, bukan perangkat.
                </Text>
              </View>
              <GlassSwitch
                accessibilityLabel="Aktifkan Mode Demo"
                value={settings.demoMode}
                onValueChange={(value) => update({ demoMode: value, hasLaunched: true })}
              />
            </View>

            {!settings.demoMode ? (
              <>
                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                <Field
                  label="Host atau IP laptop"
                  value={host}
                  onChangeText={setHost}
                  placeholder="192.168.1.10"
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <View style={styles.twoFields}>
                  <View style={styles.flexField}>
                    <Field
                      label="Port WebSocket"
                      value={port}
                      onChangeText={setPort}
                      placeholder="9001"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.flexField}>
                    <Field
                      label="Prefix topik"
                      value={prefix}
                      onChangeText={setPrefix}
                      placeholder="smartroom/node1"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
                <View style={styles.buttonRow}>
                  <SecondaryButton
                    label={testing ? 'Menguji' : 'Uji koneksi'}
                    disabled={testing}
                    onPress={() => {
                      setTesting(true);
                      clearBrokerTest();
                      void testConnection({
                        host: host.trim(),
                        port: Number(port) || 9001,
                        topicPrefix: normalizePrefix(prefix),
                      }).finally(() => setTesting(false));
                    }}
                  />
                  <PrimaryButton label="Simpan dan sambung" onPress={saveConnection} />
                </View>
                {brokerTestResult ? (
                  <View style={styles.inlineStatus}>
                    <Ionicons
                      name={brokerTestResult.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                      size={15}
                      color={brokerTestResult.ok ? theme.colors.success : theme.colors.alert}
                    />
                    <Text
                      style={[
                        theme.typography.caption,
                        {
                          color: brokerTestResult.ok ? theme.colors.success : theme.colors.alert,
                          flex: 1,
                        },
                      ]}
                    >
                      {brokerTestResult.message} · {formatTime(brokerTestResult.at)}
                    </Text>
                  </View>
                ) : null}
                <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                  {connectionDetail ?? connectionTone.label}. Node{' '}
                  {nodeStatus === 'online'
                    ? 'online'
                    : nodeStatus === 'offline'
                      ? 'offline'
                      : 'belum diketahui'}
                  .
                </Text>
              </>
            ) : null}
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Ruangan" />
          <GlassCard contentStyle={styles.card}>
            <Field
              label="Nama ruang"
              value={roomName}
              onChangeText={setRoomName}
              placeholder="Kamar 1"
            />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Daya nominal" hint="untuk estimasi" />
          <GlassCard contentStyle={styles.card}>
            <View style={styles.twoFields}>
              <View style={styles.flexField}>
                <Field
                  label="Lampu (W)"
                  value={lampWatts}
                  onChangeText={setLampWatts}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.flexField}>
                <Field
                  label="Kipas (W)"
                  value={fanWatts}
                  onChangeText={setFanWatts}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Field
              label="Tarif listrik (Rp/kWh)"
              value={tariff}
              onChangeText={setTariff}
              keyboardType="decimal-pad"
            />
            <View style={styles.twoFields}>
              <View style={styles.flexField}>
                <Field
                  label="Pembanding lampu (jam)"
                  value={baselineLamp}
                  onChangeText={setBaselineLamp}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.flexField}>
                <Field
                  label="Pembanding kipas (jam)"
                  value={baselineFan}
                  onChangeText={setBaselineFan}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
              Pembanding adalah asumsi jam pemakaian per hari tanpa otomasi.
            </Text>
            <PrimaryButton label="Simpan pengaturan" onPress={saveDevice} />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Kalibrasi cahaya" hint="ADC 0–4095" />
          <GlassCard contentStyle={styles.card}>
            <View style={styles.adcRow}>
              <Text style={[theme.typography.body, { color: theme.colors.text }]}>
                Nilai ADC saat ini
              </Text>
              <Text
                style={[
                  theme.typography.title,
                  { color: theme.colors.text, fontVariant: ['tabular-nums'] },
                ]}
              >
                {liveAdc !== null ? Math.round(liveAdc) : '-'}
              </Text>
            </View>
            <View style={styles.buttonRow}>
              <SecondaryButton
                label="Saat terang"
                disabled={staleLdr}
                onPress={takeBright}
                hint={settings.ldrBrightAdc !== null ? `Tersimpan ${settings.ldrBrightAdc}` : undefined}
              />
              <SecondaryButton
                label="Saat gelap"
                disabled={staleLdr}
                onPress={takeDark}
                hint={settings.ldrDarkAdc !== null ? `Tersimpan ${settings.ldrDarkAdc}` : undefined}
              />
            </View>
            <View style={styles.previewRow}>
              <Text style={[theme.typography.body, { color: theme.colors.text }]}>
                {preview ? `${preview.percent}% · ${preview.label}` : 'Belum terkalibrasi'}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                {calibrationValid ? `Ambang ${derivedThreshold} ADC` : 'Butuh dua titik'}
              </Text>
            </View>
            {staleLdr ? (
              <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                Nilai LDR belum tersedia.
              </Text>
            ) : null}
            {calibrationTooClose ? (
              <Text style={[theme.typography.caption, { color: theme.colors.alert }]}>
                Selisih dua titik terlalu kecil ({calibrationGap} ADC). Ukur ulang saat terang dan
                gelap.
              </Text>
            ) : null}
            <SecondaryButton
              label="Pakai ambang untuk aturan lampu"
              disabled={derivedThreshold === null}
              onPress={applyThreshold}
            />
            <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
              Persen cahaya = interpolasi antara nilai terang dan gelap. Ambang = titik tengah.
            </Text>
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Tema" />
          <SegmentedPill<ThemePreference>
            accessibilityLabel="Pilih tema"
            options={[
              { value: 'system', label: 'Sistem' },
              { value: 'dark', label: 'Gelap' },
              { value: 'light', label: 'Terang' },
            ]}
            value={settings.theme}
            onChange={(value) => update({ theme: value })}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle title="Notifikasi" hint="lokal" />
          <GlassCard contentStyle={styles.listCard}>
            <NotificationRow
              title="Node offline lebih dari 1 menit"
              value={settings.notifications.nodeOffline}
              onChange={(value) => void toggleNotification('nodeOffline', value)}
            />
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <NotificationRow
              title="Suhu di atas 32°C"
              value={settings.notifications.highTemp}
              onChange={(value) => void toggleNotification('highTemp', value)}
            />
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <NotificationRow
              title="Kosong tapi beban menyala lebih dari 10 menit"
              value={settings.notifications.emptyWithLoad}
              onChange={(value) => void toggleNotification('emptyWithLoad', value)}
            />
          </GlassCard>
          <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
            Notifikasi lokal hanya muncul saat aplikasi aktif.
          </Text>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Tentang" />
          <GlassCard contentStyle={styles.listCard}>
            <InfoRow label="Versi" value={appVersion} />
            <InfoRow label="Kelompok" value="KAPITA Kelompok 4" />
            <InfoRow label="Perangkat" value="ESP32, LD2410C, DHT22, LDR, relay 2 kanal" />
            <InfoRow
              label="Batas"
              value={`LDR 0–${ADC_MAX}, relay hanya ON/OFF, tanpa pengukur daya`}
            />
          </GlassCard>
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        selectionColor={theme.colors.primary}
        style={[
          theme.typography.body,
          styles.input,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.field,
            borderColor: theme.colors.fieldBorder,
          },
        ]}
      />
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.onPrimary, fontFamily: theme.fonts.bodySemiBold },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled = false,
  hint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        {
          borderColor: theme.colors.borderStrong,
          backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text style={[theme.typography.caption, { color: theme.colors.text, textAlign: 'center' }]}>
        {label}
      </Text>
      {hint ? (
        <Text
          style={[theme.typography.caption, { color: theme.colors.textFaint, textAlign: 'center' }]}
        >
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

function NotificationRow({
  title,
  value,
  onChange,
}: {
  title: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.notificationRow}>
      <Text style={[theme.typography.body, { color: theme.colors.text, flex: 1 }]}>{title}</Text>
      <GlassSwitch accessibilityLabel={title} value={value} onValueChange={onChange} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.infoRow}>
      <Text
        style={[theme.typography.caption, { color: theme.colors.textSoft, width: 76 }]}
      >
        {label}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.text, flex: 1 }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 18,
    paddingBottom: 8,
  },
  section: {
    gap: 10,
  },
  card: {
    gap: 12,
    padding: 16,
  },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  demoText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  field: {
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  twoFields: {
    flexDirection: 'row',
    gap: 10,
  },
  flexField: {
    flex: 1,
    minWidth: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 1,
  },
  inlineStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  adcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  listCard: {
    padding: 16,
    gap: 12,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
});
