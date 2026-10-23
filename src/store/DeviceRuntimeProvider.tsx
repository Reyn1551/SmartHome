import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';
import { useSettingsStore } from '@/store/settingsStore';
import {
  controlsEnabled,
  isNodeOnline,
  useDeviceStore,
  type CommandKey,
} from '@/store/deviceStore';
import { normalizePrefix, type Mode } from '@/core/mqttTopics';
import { RealMqttService } from '@/data/mqtt/RealMqttService';
import { DemoSimulator } from '@/data/mqtt/DemoSimulator';
import type { IMqttService, MqttConnectionConfig, MqttServiceEvents } from '@/data/mqtt/IMqttService';
import { getHistoryStore } from '@/data/db';
import { retentionCutoff } from '@/data/repository';
import {
  LocalAlertEngine,
  installNotificationHandler,
  notificationSettingsOf,
} from '@/data/notifications';

const COMMAND_TIMEOUT_MS = 3000;

interface DeviceRuntimeValue {
  testConnection: (config: MqttConnectionConfig) => Promise<{ ok: boolean; message: string }>;
  requestMode: (mode: Mode) => Promise<void>;
  requestLamp: (on: boolean) => Promise<void>;
  requestFan: (on: boolean) => Promise<void>;
  requestAllOff: () => Promise<void>;
  reconnect: () => Promise<void>;
  controlsReady: boolean;
  commandError: string | null;
  dismissCommandError: () => void;
  brokerTestResult: { ok: boolean; message: string; at: number } | null;
  clearBrokerTest: () => void;
  invalidPayloadCount: number;
  lastInvalidPayload: string | null;
  showDemoOffer: boolean;
  acceptDemoOffer: () => void;
  dismissDemoOffer: () => void;
}

const DeviceRuntimeContext = createContext<DeviceRuntimeValue | null>(null);

export function DeviceRuntimeProvider({ children }: { children: React.ReactNode }) {
  const settings = useSettingsStore((s) => s.settings);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const updateRuleConfig = useSettingsStore((s) => s.updateRuleConfig);
  const serviceRef = useRef<IMqttService | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const configSentRef = useRef<string>('');
  const timersRef = useRef<Partial<Record<CommandKey, ReturnType<typeof setTimeout>>>>({});
  const [brokerTestResult, setBrokerTestResult] = useState<
    { ok: boolean; message: string; at: number } | null
  >(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [lastInvalidPayload, setLastInvalidPayload] = useState<string | null>(null);
  const [showDemoOffer, setShowDemoOffer] = useState(false);
  const [configNonce, setConfigNonce] = useState(0);
  const demoOfferShownRef = useRef(false);
  const invalidCount = useDeviceStore((s) => s.invalidPayloadCount);

  const controlsReady = useDeviceStore((s) => controlsEnabled(s));

  const clearPendingTimers = useCallback(() => {
    for (const timer of Object.values(timersRef.current)) clearTimeout(timer);
    timersRef.current = {};
  }, []);

  const deviceActions = useMemo(
    () => ({
      setConnection: useDeviceStore.getState().setConnection,
      setNodeStatus: useDeviceStore.getState().setNodeStatus,
      setTelemetry: useDeviceStore.getState().setTelemetry,
      setState: useDeviceStore.getState().setState,
      setCounters: useDeviceStore.getState().setCounters,
      setConfig: useDeviceStore.getState().setConfig,
      beginCommand: useDeviceStore.getState().beginCommand,
      resolveCommand: useDeviceStore.getState().resolveCommand,
      failCommand: useDeviceStore.getState().failCommand,
      noteInvalidPayload: useDeviceStore.getState().noteInvalidPayload,
    }),
    []
  );

  // Siapkan database dan notifikasi sekali saat aplikasi dibuka.
  useEffect(() => {
    installNotificationHandler();
    const store = getHistoryStore();
    store
      .init()
      .then(() => store.pruneBefore(retentionCutoff(Date.now())))
      .catch(() => {
        // Riwayat lokal opsional; aplikasi tetap berjalan.
      });
  }, []);

  // Bangun ulang service ketika mode demo / alamat broker / prefix berubah.
  useEffect(() => {
    if (!hydrated) return;
    let disposed = false;

    const cleanupTimers = (): void => {
      for (const timer of Object.values(timersRef.current)) clearTimeout(timer);
      timersRef.current = {};
    };

    const start = async (): Promise<void> => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      await serviceRef.current?.disconnect().catch(() => undefined);
      serviceRef.current = null;
      cleanupTimers();

      let activeKind: 'real' | 'demo' = settings.demoMode ? 'demo' : 'real';
      const events: MqttServiceEvents = {
        onConnectionChange: (phase, detail) => {
          if (disposed) return;
          deviceActions.setConnection(phase, detail);
          if (phase === 'connected' || phase === 'demo') {
            // Kirim ulang config retain setiap kali koneksi siap.
            configSentRef.current = '';
            setConfigNonce((value) => value + 1);
          }
          if (phase === 'error' || phase === 'reconnecting') {
            // Jangan langsung menandai node offline; node punya LWT sendiri.
            if (phase === 'error') {
              useDeviceStore.setState({ lastCommandError: detail ?? null });
            }
          }
        },
        onNodeStatus: (status) => {
          if (disposed) return;
          deviceActions.setNodeStatus(status);
          if (status === 'offline') {
            setCommandError('Node offline. Perintah tidak dikirim.');
          }
        },
        onTelemetry: (payload) => {
          if (disposed) return;
          const receivedAt = Date.now();
          deviceActions.setTelemetry(payload, receivedAt);
          if (activeKind === 'real') persistTelemetry(payload);
        },
        onState: (payload) => {
          if (disposed) return;
          deviceActions.setState(payload, Date.now());
          clearPendingTimers();
          setCommandError(null);
        },
        onCounters: (payload) => {
          if (disposed) return;
          deviceActions.setCounters(payload);
          if (activeKind === 'real') {
            getHistoryStore()
              .upsertCounters({
                day: payload.day,
                lamp_on_s: payload.lamp_on_s,
                fan_on_s: payload.fan_on_s,
                occupied_s: payload.occupied_s,
                updated_ts: Date.now(),
              })
              .catch(() => undefined);
          }
        },
        onConfig: (payload) => {
          if (disposed) return;
          deviceActions.setConfig(payload);
          updateRuleConfig(payload);
          useSettingsStore.setState((current) => ({
            settings: { ...current.settings, ruleConfig: payload },
          }));
        },
        onInvalidPayload: (topic, payload, reason) => {
          if (disposed) return;
          deviceActions.noteInvalidPayload();
          setLastInvalidPayload(`${reason} (${topic})`);
          console.warn('[SmartRoom] payload MQTT diabaikan:', reason, topic, payload.slice(0, 120));
        },
      };

      const service: IMqttService = settings.demoMode
        ? new DemoSimulator()
        : new RealMqttService({
            host: settings.brokerHost,
            port: settings.brokerPort,
            topicPrefix: normalizePrefix(settings.topicPrefix),
          });
      activeKind = service.kind;
      serviceRef.current = service;
      unsubscribeRef.current = service.subscribe(events);
      useDeviceStore.setState({ state: null, telemetry: null, counters: null, nodeStatus: 'unknown' });

      if (service.kind === 'demo') {
        await service.connect();
      } else if (settings.brokerHost) {
        await service.connect();
      } else {
        useDeviceStore.setState({
          connection: 'idle',
          connectionDetail: 'Alamat broker belum diisi. Buka Pengaturan.',
        });
      }
    };

    void start();

    return () => {
      disposed = true;
      cleanupTimers();
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      void serviceRef.current?.disconnect().catch(() => undefined);
      serviceRef.current = null;
    };
  }, [
    hydrated,
    settings.demoMode,
    settings.brokerHost,
    settings.brokerPort,
    settings.topicPrefix,
    deviceActions,
    updateRuleConfig,
    clearPendingTimers,
  ]);

  // Kirim config retain setiap kali aturan berubah dan broker siap.
  const configKey = JSON.stringify(settings.ruleConfig);
  useEffect(() => {
    if (!hydrated) return;
    const service = serviceRef.current;
    if (!service || !service.isConnected()) return;
    if (configSentRef.current === configKey) return;
    configSentRef.current = configKey;
    service.publishConfig(settings.ruleConfig).catch((error: Error) => {
      configSentRef.current = '';
      setCommandError(`Config gagal dikirim: ${error.message}`);
    });
  }, [configKey, hydrated, settings.ruleConfig, configNonce]);

  // Timer 3 detik untuk perintah yang tidak dikonfirmasi node.
  const armCommandTimeout = useCallback(
    (key: CommandKey) => {
      clearTimeout(timersRef.current[key]);
      timersRef.current[key] = setTimeout(() => {
        const current = useDeviceStore.getState();
        if (!current.pending[key]) return;
        deviceActions.failCommand(key, 'Node tidak mengonfirmasi dalam 3 detik.');
        setCommandError('Node tidak mengonfirmasi perintah dalam 3 detik.');
      }, COMMAND_TIMEOUT_MS);
    },
    [deviceActions]
  );

  const sendCommand = useCallback(
    async (key: CommandKey, action: () => Promise<void>, label: string): Promise<void> => {
      const service = serviceRef.current;
      if (!service || !controlsEnabled(useDeviceStore.getState())) {
        setCommandError('Kontrol nonaktif: node atau broker tidak tersedia.');
        return;
      }
      deviceActions.beginCommand(key);
      armCommandTimeout(key);
      try {
        await action();
      } catch (error) {
        clearTimeout(timersRef.current[key]);
        const message = error instanceof Error ? error.message : 'Perintah gagal dikirim.';
        deviceActions.failCommand(key, message);
        setCommandError(`${label} gagal: ${message}`);
      }
    },
    [armCommandTimeout, deviceActions]
  );

  const requestMode = useCallback(
    async (mode: Mode) => {
      await sendCommand('mode', async () => {
        await serviceRef.current?.setMode(mode);
      }, 'Ubah mode');
    },
    [sendCommand]
  );

  const requestLamp = useCallback(
    async (on: boolean) => {
      await sendCommand('lamp', async () => {
        await serviceRef.current?.setLamp(on);
      }, 'Ubah lampu');
    },
    [sendCommand]
  );

  const requestFan = useCallback(
    async (on: boolean) => {
      await sendCommand('fan', async () => {
        await serviceRef.current?.setFan(on);
      }, 'Ubah kipas');
    },
    [sendCommand]
  );

  const requestAllOff = useCallback(async () => {
    const service = serviceRef.current;
    if (!service || !isNodeOnline(useDeviceStore.getState())) {
      setCommandError('Kontrol nonaktif: node tidak online.');
      return;
    }
    deviceActions.beginCommand('mode');
    deviceActions.beginCommand('lamp');
    deviceActions.beginCommand('fan');
    armCommandTimeout('mode');
    armCommandTimeout('lamp');
    armCommandTimeout('fan');
    try {
      await service.setMode('manual');
      await service.setLamp(false);
      await service.setFan(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Perintah gagal dikirim.';
      deviceActions.failCommand('mode', message);
      deviceActions.failCommand('lamp', message);
      deviceActions.failCommand('fan', message);
      setCommandError(`Mati semua gagal: ${message}`);
    }
  }, [armCommandTimeout, deviceActions]);

  const reconnect = useCallback(async () => {
    configSentRef.current = '';
    const service = serviceRef.current;
    if (!service) return;
    await service.disconnect().catch(() => undefined);
    await service.connect().catch(() => undefined);
  }, []);

  const testConnection = useCallback(
    async (config: MqttConnectionConfig) => {
      const probe = new RealMqttService(config);
      const result = await probe.testConnection(config);
      setBrokerTestResult({ ...result, at: Date.now() });
      return result;
    },
    []
  );

  // Peringatan lokal saat aplikasi di depan.
  useEffect(() => {
    const engine = new LocalAlertEngine(notificationSettingsOf(settings));
    const interval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const device = useDeviceStore.getState();
      const offlineSince = device.nodeStatus === 'offline' ? device.nodeStatusAt ?? Date.now() : null;
      const nodeOfflineForMs = offlineSince === null ? 0 : Date.now() - offlineSince;
      void engine.evaluate({
        nodeOfflineForMs,
        temperature: device.telemetry?.temp ?? null,
        emptyForS: device.state?.empty_for_s ?? 0,
        lampOn: device.state?.lamp ?? false,
        fanOn: device.state?.fan ?? false,
      });
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya perubahan daftar notifikasi yang perlu membangun ulang engine
  }, [settings.notifications]);

  // Tawarkan Mode Demo bila broker tidak terjangkau 10 detik pada peluncuran
  // pertama. Tawaran hanya muncul sekali per proses.
  useEffect(() => {
    if (!hydrated || settings.demoMode || demoOfferShownRef.current) return;
    if (settings.hasLaunched) return;
    const timer = setTimeout(() => {
      const connection = useDeviceStore.getState().connection;
      if (connection !== 'connected' && connection !== 'demo') {
        demoOfferShownRef.current = true;
        setShowDemoOffer(true);
      }
    }, 10_000);
    return () => clearTimeout(timer);
  }, [hydrated, settings.demoMode, settings.hasLaunched]);

  // Saat aplikasi kembali ke depan, paksa sambung ulang bila broker terputus.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const device = useDeviceStore.getState();
      if (settings.demoMode) return;
      if (device.connection === 'reconnecting' || device.connection === 'error') {
        void reconnect();
      }
    });
    return () => subscription.remove();
  }, [settings.demoMode, reconnect]);

  const value = useMemo<DeviceRuntimeValue>(
    () => ({
      testConnection,
      requestMode,
      requestLamp,
      requestFan,
      requestAllOff,
      reconnect,
      controlsReady,
      commandError,
      dismissCommandError: () => setCommandError(null),
      brokerTestResult,
      clearBrokerTest: () => setBrokerTestResult(null),
      invalidPayloadCount: invalidCount,
      lastInvalidPayload,
      showDemoOffer,
      acceptDemoOffer: () => {
        setShowDemoOffer(false);
        useSettingsStore.getState().update({ demoMode: true, hasLaunched: true });
      },
      dismissDemoOffer: () => {
        setShowDemoOffer(false);
        useSettingsStore.getState().update({ hasLaunched: true });
      },
    }),
    [
      testConnection,
      requestMode,
      requestLamp,
      requestFan,
      requestAllOff,
      reconnect,
      commandError,
      brokerTestResult,
      invalidCount,
      lastInvalidPayload,
      controlsReady,
      showDemoOffer,
    ]
  );

  return (
    <DeviceRuntimeContext.Provider value={value}>
      {children}
      <DemoOfferModal
        visible={showDemoOffer}
        onAccept={value.acceptDemoOffer}
        onDismiss={value.dismissDemoOffer}
      />
    </DeviceRuntimeContext.Provider>
  );
}

function persistTelemetry(payload: {
  ts: number;
  temp: number | null;
  hum: number | null;
  ldr: number | null;
  presence: string | null;
}): void {
  getHistoryStore()
    .insertTelemetry({
      ts: payload.ts * 1000,
      temp: payload.temp,
      hum: payload.hum,
      ldr: payload.ldr,
      presence: payload.presence,
    })
    .catch(() => undefined);
}

export function useDeviceRuntime(): DeviceRuntimeValue {
  const ctx = useContext(DeviceRuntimeContext);
  if (!ctx) throw new Error('useDeviceRuntime harus dipakai di dalam DeviceRuntimeProvider');
  return ctx;
}

function DemoOfferModal({
  visible,
  onAccept,
  onDismiss,
}: {
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.xl,
            },
          ]}
        >
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>
            Broker belum terjangkau
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSoft }]}>
            Node belum terhubung setelah 10 detik. Pakai data simulator untuk sementara?
            Pengaturan broker tetap tersimpan.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tetap pakai broker"
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: theme.colors.field,
                  borderColor: theme.colors.fieldBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[theme.typography.body, { color: theme.colors.text }]}>
                Tetap coba broker
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Aktifkan Mode Demo"
              onPress={onAccept}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.onPrimary, fontFamily: theme.fonts.bodySemiBold },
                ]}
              >
                Mode Demo
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
});
