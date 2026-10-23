import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart, type barDataItem as BarDataItem } from 'react-native-gifted-charts';
import { useTheme } from '@/core/theme/ThemeProvider';
import type { CounterBlock } from '@/data/repository';
import { formatDecimal } from '@/core/format';

export interface DurationChartProps {
  blocks: CounterBlock[];
  rangeLabel: string;
  width: number;
}

/** Grafik batang berpasangan: lampu dan kipas per blok waktu. */
export const DurationChart = React.memo(function DurationChart({
  blocks,
  rangeLabel,
  width,
}: DurationChartProps) {
  const theme = useTheme();
  const chartWidth = Math.max(150, width - 40);

  // Enam blok paling banyak agar label tidak berdesakan di 360 dp.
  const visible = useMemo(() => downsampleBlocks(blocks, 6), [blocks]);

  const data = useMemo(() => {
    const items: BarDataItem[] = [];
    visible.forEach((block) => {
      items.push({
        value: Math.round((block.lampOnS / 3600) * 10) / 10,
        frontColor: theme.colors.chartWarm,
        spacing: 2,
        label: bucketLabel(block.bucketTs, rangeLabel),
        labelWidth: 34,
      });
      items.push({
        value: Math.round((block.fanOnS / 3600) * 10) / 10,
        frontColor: theme.colors.chartCool,
        spacing: 12,
      });
    });
    return items;
  }, [visible, rangeLabel, theme.colors.chartWarm, theme.colors.chartCool]);

  // Skala mengikuti blok yang benar-benar digambar, bukan seluruh riwayat.
  const maxHours = Math.max(
    1,
    ...visible.map((block) => Math.max(block.lampOnS, block.fanOnS) / 3600)
  );

  return (
    <View style={styles.container}>
      <BarChart
        data={data}
        width={chartWidth}
        height={150}
        barWidth={9}
        initialSpacing={8}
        endSpacing={8}
        maxValue={Math.ceil((maxHours + 0.4) * 2) / 2}
        noOfSections={3}
        showFractionalValues
        roundToDigits={1}
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
        xAxisLabelTextStyle={{
          color: theme.colors.textFaint,
          fontSize: 9,
          fontFamily: theme.fonts.body,
          textAlign: 'center',
        }}
        yAxisLabelSuffix="j"
        yAxisLabelWidth={28}
        xAxisLabelsHeight={24}
        formatYLabel={(label) => formatDecimal(Number(label), 1)}
        disablePress
        isAnimated={false}
      />
    </View>
  );
});

function downsampleBlocks(blocks: CounterBlock[], maxBlocks: number): CounterBlock[] {
  if (blocks.length <= maxBlocks) return blocks;
  const groupSize = Math.ceil(blocks.length / maxBlocks);
  const result: CounterBlock[] = [];
  for (let index = 0; index < blocks.length; index += groupSize) {
    const group = blocks.slice(index, index + groupSize);
    const first = group[0];
    if (!first) continue;
    result.push({
      bucketTs: first.bucketTs,
      lampOnS: group.reduce((sum, item) => sum + item.lampOnS, 0),
      fanOnS: group.reduce((sum, item) => sum + item.fanOnS, 0),
    });
  }
  return result;
}

function bucketLabel(bucketTs: number, rangeLabel: string): string {
  const date = new Date(bucketTs);
  if (rangeLabel.toLowerCase().includes('jam')) {
    return `${String(date.getHours()).padStart(2, '0')}.00`;
  }
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

const styles = StyleSheet.create({
  container: {
    marginLeft: -6,
  },
});
