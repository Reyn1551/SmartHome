# PROMPT: Aplikasi Smart Room (React Native)

Salin seluruh isi berkas ini ke AI coding agent (Claude Code, Cursor, dsb.). Sertakan juga `DESIGN.md` dan `TASKS.md` di folder proyek, dan 5 gambar `screen.png` dari paket Stitch sebagai acuan visual.

---

## Peran dan tujuan

Kamu membangun aplikasi mobile **Smart Room** dengan **React Native (Expo, TypeScript)**, Android lebih dulu. Aplikasi ini pendamping satu perangkat IoT buatan kami: node ESP32 yang menyalakan lampu dan kipas hanya saat ada orang. Aplikasi memantau, mengubah mode, dan menampilkan estimasi penghematan. **Aplikasi bukan otak sistem.** Aturan lampu dan kipas berjalan di ESP32, jadi sistem tetap bekerja kalau HP atau internet mati.

Ini proyek mata kuliah (KAPITA, Kelompok 4), bukan produk komersial. Pilih yang sederhana dan bisa didemokan. Jangan menambah fitur di luar daftar di bawah.

## Hardware yang dirancang (batas fitur)

| Bagian | Komponen | Yang bisa dibaca atau dikendalikan |
|---|---|---|
| Kehadiran | LD2410C (mmWave 24 GHz, UART) | Status: `terisi`, `mungkin_kosong`, `kosong`. Opsional: jarak target dan energi gerak/diam. |
| Suhu dan kelembapan | DHT22 | °C dan %RH, tiap beberapa detik. |
| Cahaya | Modul LDR (ADC, GPIO34) | Nilai ADC 0 sampai 4095. **Bukan lux.** |
| Aktuator | Relay 2 channel | Lampu (IN1) dan kipas (IN2). **Hanya ON/OFF.** |
| Beban | Lampu LED dan kipas DC 5 V | Tidak ada pengukur daya. |
| Jaringan | Wi-Fi ESP32, broker Mosquitto di laptop | MQTT. |

### Yang TIDAK ada di hardware kami, jadi jangan dibuat

Karena mock-up Stitch memuat fitur yang tidak bisa dijalankan hardware ini, abaikan hal berikut walau ada di gambar:

- Dimmer kecerahan dan slider suhu warna lampu (relay hanya ON/OFF).
- Kecepatan kipas 1/2/3 (hanya ON/OFF).
- Lux dari "BH1750" dan angka "84 Lux". Pakai nilai LDR yang dikalibrasi jadi persen, dan label **Terang / Redup / Gelap**.
- Daya real-time "10 Watt / 35 Watt" dari sensor. Daya adalah **angka nominal yang diisi pengguna** di Pengaturan, dan harus ditulis "nominal".
- Mode Tidur dengan "senyap < 24 dB", jadwal Hari Kerja/Akhir Pekan, preset ambience (Fokus Pagi, Sinema Senja, Istirahat), Mode Ambient Santai.
- Login PIN, onboarding panjang, "sinkronisasi cloud", nama pengguna "Hendra Kusuma", foto pegunungan. Tidak ada akun. Satu perangkat, satu pengguna.
- Angka "Hemat 32%", "Rp 70.500/bln", "-42%" dan semacamnya dari mock-up. Semua angka harus **dihitung dari data nyata atau mode demo**, bukan ditulis tetap.

## Arsitektur sistem (jangan diubah)

```
ESP32 (logika lokal) ──Wi-Fi/MQTT──> Mosquitto (laptop) ──WebSocket──> Aplikasi RN
   │                                      │
   ├─ LD2410C, DHT22, LDR                 └─ juga dibaca Node-RED/Grafana/Telegram (di luar aplikasi)
   └─ Relay → lampu, kipas
```

Aplikasi RN tidak bisa memakai MQTT lewat TCP biasa. Gunakan **MQTT over WebSocket** (library `mqtt` / mqtt.js). Broker Mosquitto perlu listener websockets, contoh di `mosquitto.conf`:

```
listener 1883
listener 9001
protocol websockets
allow_anonymous true
```

Sertakan berkas `docs/mosquitto.conf` berisi contoh itu dan catatan bahwa `allow_anonymous true` hanya untuk jaringan lab/demo.

## Kontrak MQTT

Prefix topik default `smartroom/node1` (bisa diubah di Pengaturan). Semua payload JSON UTF-8. Simpan kontrak ini di `src/core/mqttTopics.ts` dan `docs/MQTT.md`, karena firmware ESP32 harus mengikutinya.

| Topik | Arah | Retain | Payload |
|---|---|---|---|
| `…/status` | node → app | ya | `"online"` / `"offline"` (offline lewat LWT) |
| `…/telemetry` | node → app | tidak | `{"ts":1730000000,"temp":27.4,"hum":62,"ldr":2310,"presence":"terisi","dist_cm":120}` tiap 5 detik |
| `…/state` | node → app | ya | `{"mode":"auto","lamp":true,"fan":false,"occ_since":1730000000,"empty_for_s":0}` tiap berubah |
| `…/counters` | node → app | ya | `{"day":"2026-10-23","lamp_on_s":15120,"fan_on_s":23400,"occupied_s":28800}` tiap menit |
| `…/cmd/mode` | app → node | tidak | `{"mode":"auto"}` atau `{"mode":"manual"}` |
| `…/cmd/lamp` | app → node | tidak | `{"on":true}` (hanya dipakai node saat mode manual) |
| `…/cmd/fan` | app → node | tidak | `{"on":true}` (hanya saat mode manual) |
| `…/config` | app → node | ya | `{"fan_on_c":28,"fan_off_c":26,"empty_timeout_s":300,"dark_adc":1200,"lamp_rule":true,"fan_rule":true,"autooff_rule":true}` |

Catatan perilaku yang harus dipatuhi aplikasi:

- Aplikasi **tidak pernah** mengubah state lampu atau kipas secara lokal lalu menganggapnya benar. Kirim perintah, tunggu `…/state` dari node, baru UI berubah. Beri batas tunggu 3 detik.
- Mode `auto`: node yang memutuskan, tombol manual di aplikasi nonaktif. Mode `manual`: node menuruti `cmd/lamp` dan `cmd/fan`. Node kembali ke `auto` jika aplikasi mengirimnya.
- `status=offline` berarti node mati atau terputus dari broker. Tampilkan banner, bekukan nilai terakhir dengan stempel waktu, dan nonaktifkan semua kontrol.
- Aplikasi terputus dari broker adalah hal berbeda dari node offline. Pisahkan keduanya di UI ("Broker tidak terjangkau" vs "Node offline").

## Fitur (hanya ini)

### 1. Beranda
- Kartu ringkasan ruang: nama ruang, `StatusPill` Online/Offline, tiga metrik: **suhu**, **kelembapan**, **status kehadiran** (Terisi / Mungkin Kosong / Kosong dengan lama sejak berubah).
- Tile sensor: kehadiran (LD2410C, jarak jika ada) dan cahaya (persen terkalibrasi + label Terang/Redup/Gelap).
- Tile aktuator: Lampu dan Kipas, masing-masing toggle (aktif hanya saat mode manual), status, dan "Daya nominal".
- "Ringkasan Hari Ini": jam lampu nyala, jam kipas nyala, **estimasi hemat** (Rp dan %), dengan label "estimasi".
- Tombol pintas ke Statistik dan ke status broker.

### 2. Kontrol
- Segmented **Auto Pilot / Manual**. Mengirim `cmd/mode`.
- Kartu Lampu dan kartu Kipas, masing-masing hanya toggle ON/OFF. Nonaktif saat Auto.
- "Logika Sensor Aktif": tampilkan aturan yang sedang berlaku dan apakah kondisinya terpenuhi sekarang (dihitung dari telemetry terakhir), misalnya "Ada orang DAN gelap → lampu MENYALA" dan "Suhu 27,4°C, kipas menyala di ≥ 28°C".
- Hitung mundur auto-off: "Kosong 03:20 dari 05:00" memakai `empty_for_s` dan `empty_timeout_s`.
- Tombol "Mati Semua" (kirim mode manual + lamp off + fan off, dengan konfirmasi satu ketukan).

### 3. Otomasi
Hanya tiga aturan nyata, sesuai firmware. Setiap aturan punya switch aktif dan parameter yang bisa diubah, lalu dikirim sebagai `…/config` (retain).

1. **Presence + ruangan gelap → lampu.** Parameter: ambang gelap (nilai ADC, dengan tombol "Kalibrasi" lihat bagian Pengaturan).
2. **Hysteresis suhu → kipas.** Default ON ≥ 28°C, OFF ≤ 26°C. Validasi: ON harus lebih besar dari OFF minimal 1°C.
3. **Auto-off saat kosong.** Default 5 menit, rentang 1 sampai 15 menit.

Tampilkan penjelasan satu kalimat per aturan. Tidak ada jadwal, preset, atau "buat aturan baru".

### 4. Statistik
- Rentang: 24 Jam / 7 Hari / 30 Hari.
- Grafik garis suhu dan kelembapan (dari telemetry yang disimpan di HP).
- Grafik batang durasi lampu dan kipas menyala per blok waktu (dari `counters`).
- Kartu **Estimasi Hemat**: lihat rumus di bawah. Tampilkan angka, rumusnya satu baris, dan tulisan "Estimasi, bukan hasil pengukuran daya".
- Jangan menampilkan "kWh terukur". Energi = daya nominal × jam nyala.

### 5. Pengaturan
- Koneksi broker: host/IP laptop, port WebSocket (default 9001), prefix topik, tombol "Uji koneksi", status.
- **Mode Demo** (switch). Saat broker tidak terjangkau 10 detik pada peluncuran pertama, tawarkan Mode Demo.
- Perangkat: daya nominal lampu (W) dan kipas (W), tarif listrik (Rp/kWh, default 1.444,70), jam pemakaian harian tanpa otomasi sebagai pembanding (default 12 jam untuk lampu, 12 jam untuk kipas).
- **Kalibrasi LDR:** dua tombol, "Ambil nilai saat terang" dan "Ambil nilai saat gelap", menyimpan dua nilai ADC. Persen cahaya = interpolasi linear di antara keduanya. Ambang gelap pada aturan 1 diisi dari kalibrasi.
- Tema: Sistem / Gelap / Terang.
- Notifikasi lokal (switch): "Node offline > 1 menit", "Suhu > 32°C", "Ruangan kosong tapi beban masih nyala > 10 menit".
- Tentang: versi aplikasi, nama kelompok.

## Rumus estimasi hemat (harus transparan)

```
beban_nyala_kWh   = (lamp_on_s/3600 × W_lampu + fan_on_s/3600 × W_kipas) / 1000
baseline_kWh      = (jam_pembanding_lampu × W_lampu + jam_pembanding_kipas × W_kipas) / 1000   # per hari, dari Pengaturan
hemat_kWh         = max(0, baseline_kWh − beban_nyala_kWh)
hemat_rupiah      = hemat_kWh × tarif
hemat_persen      = hemat_kWh / baseline_kWh × 100
```

Baseline adalah asumsi pengguna ("kalau dinyalakan manual sebanyak ini jam"), jadi selalu diberi label **estimasi**. Format rupiah: `Rp 3.850` (titik ribuan, tanpa desimal), pakai `Intl.NumberFormat('id-ID')` atau util sendiri yang diuji.

## Mode Demo (DemoSimulator)

Implementasikan di belakang antarmuka yang sama dengan klien MQTT nyata (`IMqttService`), sehingga UI tidak tahu mana yang dipakai. Simulator membuat telemetry yang masuk akal: suhu naik turun 25 sampai 31°C, status kehadiran berganti Terisi → Mungkin Kosong → Kosong, lampu dan kipas mengikuti tiga aturan di atas, `counters` bertambah. Tampilkan banner "Mode demo, data bukan dari perangkat" di semua layar saat aktif. Ini dipakai untuk presentasi kalau hardware belum siap.

## Teknologi

- Expo (SDK terbaru yang stabil) + TypeScript strict, `expo-router` untuk navigasi (tab di dalam `(tabs)`).
- State: `zustand` (satu store untuk koneksi/state perangkat, satu untuk pengaturan).
- MQTT: `mqtt` (mqtt.js) lewat WebSocket. Reconnect otomatis dengan backoff, `clean: true`, subscribe ulang setelah sambung.
- Penyimpanan: `expo-sqlite` untuk riwayat telemetry dan counters (simpan maksimal 30 hari, pangkas saat aplikasi dibuka), `AsyncStorage` untuk pengaturan.
- UI: `expo-blur`, `expo-linear-gradient`, `react-native-svg`, `react-native-gifted-charts` (atau `victory-native`, pilih satu), `expo-haptics`, `expo-notifications` (lokal saja), `@expo-google-fonts/space-grotesk`, `work-sans`, `inter`.
- Tidak ada backend sendiri, tidak ada Firebase, tidak ada akun.

## Struktur folder

```
smart-room/
├─ app/                       # expo-router
│  ├─ _layout.tsx
│  └─ (tabs)/ index.tsx · kontrol.tsx · otomasi.tsx · statistik.tsx · pengaturan.tsx
├─ src/
│  ├─ core/        theme/ (tokens.ts, ThemeProvider.tsx) · mqttTopics.ts · format.ts (rupiah, durasi, tanggal)
│  ├─ data/        mqtt/ (IMqttService.ts, RealMqttService.ts, DemoSimulator.ts) · db.ts · repository.ts
│  ├─ domain/      savings.ts · ruleEvaluator.ts · ldr.ts       # fungsi murni, wajib diuji
│  ├─ store/       deviceStore.ts · settingsStore.ts
│  ├─ components/  GlassCard · MetricTile · StatusPill · DeviceTile · GlassSwitch · SegmentedPill · FloatingNavBar · ChartCard · SectionTitle · Banner
│  └─ features/    home/ · control/ · automation/ · statistics/ · settings/
├─ docs/           MQTT.md · mosquitto.conf · WIRING.md (ringkas dari proposal)
├─ DESIGN.md · TASKS.md
└─ __tests__/      savings.test.ts · ruleEvaluator.test.ts · ldr.test.ts · format.test.ts
```

## Aturan kerja

1. Baca `DESIGN.md` dulu. Terapkan token, tema gelap dan terang, dan komponen kaca persis seperti di sana. Cocokkan tata letak dengan `screen.png`, kecuali bagian yang dicoret di bagian "TIDAK ada".
2. Kerjakan berurutan sesuai `TASKS.md`. Setelah tiap fase, jalankan aplikasi (Expo Go atau emulator Android) dan pastikan tidak ada error TypeScript atau peringatan baru sebelum lanjut.
3. Semua teks tampilan dalam bahasa Indonesia. Kalimat pendek dan jelas. Tidak ada teks pemasaran dan tidak ada emoji.
4. Fungsi di `src/domain/` murni (tanpa React, tanpa I/O) dan ditulis lebih dulu dengan tes unit: rumus hemat, pemetaan LDR ke persen dan label, evaluasi "apakah kondisi aturan terpenuhi sekarang", validasi hysteresis.
5. Tangani kondisi tidak normal secara eksplisit: broker putus, node offline, telemetry basi (> 15 detik), nilai sensor `null` atau NaN (tampilkan "—"), payload JSON rusak (abaikan dan catat).
6. Jangan menambah dependensi di luar daftar tanpa alasan tertulis di PR/commit.
7. Jangan menulis angka contoh dari mock-up ke dalam kode produksi. Data contoh hanya ada di `DemoSimulator` dan tes.
8. Di akhir, tulis `README.md`: cara menjalankan, cara menyalakan Mosquitto dengan WebSocket, cara mengganti IP broker, cara memakai Mode Demo, dan daftar batasan yang diketahui.

## Kriteria selesai

- Dengan Mode Demo: kelima layar berfungsi, grafik terisi, toggle manual bekerja, banner demo tampil.
- Dengan Mosquitto + publisher uji (`mosquitto_pub`) memakai topik di atas: telemetry dan state muncul di Beranda, `cmd/mode` dan `cmd/lamp` terkirim dengan payload yang benar, LWT `offline` memunculkan banner dan menonaktifkan kontrol.
- Mematikan broker memunculkan "Broker tidak terjangkau" dan aplikasi menyambung ulang sendiri saat broker hidup lagi.
- Semua tes unit di `src/domain/` lulus. `tsc --noEmit` bersih.
- Tema gelap dan terang sama-sama terbaca di layar kecil (360 dp) dan tidak ada teks terpotong.
