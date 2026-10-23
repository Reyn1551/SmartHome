#!/usr/bin/env node
/**
 * Node ESP32 tiruan untuk demo dan pengujian tanpa hardware.
 *
 * Menyambung ke broker MQTT lewat TCP (bukan WebSocket), mempublikasikan
 * telemetry/state/counters sesuai kontrak docs/MQTT.md, dan menuruti
 * cmd/mode, cmd/lamp, cmd/fan, serta config.
 *
 * Pemakaian:
 *   node tools/mock-node.mjs [host] [port] [prefix]
 * Contoh:
 *   node tools/mock-node.mjs 192.168.1.10 1883 smartroom/node1
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mqtt = require('mqtt');

const host = process.argv[2] ?? '127.0.0.1';
const port = Number(process.argv[3] ?? 1883);
const prefix = process.argv[4] ?? 'smartroom/node1';

const state = {
  mode: 'auto',
  lamp: false,
  fan: false,
  temp: 27.2,
  hum: 62,
  ldr: 1500,
  presence: 'terisi',
  occSince: Math.floor(Date.now() / 1000),
  emptyForS: 0,
  lampOnS: 0,
  fanOnS: 0,
  occupiedS: 0,
};

const config = {
  fan_on_c: 28,
  fan_off_c: 26,
  empty_timeout_s: 300,
  dark_adc: 1200,
  lamp_rule: true,
  fan_rule: true,
  autooff_rule: true,
};

const client = mqtt.connect(`mqtt://${host}:${port}`, {
  clientId: `mock-node-${Math.random().toString(16).slice(2, 8)}`,
  will: { topic: `${prefix}/status`, payload: 'offline', qos: 1, retain: true },
});

function publishState() {
  client.publish(
    `${prefix}/state`,
    JSON.stringify({
      mode: state.mode,
      lamp: state.lamp,
      fan: state.fan,
      occ_since: state.presence === 'terisi' ? state.occSince : null,
      empty_for_s: Math.round(state.emptyForS),
    }),
    { qos: 1, retain: true }
  );
}

function publishCounters() {
  client.publish(
    `${prefix}/counters`,
    JSON.stringify({
      day: new Date().toISOString().slice(0, 10),
      lamp_on_s: Math.round(state.lampOnS),
      fan_on_s: Math.round(state.fanOnS),
      occupied_s: Math.round(state.occupiedS),
    }),
    { qos: 1, retain: true }
  );
}

function evaluate() {
  const dark = state.ldr <= config.dark_adc;
  const occupied = state.presence === 'terisi';
  if (state.mode === 'auto') {
    state.lamp = config.lamp_rule && occupied && dark;
    if (config.fan_rule) {
      if (state.temp >= config.fan_on_c) state.fan = true;
      else if (state.temp <= config.fan_off_c) state.fan = false;
    }
    if (config.autooff_rule && state.presence === 'kosong' && state.emptyForS >= config.empty_timeout_s) {
      state.lamp = false;
      state.fan = false;
    }
  }
}

client.on('connect', () => {
  console.log(`[mock-node] tersambung ke ${host}:${port}, prefix ${prefix}`);
  client.subscribe(`${prefix}/cmd/#`);
  client.subscribe(`${prefix}/config`);
  client.publish(`${prefix}/status`, 'online', { qos: 1, retain: true });
  publishState();
  publishCounters();
});

client.on('message', (topic, payload) => {
  let data;
  try {
    data = JSON.parse(payload.toString('utf8'));
  } catch {
    console.warn('[mock-node] payload rusak diabaikan:', topic);
    return;
  }
  if (topic.endsWith('/cmd/mode') && (data.mode === 'auto' || data.mode === 'manual')) {
    state.mode = data.mode;
    console.log(`[mock-node] mode -> ${state.mode}`);
  } else if (topic.endsWith('/cmd/lamp') && state.mode === 'manual') {
    state.lamp = Boolean(data.on);
    console.log(`[mock-node] lampu -> ${state.lamp ? 'ON' : 'OFF'}`);
  } else if (topic.endsWith('/cmd/fan') && state.mode === 'manual') {
    state.fan = Boolean(data.on);
    console.log(`[mock-node] kipas -> ${state.fan ? 'ON' : 'OFF'}`);
  } else if (topic.endsWith('/config')) {
    Object.assign(config, data);
    console.log('[mock-node] config diterima:', JSON.stringify(config));
  }
  publishState();
});

// Telemetry tiap 5 detik; counters tiap 60 detik.
let tick = 0;
setInterval(() => {
  tick += 5;
  const drift = (Math.random() - 0.5) * 0.4;
  state.temp = Math.min(31, Math.max(25, state.temp + drift));
  state.hum = Math.min(80, Math.max(45, state.hum + (Math.random() - 0.5) * 1.5));
  state.ldr = Math.max(200, Math.min(3800, state.ldr + (Math.random() - 0.5) * 160));

  if (tick % 60 === 0) {
    state.presence = state.presence === 'terisi' ? 'mungkin_kosong' : state.presence === 'mungkin_kosong' ? 'kosong' : 'terisi';
    if (state.presence === 'terisi') {
      state.occSince = Math.floor(Date.now() / 1000);
      state.emptyForS = 0;
    }
  }
  if (state.presence === 'kosong') state.emptyForS += 5;
  else state.emptyForS = 0;

  if (state.lamp) state.lampOnS += 5;
  if (state.fan) state.fanOnS += 5;
  if (state.presence === 'terisi') state.occupiedS += 5;

  evaluate();
  client.publish(
    `${prefix}/telemetry`,
    JSON.stringify({
      ts: Math.floor(Date.now() / 1000),
      temp: Math.round(state.temp * 10) / 10,
      hum: Math.round(state.hum),
      ldr: Math.round(state.ldr),
      presence: state.presence,
      dist_cm: state.presence === 'terisi' ? 90 + Math.round(Math.random() * 100) : null,
    }),
    { qos: 1 }
  );
  publishState();
  if (tick % 60 === 0) publishCounters();
}, 5000);

process.on('SIGINT', () => {
  client.end(true, () => process.exit(0));
});
