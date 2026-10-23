import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LineChart, yAxisSides } from 'react-native-gifted-charts';
import { useTheme } from '@/core/theme/ThemeProvider';
import type { TelemetryBucket } from '@/data/repository';
import { formatDecimal } from '@/core/format';

export interface ClimateChartProps {
  buckets: TelemetryBucket[];
  rangeLabel: string;
  width: number;
}

/**
 * Grafik garis suhu dan kelembapan. Suhu memakai sumbu kiri dalam °C,
 * kelembapan sumbu kanan 0–100%. Titik diringkas agar label sumbu X
 * tidak berdesakan di layar 360 dp.
 */
export const ClimateChart = React.memo(function ClimateChart({
  buckets: rawBuckets,
  rangeLabel,
  width,
}: ClimateChartProps) {
  const theme = useTheme();
  const buckets = useMemo(() => downsampleBuckets(rawBuckets, 7), [rawBuckets]);

  const data = useMemo(
    () =>
      buckets.map((bucket) => ({
        value: bucket.temp ?? 0,
      })),
    [buckets]
  );

  const humidityData = useMemo(
    () =>
      buckets.map((bucket) => ({
        value: bucket.hum ?? 0,
      })),
    [buckets]
  );

  const temps = buckets
    .map((bucket) => bucket.temp)
    .filter((value): value is number => value !== null);
  const minTemp = temps.length > 0 ? Math.floor(Math.min(...temps) - 1) : 20;
  const maxTemp = temps.length > 0 ? Math.ceil(Math.max(...temps) + 1) : 32;
  // Sisakan ruang label sumbu kiri (32) dan kanan (34) plus margin.
  const chartWidth = Math.max(150, width - 72);

  return (
    <View style={styles.container}>
      <LineChart
        data={data}
        width={chartWidth}
        height={150}
        initialSpacing={22}
        endSpacing={22}
        adjustToWidth
        spacing={Math.max(12, (chartWidth - 44) / Math.max(1, buckets.length - 1))}
        xAxisLabelsHeight={26}
        xAxisLabelsAtBottom
        xAxisLabelTexts={axisLabels(buckets, rangeLabel)}
        xAxisLabelTextStyle={{
          color: theme.colors.textFaint,
          fontSize: 10,
          fontFamily: theme.fonts.body,
          width: 40,
          textAlign: 'center',
        }}
        thickness={2}
        color1={theme.colors.chartWarm}
        hideDataPoints1
        curved
        curvature={0.15}
        maxValue={maxTemp - minTemp}
        yAxisOffset={minTemp}
        noOfSections={3}
        yAxisColor="transparent"
        xAxisColor={theme.colors.grid}
        rulesColor={theme.colors.grid}
        rulesType="dashed"
        dashWidth={3}
        dashGap={5}
        yAxisTextStyle={{
          color: theme.colors.textFaint,
          fontSize: 10,
          fontFamily: theme.fonts.body,
        }}
        yAxisLabelSuffix="°"
        yAxisLabelWidth={32}
        secondaryData={humidityData}
        secondaryYAxis={{
          maxValue: 100,
          noOfSections: 2,
          yAxisSide: yAxisSides.RIGHT,
          showFractionalValues: false,
          yAxisLabelWidth: 34,
          yAxisTextStyle: {
            color: theme.colors.textFaint,
            fontSize: 10,
            fontFamily: theme.fonts.body,
          },
          yAxisLabelSuffix: '%',
        }}
        secondaryLineConfig={{
          color: theme.colors.chartCool,
          thickness: 2,
          curved: true,
          curvature: 0.15,
          hideDataPoints: true,
        }}
        disableScroll
        formatYLabel={(label) => formatDecimal(Number(label), 0)}
      />
    </View>
  );
});

/**
 * Turunkan jumlah titik agar label tidak berdesakan. Nilai suhu dan
 * kelembapan dirata-rata per kelompok; jumlah sampel dijumlahkan.
 */
function downsampleBuckets(buckets: TelemetryBucket[], maxPoints: number): TelemetryBucket[] {
  if (buckets.length <= maxPoints) return buckets;
  const groupSize = Math.ceil(buckets.length / maxPoints);
  const result: TelemetryBucket[] = [];
  for (let index = 0; index < buckets.length; index += groupSize) {
    const group = buckets.slice(index, index + groupSize);
    const temps = group.map((item) => item.temp).filter((value): value is number => value !== null);
    const hums = group.map((item) => item.hum).filter((value): value is number => value !== null);
    const first = group[0];
    if (!first) continue;
    result.push({
      bucketTs: first.bucketTs,
      temp: temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
      hum: hums.length > 0 ? hums.reduce((a, b) => a + b, 0) / hums.length : null,
      samples: group.reduce((sum, item) => sum + item.samples, 0),
    });
  }
  return result;
}

/**
 * Sumbu X hanya butuh beberapa label. gifted-charts menaruh satu label per
 * titik, jadi isi label pada indeks terpilih dan sisanya string kosong.
 * Label dibuat unik agar tidak muncul tanggal yang sama berulang.
 */
function axisLabels(buckets: TelemetryBucket[], rangeLabel: string): string[] {
  if (buckets.length === 0) return [];
  const isDaily = rangeLabel.toLowerCase().includes('jam');
  const labelIndexes = new Set<number>();
  const count = Math.min(3, buckets.length);
  for (let index = 0; index < count; index += 1) {
    const position =
      count === 1 ? 0 : Math.round((index * (buckets.length - 1)) / Math.max(1, count - 1));
    labelIndexes.add(position);
  }
  const seen = new Set<string>();
  return buckets.map((bucket, index) => {
    if (!labelIndexes.has(index)) return '';
    const date = new Date(bucket.bucketTs);
    const label = isDaily
      ? `${String(date.getHours()).padStart(2, '0')}.00`
      : `${date.getDate()}/${date.getMonth() + 1}`;
    if (seen.has(label)) return '';
    seen.add(label);
    return label;
  });
}

const styles = StyleSheet.create({
  container: {
    marginLeft: -4,
  },
});
