import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/core/theme/ThemeProvider';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GlassCard } from '@/components/GlassCard';
import { SectionTitle } from '@/components/SectionTitle';
import { SegmentedPill } from '@/components/SegmentedPill';
import { ChartCard } from '@/components/ChartCard';
import { useSettingsStore } from '@/store/settingsStore';
import { useDeviceStore } from '@/store/deviceStore';
import { getHistoryStore } from '@/data/db';
import { buildDemoHistory } from '@/data/mqtt/DemoSimulator';
import type { CounterBlock, TelemetryBucket } from '@/data/repository';
import { calculateSavings, savingsFormulaLine } from '@/domain/savings';
import { formatHours, formatRupiah, formatDecimal } from '@/core/format';
import { ClimateChart } from './ClimateChart';
import { DurationChart } from './DurationChart';

type RangeKey = '24h' | '7d' | '30d';

const RANGE_OPTIONS: readonly { value: RangeKey; label: string }[] = [
  { value: '24h', label: '24 jam' },
  { value: '7d', label: '7 hari' },
  { value: '30d', label: '30 hari' },
];

const RANGE_CONFIG: Record<
  RangeKey,
  { label: string; durationMs: number; bucketMs: number; counterBucketMs: number }
> = {
  '24h': { label: '24 jam', durationMs: 86_400_000, bucketMs: 3_600_000, counterBucketMs: 3_600_000 },
  '7d': { label: '7 hari', durationMs: 7 * 86_400_000, bucketMs: 86_400_000, counterBucketMs: 86_400_000 },
  '30d': {
    label: '30 hari',
    durationMs: 30 * 86_400_000,
    bucketMs: 86_400_000,
    counterBucketMs: 86_400_000,
  },
};

interface LoadedStats {
  telemetry: TelemetryBucket[];
  blocks: CounterBlock[];
  totals: { lampOnS: number; fanOnS: number; occupiedS: number; days: number };
}

const EMPTY_STATS: LoadedStats = {
  telemetry: [],
  blocks: [],
  totals: { lampOnS: 0, fanOnS: 0, occupiedS: 0, days: 0 },
};

export default function StatistikScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const settings = useSettingsStore((s) => s.settings);
  const liveCounters = useDeviceStore((s) => s.counters);
  const telemetryReceivedAt = useDeviceStore((s) => s.telemetryReceivedAt);
  const [range, setRange] = useState<RangeKey>('24h');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LoadedStats>(EMPTY_STATS);
  const [error, setError] = useState<string | null>(null);
  const lastRefreshRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();
      if (settings.demoMode) {
        // Mode demo memakai riwayat contoh yang dihitung, bukan SQLite.
        const demo = buildDemoHistory(range, now);
        const live = useDeviceStore.getState().counters;
        if (live && range === '24h') {
          const lastBlock = demo.blocks[demo.blocks.length - 1];
          if (lastBlock) {
            lastBlock.lampOnS += live.lamp_on_s;
            lastBlock.fanOnS += live.fan_on_s;
          }
          demo.totals.lampOnS += live.lamp_on_s;
          demo.totals.fanOnS += live.fan_on_s;
          demo.totals.occupiedS += live.occupied_s;
        }
        setStats(demo);
        return;
      }
      const store = getHistoryStore();
      await store.init();
      const config = RANGE_CONFIG[range];
      const fromTs = now - config.durationMs;
      const [telemetry, blocks, totals] = await Promise.all([
        store.queryTelemetry({ fromTs, toTs: now }, config.bucketMs),
        store.queryCounterBlocks({ fromTs, toTs: now }, config.counterBucketMs),
        store.queryTotals({ fromTs, toTs: now }),
      ]);
      setStats({ telemetry, blocks, totals });
    } catch {
      setError('Riwayat lokal tidak dapat dibaca.');
    } finally {
      setLoading(false);
    }
  }, [range, settings.demoMode]);

  useEffect(() => {
    // Ditunda satu tick agar pemuatan tidak memicu setState sinkron di effect.
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Segarkan paling banyak sekali per 30 detik saat telemetry baru masuk.
  useEffect(() => {
    if (!telemetryReceivedAt) return;
    const now = Date.now();
    if (now - lastRefreshRef.current < 30_000) return;
    lastRefreshRef.current = now;
    void load();
  }, [load, telemetryReceivedAt]);

  const effectiveTotals = useMemo(() => {
    if (stats.totals.lampOnS > 0 || stats.totals.fanOnS > 0) return stats.totals;
    if (liveCounters) {
      return {
        lampOnS: liveCounters.lamp_on_s,
        fanOnS: liveCounters.fan_on_s,
        occupiedS: liveCounters.occupied_s,
        days: 1,
      };
    }
    return stats.totals;
  }, [stats.totals, liveCounters]);

  // Baseline adalah asumsi per hari; untuk 7/30 hari dikalikan jumlah hari.
  const baselineDays = Math.max(1, stats.totals.days);
  const savingsInput = {
    lampOnSeconds: effectiveTotals.lampOnS,
    fanOnSeconds: effectiveTotals.fanOnS,
    lampWatts: settings.lampWatts,
    fanWatts: settings.fanWatts,
    tariffPerKwh: settings.tariffPerKwh,
    baselineLampHours: settings.baselineLampHours * baselineDays,
    baselineFanHours: settings.baselineFanHours * baselineDays,
  };
  const savings = calculateSavings(savingsInput);
  const formula = savingsFormulaLine(savingsInput, savings);

  const noCounters =
    stats.blocks.length === 0 && effectiveTotals.lampOnS + effectiveTotals.fanOnS === 0;
  // Lebar dalam kartu: layar − margin layar − padding kartu.
  const chartWidth = Math.min(width - theme.screenMargin * 2 - 32, 560);

  return (
    <ScreenScaffold>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Statistik" />

        <SegmentedPill<RangeKey>
          accessibilityLabel="Rentang statistik"
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
        />

        <GlassCard contentStyle={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroText}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                Pemakaian {RANGE_CONFIG[range].label}
              </Text>
              <Text
                style={[theme.typography.headline, { color: theme.colors.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatDecimal(savings.usedKwh, 2)} kWh
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
                {formatHours(effectiveTotals.lampOnS)} lampu · {formatHours(effectiveTotals.fanOnS)} kipas
              </Text>
            </View>
            <View style={styles.heroSaving}>
              <Text style={[theme.typography.headline, { color: theme.colors.accentText }]}>
                {savings.percentAvailable ? `${Math.round(savings.savedPercent)}%` : '-'}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
                estimasi hemat
              </Text>
            </View>
          </View>
        </GlassCard>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} size="small" />
            <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
              Memuat riwayat
            </Text>
          </View>
        ) : null}
        {error ? (
          <Text style={[theme.typography.caption, { color: theme.colors.alert }]}>{error}</Text>
        ) : null}

        <View style={styles.section}>
          <SectionTitle title="Suhu dan kelembapan" hint="rata-rata per blok" />
          <ChartCard
            legend={[
              { color: theme.colors.chartWarm, label: 'Suhu' },
              { color: theme.colors.chartCool, label: 'Kelembapan' },
            ]}
            isEmpty={!loading && stats.telemetry.length === 0}
            emptyMessage="Belum ada telemetry tersimpan untuk rentang ini."
          >
            <ClimateChart
              buckets={stats.telemetry}
              rangeLabel={RANGE_CONFIG[range].label}
              width={chartWidth}
            />
          </ChartCard>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Durasi perangkat" hint="jam nyala" />
          <ChartCard
            legend={[
              { color: theme.colors.chartWarm, label: 'Lampu' },
              { color: theme.colors.chartCool, label: 'Kipas' },
            ]}
            isEmpty={!loading && noCounters}
            emptyMessage="Belum ada counters dari node untuk rentang ini."
          >
            <DurationChart
              blocks={stats.blocks}
              rangeLabel={RANGE_CONFIG[range].label}
              width={chartWidth}
            />
          </ChartCard>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Estimasi hemat" hint="bukan pengukuran daya" />
          <GlassCard contentStyle={styles.savingsCard}>
            <View style={styles.savingsTop}>
              <Text style={[theme.typography.headline, { color: theme.colors.text }]}>
                {formatRupiah(savings.savedRupiah)}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                {formatDecimal(savings.savedKwh, 2)} kWh dari baseline{' '}
                {formatDecimal(savings.baselineKwh, 2)} kWh
              </Text>
            </View>

            <View style={[styles.formulaBox, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSoft }]}>
                Energi terpakai
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.text }]}>{formula}</Text>
            </View>

            <Text style={[theme.typography.caption, { color: theme.colors.textFaint }]}>
              Baseline {formatDecimal(settings.baselineLampHours, 0)} jam lampu +{' '}
              {formatDecimal(settings.baselineFanHours, 0)} jam kipas per hari, tarif{' '}
              {formatRupiah(settings.tariffPerKwh)}/kWh. Estimasi, bukan hasil pengukuran daya.
            </Text>
          </GlassCard>
        </View>

        <View style={styles.noteRow}>
          <Ionicons name="information-circle-outline" size={14} color={theme.colors.textFaint} />
          <Text style={[theme.typography.caption, { color: theme.colors.textFaint, flex: 1 }]}>
            Telemetry disimpan di HP maksimal 30 hari.
          </Text>
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 16,
    paddingBottom: 8,
  },
  hero: {
    padding: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  heroSaving: {
    alignItems: 'flex-end',
    gap: 0,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  section: {
    gap: 10,
  },
  savingsCard: {
    gap: 10,
    padding: 16,
  },
  savingsTop: {
    gap: 2,
  },
  formulaBox: {
    padding: 10,
    borderRadius: 8,
    gap: 2,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 2,
  },
});
