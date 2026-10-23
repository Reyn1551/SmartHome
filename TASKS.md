# TASKS: Aplikasi Smart Room (React Native)

Kerjakan berurutan. Setiap fase ditutup dengan pemeriksaan di bagian akhirnya. Rujukan: `PROMPT.md` (fitur, kontrak MQTT, rumus) dan `DESIGN.md` (tampilan).

## Fase 0. Persiapan
- [x] Buat proyek Expo TypeScript, aktifkan `strict`, pasang `expo-router`.
- [x] Pasang dependensi dari daftar di `PROMPT.md` bagian Teknologi. Tidak lebih.
- [x] Buat struktur folder seperti di `PROMPT.md`.
- [x] Muat font (Space Grotesk, Work Sans, Inter) dan tahan splash sampai siap.
- **Cek:** aplikasi kosong jalan di Expo Go atau emulator tanpa peringatan.

## Fase 1. Tema dan komponen
- [x] `tokens.ts` dan `ThemeProvider` dari `DESIGN.md` (gelap, terang, ikut sistem, bisa diganti manual).
- [x] Komponen: `GlassCard`, `MetricTile`, `StatusPill`, `GlassSwitch`, `SegmentedPill`, `SectionTitle`, `Banner`, `DeviceTile`, `ChartCard`, `FloatingNavBar`.
- [x] Layar uji `/galeri` yang menampilkan semua komponen di dua tema (hapus atau sembunyikan sebelum selesai).
- **Cek:** kontras teks terbaca di dua tema, `BlurView` tidak menimbulkan kotak abu di Android.

## Fase 2. Domain murni dan tes
- [x] `ldr.ts`: kalibrasi dua titik → persen, label Terang/Redup/Gelap, tangani nilai di luar rentang dan kalibrasi terbalik.
- [x] `ruleEvaluator.ts`: dari telemetry + config, hitung apakah tiap aturan terpenuhi dan hasilnya (lampu, kipas, hitung mundur auto-off). Sertakan hysteresis dengan state sebelumnya.
- [x] `savings.ts`: rumus di `PROMPT.md`. Tes: baseline 0, beban di atas baseline (hemat tidak negatif), tarif berubah.
- [x] `format.ts`: rupiah `Rp 3.850`, durasi "4,2 jam" dan "03:20", tanggal Indonesia.
- **Cek:** `npm test` hijau.

## Fase 3. Data dan MQTT
- [x] `mqttTopics.ts` dan `docs/MQTT.md` sesuai kontrak.
- [x] `IMqttService` + `RealMqttService` (mqtt.js lewat WebSocket, reconnect backoff, subscribe ulang, pisahkan status "broker" dan "node").
- [x] `DemoSimulator` dengan antarmuka yang sama, telemetry masuk akal, mengikuti tiga aturan.
- [x] `db.ts` (SQLite): tabel `telemetry(ts, temp, hum, ldr, presence)` dan `counters(day, lamp_on_s, fan_on_s, occupied_s)`. Pangkas data > 30 hari.
- [x] `deviceStore` dan `settingsStore`, penyimpanan pengaturan di AsyncStorage.
- [x] Tandai telemetry basi (> 15 detik) dan payload rusak diabaikan.
- **Cek:** dengan Mosquitto lokal dan `mosquitto_pub`, nilai muncul di store. Mematikan broker mengubah status dan menyambung ulang sendiri.

## Fase 4. Layar Beranda dan Kontrol
- [x] Navigasi tab melayang (5 tab) dan header bersama.
- [x] Beranda: ringkasan ruang, tile sensor, tile aktuator, ringkasan hari ini.
- [x] Kontrol: Auto/Manual, kartu lampu dan kipas (ON/OFF saja), logika sensor aktif, hitung mundur auto-off, "Mati Semua".
- [x] Perintah menunggu konfirmasi `…/state` (batas 3 detik), kembalikan toggle jika gagal.
- [x] Kontrol nonaktif saat Auto dan saat node offline. Banner offline dan demo.
- **Cek:** semua kondisi tampil benar di Mode Demo, termasuk kosong, mungkin kosong, dan node offline.

## Fase 5. Otomasi dan Pengaturan
- [x] Otomasi: tiga aturan, switch dan parameter, validasi hysteresis, kirim `…/config` retain.
- [x] Pengaturan: broker + "Uji koneksi", Mode Demo, daya nominal, tarif, jam pembanding, tema, notifikasi.
- [x] Kalibrasi LDR dengan dua tombol dan pratinjau persen langsung.
- [x] Notifikasi lokal: node offline > 1 menit, suhu > 32°C, kosong tapi beban nyala > 10 menit.
- **Cek:** mengubah ambang di Otomasi menghasilkan payload `config` yang benar (lihat dengan `mosquitto_sub`).

## Fase 6. Statistik
- [x] Rentang 24 Jam / 7 Hari / 30 Hari dari SQLite.
- [x] Grafik garis suhu dan kelembapan, grafik batang durasi lampu dan kipas.
- [x] Kartu Estimasi Hemat dengan rumus satu baris dan label "Estimasi".
- [x] Keadaan kosong: bila belum ada data, tampilkan penjelasan, bukan grafik kosong.
- **Cek:** angka hemat cocok dengan hitungan tangan untuk satu hari contoh.

## Fase 7. Penyelesaian
- [x] Tinjau semua layar di 360 dp dan di tablet, dua tema. (360 dp diverifikasi di dua tema; tablet belum diuji.)
- [x] Hapus layar `/galeri` dan angka contoh yang tertinggal di kode produksi.
- [x] `README.md` (cara menjalankan, Mosquitto WebSocket, ganti IP broker, Mode Demo, batasan).
- [x] `docs/WIRING.md` ringkas: pin ESP32 (LD2410C GPIO16/17, DHT22 GPIO4, LDR GPIO34, relay GPIO26 lampu dan GPIO25 kipas).
- [ ] Build APK uji (`eas build -p android --profile preview` atau `expo run:android`). Belum dijalankan: lingkungan ini tidak punya Android SDK/emulator. Bundel Android sudah diverifikasi lewat `expo export --platform android`.
- **Cek akhir:** kriteria selesai di `PROMPT.md` terpenuhi satu per satu, `tsc --noEmit` bersih, tes lulus.
  Status: 5 kriteria diverifikasi (Mode Demo, broker uji/LWT, reconnect, tes+tsc, 360 dp dua tema). Build APK dan uji tablet belum dijalankan.

## Di luar lingkup (jangan dikerjakan)
Dimmer dan suhu warna, kecepatan kipas, lux sungguhan, pengukur daya sungguhan, jadwal dan preset, akun dan PIN, sinkronisasi cloud, notifikasi push dari server, dukungan banyak ruang.
