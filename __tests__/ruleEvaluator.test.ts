import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_RULE_CONFIG,
  evaluateAutoOffRule,
  evaluateFanRule,
  evaluateLampRule,
  validateAutoOffTimeout,
  validateDarkAdc,
  validateHysteresis,
  type RuleEvaluationInput,
} from '../src/domain/ruleEvaluator';

const baseInput: RuleEvaluationInput = {
  telemetry: { temp: 27.4, hum: 62, ldr: 900, presence: 'terisi' },
  config: { ...DEFAULT_RULE_CONFIG, darkAdc: 1200 },
  state: { lamp: false, fan: false, emptyForS: 0, mode: 'auto' },
};

describe('aturan lampu: hadir + gelap', () => {
  it('menyala saat ada orang dan ADC <= ambang gelap', () => {
    const result = evaluateLampRule(baseInput);
    expect(result.presenceOk).toBe(true);
    expect(result.darkOk).toBe(true);
    expect(result.resultOn).toBe(true);
  });

  it('tidak menyala saat ruangan terang', () => {
    const result = evaluateLampRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, ldr: 2000 },
    });
    expect(result.darkOk).toBe(false);
    expect(result.resultOn).toBe(false);
  });

  it('tidak menyala saat ruangan kosong', () => {
    const result = evaluateLampRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, presence: 'kosong' },
    });
    expect(result.presenceOk).toBe(false);
    expect(result.resultOn).toBe(false);
  });

  it('tidak menyala saat aturan dimatikan', () => {
    const result = evaluateLampRule({
      ...baseInput,
      config: { ...baseInput.config, lampRule: false },
    });
    expect(result.active).toBe(false);
    expect(result.resultOn).toBe(false);
  });

  it('LDR null tidak dianggap gelap', () => {
    const result = evaluateLampRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, ldr: null },
    });
    expect(result.darkByAdc).toBeNull();
    expect(result.resultOn).toBe(false);
  });

  it('menghitung persen cahaya dari kalibrasi bila ada', () => {
    const result = evaluateLampRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, ldr: 1800 },
      calibration: { brightAdc: 2800, darkAdc: 800 },
    });
    expect(result.lightPercent).toBe(50);
  });
});

describe('aturan kipas: hysteresis suhu', () => {
  it('menyala saat suhu >= ON (28°C)', () => {
    const result = evaluateFanRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, temp: 28 },
    });
    expect(result.aboveOn).toBe(true);
    expect(result.resultOn).toBe(true);
  });

  it('tetap menyala di antara OFF dan ON bila sebelumnya menyala', () => {
    const result = evaluateFanRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, temp: 27 },
      state: { ...baseInput.state, fan: true },
    });
    expect(result.resultOn).toBe(true);
    expect(result.belowOff).toBe(false);
  });

  it('tetap mati di antara OFF dan ON bila sebelumnya mati', () => {
    const result = evaluateFanRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, temp: 27 },
      state: { ...baseInput.state, fan: false },
    });
    expect(result.resultOn).toBe(false);
  });

  it('mati saat suhu <= OFF (26°C)', () => {
    const result = evaluateFanRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, temp: 26 },
      state: { ...baseInput.state, fan: true },
    });
    expect(result.belowOff).toBe(true);
    expect(result.resultOn).toBe(false);
  });

  it('suhu null mempertahankan state sebelumnya', () => {
    const result = evaluateFanRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, temp: null },
      state: { ...baseInput.state, fan: true },
    });
    expect(result.resultOn).toBe(true);
    expect(result.aboveOn).toBe(false);
  });

  it('aturan nonaktif tidak mengubah state', () => {
    const result = evaluateFanRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, temp: 35 },
      config: { ...baseInput.config, fanRule: false },
      state: { ...baseInput.state, fan: false },
    });
    expect(result.active).toBe(false);
    expect(result.resultOn).toBe(false);
  });
});

describe('aturan auto-off', () => {
  it('menghitung sisa waktu dan memicu setelah timeout', () => {
    const result = evaluateAutoOffRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, presence: 'kosong' },
      state: { ...baseInput.state, emptyForS: 200, lamp: true },
    });
    expect(result.empty).toBe(true);
    expect(result.remainingS).toBe(100);
    expect(result.shouldTurnOff).toBe(false);
  });

  it('memicu tepat di timeout', () => {
    const result = evaluateAutoOffRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, presence: 'kosong' },
      state: { ...baseInput.state, emptyForS: 300, lamp: true },
    });
    expect(result.shouldTurnOff).toBe(true);
    expect(result.remainingS).toBe(0);
  });

  it('tidak memicu saat aturan dimatikan', () => {
    const result = evaluateAutoOffRule({
      ...baseInput,
      telemetry: { ...baseInput.telemetry!, presence: 'kosong' },
      config: { ...baseInput.config, autoOffRule: false },
      state: { ...baseInput.state, emptyForS: 600 },
    });
    expect(result.shouldTurnOff).toBe(false);
  });
});

describe('validasi parameter', () => {
  it('hysteresis ON harus minimal 1°C di atas OFF', () => {
    expect(validateHysteresis(28, 26)).toBeNull();
    expect(validateHysteresis(27, 26)).toBeNull();
    expect(validateHysteresis(26.5, 26)).toBe(
      'Suhu ON harus lebih tinggi minimal 1°C dari suhu OFF.'
    );
    expect(validateHysteresis(26, 26)).not.toBeNull();
    expect(validateHysteresis(Number.NaN, 26)).not.toBeNull();
  });

  it('durasi auto-off 1..15 menit', () => {
    expect(validateAutoOffTimeout(60)).toBeNull();
    expect(validateAutoOffTimeout(300)).toBeNull();
    expect(validateAutoOffTimeout(900)).toBeNull();
    expect(validateAutoOffTimeout(59)).toBe('Durasi minimal 1 menit.');
    expect(validateAutoOffTimeout(901)).toBe('Durasi maksimal 15 menit.');
  });

  it('ambang ADC 0..4095', () => {
    expect(validateDarkAdc(1200)).toBeNull();
    expect(validateDarkAdc(-1)).not.toBeNull();
    expect(validateDarkAdc(4096)).not.toBeNull();
  });
});
