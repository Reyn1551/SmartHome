import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme/ThemeProvider';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { GlassSwitch } from '@/components/GlassSwitch';
import { SectionTitle } from '@/components/SectionTitle';
import { StatusPill } from '@/components/StatusPill';
import { useDeviceStore } from '@/store/deviceStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  validateAutoOffTimeout,
  validateDarkAdc,
  validateHysteresis,
} from '@/domain/ruleEvaluator';
import { formatDecimal, parseLocaleNumber } from '@/core/format';
import type { ConfigPayload } from '@/core/mqttTopics';

type RuleKey = 'lamp_rule' | 'fan_rule' | 'autooff_rule';

export default function OtomasiScreen() {
  const theme = useTheme();
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const updateRuleConfig = useSettingsStore((s) => s.updateRuleConfig);
  const nodeStatus = useDeviceStore((s) => s.nodeStatus);
  const connection = useDeviceStore((s) => s.connection);
  const online = nodeStatus === 'online';
  const connected = connection === 'connected' || connection === 'demo';

  // Isian teks dipisah dari store agar pengguna bisa mengetik desimal/koma.
  // Versi nilai config dipakai untuk menyetel ulang isian saat node mengirim
  // config baru, tanpa setState di dalam effect.
  const ruleVersion = `${settings.ruleConfig.fan_on_c}|${settings.ruleConfig.fan_off_c}|${settings.ruleConfig.empty_timeout_s}|${settings.ruleConfig.dark_adc}`;
  const initialDraft = {
    version: ruleVersion,
    fanOn: formatDecimal(settings.ruleConfig.fan_on_c, 0),
    fanOff: formatDecimal(settings.ruleConfig.fan_off_c, 0),
    timeout: String(Math.round(settings.ruleConfig.empty_timeout_s / 60)),
    dark: String(settings.ruleConfig.dark_adc),
  };
  const [draft, setDraft] = useState(initialDraft);
  const fields = draft.version === ruleVersion ? draft : initialDraft;

  const updateDraft = (patch: Partial<typeof fields>): void => {
    setDraft({ ...fields, ...patch });
  };

  const fanOn = parseLocaleNumber(fields.fanOn);
  const fanOff = parseLocaleNumber(fields.fanOff);
  const timeoutMinutes = parseLocaleNumber(fields.timeout);
  const darkAdc = parseLocaleNumber(fields.dark);

  const hysteresisError = validateHysteresis(fanOn ?? Number.NaN, fanOff ?? Number.NaN);
  const timeoutError = validateAutoOffTimeout((timeoutMinutes ?? 0) * 60);
  const darkError = validateDarkAdc(darkAdc ?? Number.NaN);

  const ruleState = settings.ruleConfig;
  const activeCount = [ruleState.lamp_rule, ruleState.fan_rule, ruleState.autooff_rule].filter(
    Boolean
  ).length;

  // Store memperbarui state; provider mengirim config retain saat berubah.
  const commit = (patch: Partial<ConfigPayload>): void => {
    updateRuleConfig(patch);
  };

  const toggleRule = (key: RuleKey, value: boolean): void => {
    commit({ [key]: value } as Partial<ConfigPayload>);
  };

  const applyHysteresis = (): void => {
    if (hysteresisError || fanOn === null || fanOff === null) return;
    commit({ fan_on_c: fanOn, fan_off_c: fanOff });
  };

  const applyTimeout = (): void => {
    if (timeoutError || timeoutMinutes === null) return;
    commit({ empty_timeout_s: Math.round(timeoutMinutes * 60) });
  };

  const applyDark = (): void => {
    if (darkError || darkAdc === null) return;
    commit({ dark_adc: Math.round(darkAdc) });
  };

  return (
    <ScreenScaffold>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Otomasi"
          status={
            <StatusPill
              variant={online ? 'online' : nodeStatus === 'offline' ? 'offline' : 'info'}
              label={online ? 'Online' : nodeStatus === 'offline' ? 'Offline' : 'Menunggu'}
            />
          }
        />

        <GlassCard contentStyle={styles.hero}>
          <View style={styles.heroRow}>
            <Text style={[theme.typography.title, { color: theme.colors.text }]}>
              {activeCount} dari 3 aturan aktif
            </Text>
            <StatusPill
              variant={connected ? 'online' : 'warning'}
              label={connected ? 'Tersimpan' : 'Menunggu broker'}
              compact
            />
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
            {connected
              ? 'Aturan berjalan di ESP32. Perubahan langsung dikirim.'
              : 'Belum tersambung. Perubahan disimpan dan dikirim saat tersambung.'}
          </Text>
        </GlassCard>

        <View style={styles.section}>
          <SectionTitle title="Presence dan cahaya" />
          <GlassCard contentStyle={styles.ruleCard}>
            <RuleHeader
              title="Lampu menyala saat ada orang dan gelap"
              enabled={ruleState.lamp_rule}
              onToggle={(value) => toggleRule('lamp_rule', value)}
            />
            <View style={[styles.rowDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.fieldRow}>
              <View style={styles.fieldLabel}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                  Ambang gelap
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
                  Nilai ADC 0–4095
                </Text>
              </View>
              <View style={styles.fieldControl}>
                <NumberField
                  value={fields.dark}
                  onChangeText={(text) => updateDraft({ dark: text })}
                  onSubmit={applyDark}
                  placeholder="1200"
                  accessibilityLabel="Ambang gelap ADC"
                  width={80}
                />
                <Text
                  accessibilityRole="button"
                  onPress={() => router.navigate('/pengaturan' as never)}
                  style={[theme.typography.caption, { color: theme.colors.primary }]}
                >
                  Kalibrasi
                </Text>
              </View>
            </View>
            {darkError ? <FieldError text={darkError} /> : null}
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Suhu kipas" />
          <GlassCard contentStyle={styles.ruleCard}>
            <RuleHeader
              title="Kipas menyala di batas ON, mati di batas OFF"
              enabled={ruleState.fan_rule}
              onToggle={(value) => toggleRule('fan_rule', value)}
            />
            <View style={[styles.rowDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.fieldRow}>
              <View style={styles.fieldLabel}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                  Nyala pada
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
                  Minimal 1°C di atas batas mati
                </Text>
              </View>
              <View style={styles.fieldControl}>
                <NumberField
                  value={fields.fanOn}
                  onChangeText={(text) => updateDraft({ fanOn: text })}
                  onSubmit={applyHysteresis}
                  placeholder="28"
                  accessibilityLabel="Suhu nyala kipas"
                  width={64}
                />
                <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>°C</Text>
              </View>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.fieldLabel}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                  Mati pada
                </Text>
              </View>
              <View style={styles.fieldControl}>
                <NumberField
                  value={fields.fanOff}
                  onChangeText={(text) => updateDraft({ fanOff: text })}
                  onSubmit={applyHysteresis}
                  placeholder="26"
                  accessibilityLabel="Suhu mati kipas"
                  width={64}
                />
                <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>°C</Text>
              </View>
            </View>
            {hysteresisError ? <FieldError text={hysteresisError} /> : null}
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Auto-off" />
          <GlassCard contentStyle={styles.ruleCard}>
            <RuleHeader
              title="Matikan beban setelah ruangan kosong"
              enabled={ruleState.autooff_rule}
              onToggle={(value) => toggleRule('autooff_rule', value)}
            />
            <View style={[styles.rowDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.fieldRow}>
              <View style={styles.fieldLabel}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                  Tunggu selama
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
                  1–15 menit
                </Text>
              </View>
              <View style={styles.fieldControl}>
                <NumberField
                  value={fields.timeout}
                  onChangeText={(text) => updateDraft({ timeout: text })}
                  onSubmit={applyTimeout}
                  placeholder="5"
                  accessibilityLabel="Durasi auto-off"
                  width={64}
                />
                <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                  menit
                </Text>
              </View>
            </View>
            {timeoutError ? <FieldError text={timeoutError} /> : null}
          </GlassCard>
        </View>

        <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
          Perubahan dikirim ke node dan disimpan.
        </Text>
      </ScrollView>
    </ScreenScaffold>
  );
}

function RuleHeader({
  title,
  enabled,
  onToggle,
}: {
  title: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.ruleHeader}>
      <Text
        style={[
          theme.typography.body,
          {
            color: enabled ? theme.colors.text : theme.colors.textSoft,
            fontFamily: theme.fonts.bodyMedium,
            flex: 1,
          },
        ]}
      >
        {title}
      </Text>
      <GlassSwitch
        accessibilityLabel={`Aktifkan aturan ${title}`}
        value={enabled}
        onValueChange={onToggle}
      />
    </View>
  );
}

function NumberField({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  accessibilityLabel,
  width,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder: string;
  accessibilityLabel: string;
  width: number;
}) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      onBlur={onSubmit}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textFaint}
      accessibilityLabel={accessibilityLabel}
      selectionColor={theme.colors.primary}
      style={[
        theme.typography.body,
        styles.input,
        {
          width,
          color: theme.colors.text,
          backgroundColor: theme.colors.field,
          borderColor: theme.colors.fieldBorder,
        },
      ]}
    />
  );
}

function FieldError({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle-outline" size={14} color={theme.colors.alert} />
      <Text style={[theme.typography.caption, { color: theme.colors.alert, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 16,
    paddingBottom: 8,
  },
  hero: {
    gap: 6,
    padding: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  section: {
    gap: 10,
  },
  ruleCard: {
    gap: 12,
    padding: 16,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldLabel: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  fieldControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
});
