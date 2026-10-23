import { useEffect, useState } from 'react';

type Listener = (now: number) => void;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;

function emit(): void {
  const now = Date.now();
  for (const listener of listeners) listener(now);
}

/**
 * Satu jam bersama untuk seluruh layar. Nilai dikembalikan dalam kelipatan
 * `intervalMs`, sehingga layar yang hanya butuh satuan menit tidak
 * dirender ulang setiap detik.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / intervalMs) * intervalMs);

  useEffect(() => {
    const listener: Listener = (value) => {
      const quantized = Math.floor(value / intervalMs) * intervalMs;
      setNow((previous) => (previous === quantized ? previous : quantized));
    };
    listeners.add(listener);
    if (timer === null) {
      timer = setInterval(emit, 1000);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [intervalMs]);

  return now;
}
