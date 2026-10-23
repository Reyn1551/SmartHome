import type { Presence } from '@/core/mqttTopics';

export interface PresenceDisplay {
  short: string;
  hint: string;
}

/**
 * Label kehadiran untuk UI. `mungkin_kosong` bukan "kosong": orang mungkin
 * masih duduk diam, jadi auto-off belum berjalan.
 */
export function presenceLabel(presence: Presence | null): PresenceDisplay {
  switch (presence) {
    case 'terisi':
      return { short: 'Terisi', hint: 'Ada orang' };
    case 'mungkin_kosong':
      return { short: 'Mungkin Kosong', hint: 'Tidak ada gerakan' };
    case 'kosong':
      return { short: 'Kosong', hint: 'Tidak ada orang' };
    default:
      return { short: '-', hint: 'Belum ada data' };
  }
}
