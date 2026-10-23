import { describe, expect, it } from '@jest/globals';
import { DemoSimulator } from '../src/data/mqtt/DemoSimulator';
import type { ConfigPayload, StatePayload, TelemetryPayload } from '../src/core/mqttTopics';

const baseConfig: ConfigPayload = {
  fan_on_c: 28,
  fan_off_c: 26,
  empty_timeout_s: 300,
  dark_adc: 1200,
  lamp_rule: true,
  fan_rule: true,
  autooff_rule: true,
};

function setup(): {
  sim: DemoSimulator;
  telemetry: TelemetryPayload[];
  states: StatePayload[];
  tick: () => Promise<void>;
} {
  const telemetry: TelemetryPayload[] = [];
  const states: StatePayload[] = [];
  const sim = new DemoSimulator({
    tickMs: 5000,
    startTs: new Date(2026, 9, 23, 10, 0, 0).getTime(),
    random: () => 0.5,
  });
  sim.subscribe({
    onTelemetry: (payload) => telemetry.push(payload),
    onState: (payload) => states.push(payload),
  });
  return {
    sim,
    telemetry,
    states,
    // publishConfig memicu satu tick simulasi tanpa menunggu interval nyata.
    tick: () => sim.publishConfig(baseConfig),
  };
}

describe('DemoSimulator', () => {
  it('mengirim telemetry dan state dengan bentuk kontrak', async () => {
    const { sim, telemetry, states } = setup();
    await sim.connect();
    expect(telemetry.length).toBeGreaterThan(0);
    expect(states.length).toBeGreaterThan(0);
    const payload = telemetry[0]!;
    expect(typeof payload.ts).toBe('number');
    expect(payload.presence).toBe('terisi');
    expect(typeof payload.temp).toBe('number');
    expect(typeof payload.hum).toBe('number');
    expect(typeof payload.ldr).toBe('number');
    const state = states[0]!;
    expect(state.mode).toBe('auto');
    expect(typeof state.lamp).toBe('boolean');
    expect(typeof state.fan).toBe('boolean');
    await sim.disconnect();
  });

  it('menuruti perintah manual, mengabaikan saat auto', async () => {
    const { sim, states } = setup();
    await sim.connect();
    await sim.setMode('manual');
    await sim.setLamp(true);
    expect(states.at(-1)?.mode).toBe('manual');
    expect(states.at(-1)?.lamp).toBe(true);
    await sim.setMode('auto');
    await sim.setLamp(false);
    // Di mode auto, perintah lampu diabaikan; state terakhir tetap menyala.
    expect(states.at(-1)?.lamp).toBe(true);
    await sim.disconnect();
  });

  it('mengikuti hysteresis kipas di mode auto', async () => {
    const { sim, states, tick } = setup();
    await sim.connect();
    await sim.publishConfig({ ...baseConfig, fan_on_c: 20, fan_off_c: 19 });
    expect(states.at(-1)?.fan).toBe(true);
    await sim.publishConfig({ ...baseConfig, fan_on_c: 35, fan_off_c: 34 });
    expect(states.at(-1)?.fan).toBe(false);
    await tick();
    await sim.disconnect();
  });

  it('menambah counters saat lampu menyala', async () => {
    const { sim, tick } = setup();
    const counters: number[] = [];
    sim.subscribe({ onCounters: (payload) => counters.push(payload.lamp_on_s) });
    await sim.connect();
    await sim.setMode('manual');
    await sim.setLamp(true);
    await tick();
    await tick();
    expect(counters.at(-1) ?? 0).toBeGreaterThan(0);
    await sim.disconnect();
  });
});
