import { describe, expect, it } from '@jest/globals';
import {
  buildTopics,
  classifyTopic,
  DEFAULT_TOPIC_PREFIX,
  normalizePrefix,
  parseConfig,
  parseCounters,
  parseState,
  parseStatus,
  parseTelemetry,
} from '../src/core/mqttTopics';

describe('topik MQTT', () => {
  it('membangun topik dari prefix default', () => {
    const topics = buildTopics(DEFAULT_TOPIC_PREFIX);
    expect(topics.status).toBe('smartroom/node1/status');
    expect(topics.cmdMode).toBe('smartroom/node1/cmd/mode');
    expect(topics.all).toBe('smartroom/node1/#');
  });

  it('menormalkan prefix dengan spasi dan garis miring', () => {
    expect(normalizePrefix('  /smartroom/node2/  ')).toBe('smartroom/node2');
    expect(normalizePrefix('')).toBe(DEFAULT_TOPIC_PREFIX);
    expect(normalizePrefix('a//b')).toBe('a/b');
  });

  it('mengenali topik node dan menolak topik lain', () => {
    expect(classifyTopic('smartroom/node1/telemetry', 'smartroom/node1')).toBe('telemetry');
    expect(classifyTopic('smartroom/node1/cmd/mode', 'smartroom/node1')).toBe('cmdMode');
    expect(classifyTopic('smartroom/node2/telemetry', 'smartroom/node1')).toBeNull();
    expect(classifyTopic('smartroom/node1/unknown', 'smartroom/node1')).toBeNull();
  });
});

describe('parser payload', () => {
  it('membaca telemetry valid dan mempertahankan null', () => {
    const payload = parseTelemetry(
      '{"ts":1730000000,"temp":27.4,"hum":62,"ldr":2310,"presence":"terisi","dist_cm":120}'
    );
    expect(payload).toEqual({
      ts: 1730000000,
      temp: 27.4,
      hum: 62,
      ldr: 2310,
      presence: 'terisi',
      dist_cm: 120,
    });
    const withNulls = parseTelemetry(
      '{"ts":1730000000,"temp":null,"hum":null,"ldr":null,"presence":null}'
    );
    expect(withNulls?.temp).toBeNull();
    expect(withNulls?.presence).toBeNull();
  });

  it('menolak telemetry tanpa ts atau JSON rusak', () => {
    expect(parseTelemetry('{"temp":27}')).toBeNull();
    expect(parseTelemetry('{rusak')).toBeNull();
    expect(parseTelemetry('[]')).toBeNull();
    expect(parseTelemetry('"online"')).toBeNull();
  });

  it('membaca state dan memaksa empty_for_s tidak negatif', () => {
    const state = parseState(
      '{"mode":"manual","lamp":true,"fan":false,"occ_since":1730000000,"empty_for_s":-5}'
    );
    expect(state?.mode).toBe('manual');
    expect(state?.empty_for_s).toBe(0);
    expect(parseState('{"mode":"x","lamp":true,"fan":false}')).toBeNull();
  });

  it('membaca counters dengan tanggal valid', () => {
    const counters = parseCounters(
      '{"day":"2026-10-23","lamp_on_s":15120,"fan_on_s":23400,"occupied_s":28800}'
    );
    expect(counters?.lamp_on_s).toBe(15120);
    expect(parseCounters('{"day":"23-10-2026","lamp_on_s":1,"fan_on_s":1,"occupied_s":1}')).toBeNull();
  });

  it('membaca config dan memakai default aman untuk field boolean hilang', () => {
    const config = parseConfig(
      '{"fan_on_c":28,"fan_off_c":26,"empty_timeout_s":300,"dark_adc":1200}'
    );
    expect(config?.lamp_rule).toBe(true);
    expect(config?.autooff_rule).toBe(true);
    expect(parseConfig('{"fan_on_c":28}')).toBeNull();
  });

  it('status hanya online atau offline', () => {
    expect(parseStatus('"online"')).toBe('online');
    expect(parseStatus('offline')).toBe('offline');
    expect(parseStatus('online\n')).toBe('online');
    expect(parseStatus('mati')).toBeNull();
  });
});
