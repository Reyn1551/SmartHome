import { describe, expect, it } from '@jest/globals';
import { buildCounterBlocks, sumCounterRows } from '../src/data/db';
import type { CounterRow } from '../src/data/repository';

const row = (day: string, lamp: number, fan: number, occupied = 0): CounterRow => ({
  day,
  lamp_on_s: lamp,
  fan_on_s: fan,
  occupied_s: occupied,
  updated_ts: new Date(`${day}T12:00:00`).getTime(),
});

describe('agregasi counters', () => {
  it('menjumlahkan counters harian per blok', () => {
    const rows = [row('2026-10-21', 3600, 7200), row('2026-10-22', 1800, 3600)];
    const range = { fromTs: new Date(2026, 9, 21).getTime(), toTs: new Date(2026, 9, 23).getTime() };
    const blocks = buildCounterBlocks(rows, range, 86_400_000);
    expect(blocks.length).toBe(2);
    expect(blocks[0]?.lampOnS).toBe(3600);
    expect(blocks[1]?.fanOnS).toBe(3600);
  });

  it('total menjumlahkan seluruh baris', () => {
    const rows = [row('2026-10-21', 3600, 7200, 100), row('2026-10-22', 1800, 3600, 50)];
    const totals = sumCounterRows(rows);
    expect(totals.lampOnS).toBe(5400);
    expect(totals.fanOnS).toBe(10800);
    expect(totals.occupiedS).toBe(150);
    expect(totals.days).toBe(2);
  });

  it('rentang kosong menghasilkan nol', () => {
    expect(sumCounterRows([])).toEqual({ lampOnS: 0, fanOnS: 0, occupiedS: 0, days: 0 });
    expect(buildCounterBlocks([], { fromTs: 0, toTs: 1 }, 1000)).toEqual([]);
  });
});
