import { create } from 'zustand';
import type { ConfigPayload, CountersPayload, Mode, NodeStatus, StatePayload, TelemetryPayload } from '@/core/mqttTopics';
import type { ConnectionPhase, NodePhase } from '@/data/mqtt/IMqttService';

export type CommandKey = 'mode' | 'lamp' | 'fan';
export type CommandStatus = 'idle' | 'pending' | 'failed';

export interface DeviceStoreState {
  connection: ConnectionPhase;
  connectionDetail: string | null;
  nodeStatus: NodePhase;
  /** Waktu lokal (ms) kapan status node terakhir berubah. */
  nodeStatusAt: number | null;
  telemetry: TelemetryPayload | null;
  /** Waktu lokal penerimaan telemetry, untuk deteksi basi. */
  telemetryReceivedAt: number | null;
  state: StatePayload | null;
  stateReceivedAt: number | null;
  counters: CountersPayload | null;
  config: ConfigPayload | null;
  /** Perintah yang sedang menunggu konfirmasi state. */
  pending: Record<CommandKey, boolean>;
  failed: Record<CommandKey, boolean>;
  lastCommandError: string | null;
  lastMessageAt: number | null;
  invalidPayloadCount: number;

  setConnection: (phase: ConnectionPhase, detail?: string) => void;
  setNodeStatus: (status: NodeStatus) => void;
  setTelemetry: (payload: TelemetryPayload, receivedAt: number) => void;
  setState: (payload: StatePayload, receivedAt: number) => void;
  setCounters: (payload: CountersPayload) => void;
  setConfig: (payload: ConfigPayload) => void;
  beginCommand: (key: CommandKey) => void;
  resolveCommand: (key: CommandKey) => void;
  failCommand: (key: CommandKey, message: string) => void;
  noteInvalidPayload: () => void;
  reset: () => void;
}

const initial = {
  connection: 'idle' as ConnectionPhase,
  connectionDetail: null,
  nodeStatus: 'unknown' as NodePhase,
  nodeStatusAt: null,
  telemetry: null,
  telemetryReceivedAt: null,
  state: null,
  stateReceivedAt: null,
  counters: null,
  config: null,
  pending: { mode: false, lamp: false, fan: false },
  failed: { mode: false, lamp: false, fan: false },
  lastCommandError: null,
  lastMessageAt: null,
  invalidPayloadCount: 0,
};

export const useDeviceStore = create<DeviceStoreState>((set, get) => ({
  ...initial,

  setConnection: (phase, detail) =>
    set({
      connection: phase,
      connectionDetail: detail ?? null,
    }),

  setNodeStatus: (status) =>
    set({
      nodeStatus: status,
      nodeStatusAt: Date.now(),
      lastMessageAt: Date.now(),
      // Node offline membatalkan semua perintah yang menunggu.
      pending: status === 'offline' ? { mode: false, lamp: false, fan: false } : get().pending,
    }),

  setTelemetry: (payload, receivedAt) =>
    set({
      telemetry: payload,
      telemetryReceivedAt: receivedAt,
      lastMessageAt: receivedAt,
    }),

  setState: (payload, receivedAt) =>
    set({
      state: payload,
      stateReceivedAt: receivedAt,
      lastMessageAt: receivedAt,
      pending: { mode: false, lamp: false, fan: false },
      failed: { mode: false, lamp: false, fan: false },
      lastCommandError: null,
    }),

  setCounters: (payload) => set({ counters: payload, lastMessageAt: Date.now() }),

  setConfig: (payload) => set({ config: payload }),

  beginCommand: (key) =>
    set((current) => ({
      pending: { ...current.pending, [key]: true },
      failed: { ...current.failed, [key]: false },
      lastCommandError: null,
    })),

  resolveCommand: (key) =>
    set((current) => ({
      pending: { ...current.pending, [key]: false },
      failed: { ...current.failed, [key]: false },
    })),

  failCommand: (key, message) =>
    set((current) => ({
      pending: { ...current.pending, [key]: false },
      failed: { ...current.failed, [key]: true },
      lastCommandError: message,
    })),

  noteInvalidPayload: () =>
    set((current) => ({
      invalidPayloadCount: current.invalidPayloadCount + 1,
      lastMessageAt: Date.now(),
    })),

  reset: () => set({ ...initial }),
}));

/** State mode aktif untuk UI. Default auto bila belum ada state. */
export function selectMode(state: DeviceStoreState): Mode {
  return state.state?.mode ?? 'auto';
}

/** Telemetry dianggap basi setelah 15 detik tanpa update. */
export const TELEMETRY_STALE_MS = 15_000;

export function isTelemetryStale(
  telemetryReceivedAt: number | null,
  now: number,
  threshold = TELEMETRY_STALE_MS
): boolean {
  if (telemetryReceivedAt === null) return true;
  return now - telemetryReceivedAt > threshold;
}

export function isNodeOnline(state: DeviceStoreState): boolean {
  return state.nodeStatus === 'online';
}

export function isBrokerConnected(state: DeviceStoreState): boolean {
  return state.connection === 'connected' || state.connection === 'demo';
}

/** Semua kontrol interaktif hanya aktif bila node online dan broker tersambung. */
export function controlsEnabled(state: DeviceStoreState): boolean {
  return isNodeOnline(state) && isBrokerConnected(state) && state.state !== null;
}
