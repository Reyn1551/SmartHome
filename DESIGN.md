---
name: Smart Room (React Native)
description: Sistem desain aplikasi Smart Room. Dua tema dengan satu palet peran, permukaan solid, dan tipografi dua keluarga. Menggantikan efek kaca bertumpuk versi awal.
themes:
  dark:
    canvas: '#101817'
    surface: '#19221F'
    surfaceMuted: '#212B28'
    border: '#2B3733'
    text: '#E9EFEC'
    textSoft: '#A3B0AB'
    textFaint: '#8B9993'
    primary: '#D9B49B'
    onPrimary: '#1A2422'
    secondary: '#8FB6A1'
    warning: '#EBC97F'
    alert: '#E5A094'
    lamp: '#EBC97F'
    chartWarm: '#E0A578'
    chartCool: '#8FB6A1'
    trackOff: '#64726B'
    trackOn: '#D9B49B'
  light:
    canvas: '#F4F2EC'
    surface: '#FFFFFF'
    surfaceMuted: '#F5F3ED'
    border: '#E4DFD5'
    text: '#1F2A26'
    textSoft: '#59665F'
    textFaint: '#5F6B64'
    primary: '#2F5D4A'
    onPrimary: '#FFFFFF'
    secondary: '#3E6B57'
    warning: '#8A5A00'
    alert: '#B3261E'
    lamp: '#9A6B0F'
    chartWarm: '#A25A34'
    chartCool: '#3E6B57'
    trackOff: '#6E6A60'
    trackOn: '#2F5D4A'
typography:
  display:   { size: 38, weight: 500, lineHeight: 44, tracking: -1.4 }   # angka sensor, tabular
  headline:  { size: 26, weight: 500, lineHeight: 32, tracking: -0.5 }
  title:     { size: 18, weight: 500, lineHeight: 24, tracking: -0.2 }
  bodyLg:    { size: 16, weight: 400, lineHeight: 24 }
  body:      { size: 14, weight: 400, lineHeight: 20 }
  caption:   { size: 12, weight: 400, lineHeight: 16 }
  label:     { size: 11, weight: 500, lineHeight: 14, tracking: 0.6, uppercase: true }
radius: { sm: 6, base: 10, md: 12, lg: 16, xl: 20, pill: 9999 }
spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, screenMargin: 20 }
fonts:
  head: 'Space Grotesk 500'
  headStrong: 'Space Grotesk 600'
  body: 'Inter 400'
  bodyMedium: 'Inter 500'
  bodySemiBold: 'Inter 600'
---

# Smart Room: panduan desain

Aplikasi ini memantau dan mengontrol satu kamar. Kesannya tenang: latar
gelap kehijauan di tema gelap, kertas hangat di tema terang, dan kartu
permukaan solid dengan garis tepi tipis. Referensi visual: 5 layar
`screen.png` di `docs/screens/`. Yang diambil dari referensi hanya hierarki
dan kepadatan; efek kaca bertumpuk diganti permukaan solid karena lebih
terbaca dan lebih ringan. Isi dan fitur mengikuti `PROMPT.md`.

## Aturan pemakaian warna

- **Primary:** satu-satunya warna aksi. Dipakai untuk segmen terpilih, track switch ON, tombol utama, dan tautan tindakan. Di gelap `#D9B49B`, di terang `#2F5D4A`.
- **Secondary/success:** status online dan kondisi normal. Jangan dipakai untuk aksi.
- **Lamp:** hanya untuk lampu. Di terang memakai `#9A6B0F` agar terbaca di atas putih.
- **Alert:** hanya untuk gangguan dan aksi merusak (offline, gagal, mati semua).
- **Warning:** data basi dan peringatan yang tidak merusak.
- Teks utama `text`, keterangan `textSoft`, stempel dan label sekunder `textFaint`. Semua pasangan teks/permukaan di kedua tema minimal 4.5:1; `textFaint` di tema terang 5.6:1.
- Satu layar maksimal memakai satu warna aksen untuk aksi. Warna hangat hanya untuk angka hemat dan suhu.
- Tema mengikuti pengaturan sistem, bisa diganti manual di Pengaturan. Simpan pilihannya.

## Permukaan kartu

Versi awal memakai `BlurView` bertumpuk. Di Android lapisan blur menambah
biaya render tanpa terlihat berbeda di atas latar polos, dan membuat teks
tipis kehilangan kontras. Keputusan sekarang:

- Kartu memakai permukaan solid (`surface`) dengan garis tepi 1 dp (`border`)
  dan radius 16. Tidak ada blur, gradien dekoratif, atau bayangan di Android.
- Di dalam kartu, kontrol dan baris info memakai `surfaceMuted`, bukan
  translusen, supaya input selalu terbaca di kedua tema.
- Sorotan lampu/kipas aktif hanya berupa perubahan warna garis tepi dan
  tint tipis 5% — bukan glow bulat.
- Kedalaman dibuat lewat urutan warna latar, bukan bayangan.

Konsekuensinya `expo-blur` tidak lagi dipakai. `expo-linear-gradient` masih
terpasang sebagai peer opsional `react-native-gifted-charts`.

## Komponen inti (buat sebagai komponen bersama, satu berkas per komponen)

| Komponen | Spesifikasi singkat |
|---|---|
| `GlassCard` | Props `tier` (1 atau 2), `radius`, `glow?: 'lamp' | 'fan'`. Permukaan solid, tanpa blur. |
| `MetricTile` | Angka besar (tabular nums) + label + satuan. Tanpa kartu sendiri, dipisah garis tipis. |
| `StatusPill` | Pil kecil dengan titik berwarna. Varian: online, offline, presence, info. |
| `DeviceTile` | Ikon dalam lingkaran, nama, status teks, toggle, baris "Daya nominal". |
| `GlassSwitch` | 48×28 dp di kedua tema. Track abu saat OFF, warna aksi saat ON, thumb memakai warna teks-di-atas-aksi (gelap di tema gelap, putih di tema terang) agar sama dengan segmen terpilih. Animasi pegas pendek, haptic ringan. |
| `SegmentedPill` | Dua sampai tiga segmen, dipakai untuk Auto/Manual dan rentang 24 Jam/7 Hari/30 Hari. |
| `FloatingNavBar` | Bilah bawah, 5 tab. Tab aktif memakai pil berisi warna primary, label tetap terbaca. |
| `ChartCard` | Pembungkus grafik. Garis suhu peach, kelembapan sage, batang lampu peach, batang kipas sage. |
| `SectionTitle` | Judul bagian tenang dengan keterangan kanan. Tanpa garis atau ikon dekoratif. |
| `Toast` / `Banner` | Banner di atas layar untuk "Node offline" dan "Mode demo aktif". |

## Tata letak

- Satu kolom di HP. Margin layar 16 dp (gelap) atau 20 dp (terang). Jarak vertikal kelipatan 4 dp, antar-grup besar 24 sampai 36 dp.
- Kartu perangkat dua kolom. Di layar > 600 dp, konten dibatasi 560 dp dan tetap satu kolom agar baris teks tidak melebar.
- Tinggalkan ruang di bawah isi sebesar tinggi `FloatingNavBar` + safe area. Navigasi bawah selalu terlihat, tanpa efek melayang atau bayangan.
- Setiap layar memakai header yang sama: judul layar dan satu `StatusPill` di kanan. Tidak ada avatar, label ruang berulang, atau tombol tanpa aksi.

## Gerak

- Perubahan nilai sensor: transisi angka 180 ms, tanpa bounce.
- Toggle: thumb bergerak dengan pegas ringan (damping 18) dan warna track/thumb menyilang. Tetap responsif saat ditekan.
- Segmen: indikator meluncur 180 ms. Tab: `shift` bawaan navigator.
- Semua animasi memakai `useReducedMotion`; bila aktif, nilai langsung berpindah tanpa animasi.
- Tekan tombol: opasitas 0.6–0.85, tanpa scale pada daftar panjang agar tidak memicu render ulang.

## Teks antarmuka

Bahasa Indonesia, kalimat pendek, tanpa jargon pemasaran. Contoh yang benar: "Ruangan kosong 5 menit, lampu dan kipas dimatikan." Contoh yang dihindari: "Pengalaman ruang cerdas yang menenangkan." Kutipan penutup di layar Statistik pada mock-up tidak dipakai.
