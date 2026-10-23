/**
 * Format tampilan bahasa Indonesia. Fungsi murni, dipakai UI dan tes.
 * Tidak memakai Intl agar hasilnya sama di Hermes, Node, dan web.
 */

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Angka desimal gaya Indonesia: 1.444,70 */
export function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const factor = 10 ** digits;
  const rounded = Math.round(Math.abs(value) * factor) / factor;
  const fixed = rounded.toFixed(digits);
  const [integerPart, fractionPart] = fixed.split('.');
  const grouped = groupThousands(integerPart ?? '0');
  const sign = value < 0 ? '-' : '';
  if (digits === 0) return `${sign}${grouped}`;
  return `${sign}${grouped},${fractionPart ?? ''}`;
}

/** Rp 3.850 — titik ribuan, tanpa desimal. */
export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const rounded = Math.round(Math.abs(value));
  const sign = value < 0 ? '-' : '';
  return `${sign}Rp ${groupThousands(String(rounded))}`;
}

/**
 * Membaca angka yang diketik pengguna. Menerima format Indonesia
 * ("1.444,70") dan format polos ("1444.7"). Titik yang diikuti tepat tiga
 * digit dianggap pemisah ribuan bila tidak ada koma.
 */
export function parseLocaleNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes(',')) {
    const normalized = trimmed.replace(/\./g, '').replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
  const parts = trimmed.split('.');
  if (parts.length > 2) {
    const value = Number(parts.join(''));
    return Number.isFinite(value) ? value : null;
  }
  if (parts.length === 2 && parts[1]?.length === 3) {
    const value = Number(parts.join(''));
    return Number.isFinite(value) ? value : null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** 27,4 */
export function formatTemperature(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return formatDecimal(value, 1);
}

/** 62 */
export function formatHumidity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return formatDecimal(value, 0);
}

/** 4,2 jam — satu desimal, koma Indonesia. */
export function formatHours(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '-';
  }
  return `${formatDecimal(seconds / 3600, 1)} jam`;
}

/** 03:20 — hitung mundur mm:ss, nilai negatif jadi 00:00. */
export function formatCountdown(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '-';
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** 23 Okt 2026 */
export function formatDate(epochMs: number | null | undefined): string {
  if (epochMs === null || epochMs === undefined || !Number.isFinite(epochMs)) return '-';
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()] ?? '-'} ${date.getFullYear()}`;
}

/** 14:15 */
export function formatTime(epochMs: number | null | undefined): string {
  if (epochMs === null || epochMs === undefined || !Number.isFinite(epochMs)) return '-';
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return '-';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "5 menit lalu" untuk stempel data. */
export function formatRelativeTime(epochMs: number | null | undefined, now: number): string {
  if (epochMs === null || epochMs === undefined || !Number.isFinite(epochMs)) return '-';
  const diffS = Math.max(0, Math.round((now - epochMs) / 1000));
  if (diffS < 5) return 'baru saja';
  if (diffS < 60) return `${diffS} detik lalu`;
  const minutes = Math.floor(diffS / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

