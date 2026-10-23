# Smart Room

Aplikasi pendamping node IoT Smart Room (ESP32) untuk memantau suhu,
kelembapan, kehadiran, dan cahaya, mengubah mode kontrol, serta menampilkan
estimasi penghematan listrik.

Aplikasi ini **bukan otak sistem**. Aturan lampu dan kipas berjalan di ESP32,
jadi sistem tetap bekerja saat HP atau internet mati. Aplikasi hanya membaca
data lewat MQTT dan mengirim perintah.

Proyek mata kuliah KAPITA Kelompok 4. Android lebih dulu, tanpa akun, tanpa
backend sendiri.

## Isi repositori

```
app/                 Rute expo-router (5 tab)
src/core/            Tema, token, kontrak topik MQTT, format
src/data/            Klien MQTT nyata, DemoSimulator, SQLite, notifikasi
src/domain/          Fungsi murni: savings, ruleEvaluator, ldr (diuji)
src/store/           Zustand: deviceStore, settingsStore, runtime provider
src/components/      Komponen bersama: kartu, switch, pil status, navigasi
src/features/        Layar: home, control, automation, statistics, settings
docs/                MQTT.md, mosquitto.conf, WIRING.md, TESTING.md, DEPENDENCIES.md, screens/
tools/mock-node.mjs  Node ESP32 tiruan untuk pengujian tanpa hardware
__tests__/           Tes unit domain, format, dan simulator
```

## Menjalankan aplikasi

Prasyarat: Node.js 20+, npm, dan salah satu dari Expo Go / emulator Android.
Karena memakai `expo-notifications`, development build lebih dianjurkan.

```bash
npm install
npm start
```

Untuk pengujian tanpa hardware, dua terminal lain:

```bash
npm run broker   # broker MQTT lokal: TCP 1883 dan WebSocket 9001
npm run mock     # node ESP32 tiruan
```

Lalu pilih:

- tekan `a` untuk emulator Android (butuh development build, lihat bawah),
- atau pindai QR dengan Expo Go di HP Android (satu jaringan dengan laptop).

Pemeriksaan:

```bash
npm run typecheck   # tsc --noEmit
npm test            # tes unit domain + simulator
npm run lint        # eslint
```

Catatan: `expo-notifications` memerlukan development build untuk perilaku
lengkap di Android (Expo Go membatasi modul native). Proyek sudah memuat
`expo-dev-client`. Untuk build uji:

```bash
npx expo run:android
# atau
eas build -p android --profile preview
```

## Menyalakan Mosquitto dengan WebSocket

Pasang Mosquitto di laptop, lalu jalankan konfigurasi contoh:

```bash
mosquitto -c docs/mosquitto.conf -v
```

Konfigurasi berisi dua listener:

- `1883` untuk ESP32 dan `mosquitto_pub/sub`,
- `9001` dengan `protocol websockets` untuk aplikasi.

Aplikasi memakai `ws://<host>:9001/mqtt`. `allow_anonymous true` hanya untuk
jaringan lab/demo; jangan dipakai di jaringan publik.

Uji cepat dari laptop:

```bash
mosquitto_sub -h 127.0.0.1 -p 1883 -t 'smartroom/node1/#' -v
mosquitto_pub -h 127.0.0.1 -p 1883 -t smartroom/node1/status -m 'online' -r
```

Kontrak lengkap ada di `docs/MQTT.md`. Contoh payload telemetry:

```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -t smartroom/node1/telemetry \
  -m '{"ts":1730000000,"temp":27.4,"hum":62,"ldr":2310,"presence":"terisi","dist_cm":120}'
```

## Mengganti IP broker

1. Buka tab **Pengaturan**.
2. Isi **Host / IP laptop** (contoh `192.168.1.10`), **Port WebSocket** `9001`,
   dan **Prefix topik** bila berbeda dari `smartroom/node1`.
3. Tekan **Uji koneksi** untuk memastikan broker terjangkau.
4. Tekan **Simpan & sambung**. Aplikasi menyambung ulang otomatis dengan
   backoff 2 detik dan subscribe ulang setelah tersambung.

Aplikasi memakai `ws://` (bukan `mqtt://`) karena React Native tidak bisa
membuka TCP mentah. Agar Android mengizinkan HTTP/WebSocket tanpa TLS ke
jaringan lokal, proyek memakai plugin `plugins/withCleartextTraffic.js`
(`android:usesCleartextTraffic="true"`). Untuk produksi, gunakan `wss://`.

## Mode Demo

Aktifkan **Mode Demo** di Pengaturan bila hardware atau broker belum siap.
Semua layar memakai `DemoSimulator` di belakang antarmuka `IMqttService` yang
sama dengan klien MQTT nyata:

- suhu berayun 25–31°C, kelembapan 48–78%,
- kehadiran berganti Terisi → Mungkin Kosong → Kosong,
- lampu dan kipas mengikuti tiga aturan firmware,
- counters bertambah tiap tick,
- layar Statistik memakai riwayat contoh yang dihitung (bukan angka tetap),
- banner "Mode demo, data bukan dari perangkat" tampil di semua layar.

Saat broker tidak terjangkau pada peluncuran pertama, aplikasi menampilkan
banner "Broker tidak terjangkau"; buka Pengaturan untuk menyalakan Mode Demo.
Data demo tidak ditulis ke SQLite.

## Node tiruan untuk pengujian

`tools/mock-node.mjs` menyambung ke broker lewat TCP dan berperilaku seperti
firmware: mempublikasikan telemetry/state/counters dan menuruti
`cmd/mode`, `cmd/lamp`, `cmd/fan`, serta `config`.

```bash
node tools/mock-node.mjs 127.0.0.1 1883 smartroom/node1
```

Lihat perintah yang dikirim aplikasi:

```bash
mosquitto_sub -h 127.0.0.1 -p 1883 -t 'smartroom/node1/cmd/#' -v
```

## Rumus estimasi hemat

```
beban_nyala_kWh = (lamp_on_s/3600 × W_lampu + fan_on_s/3600 × W_kipas) / 1000
baseline_kWh    = (jam_pembanding_lampu × W_lampu + jam_pembanding_kipas × W_kipas) / 1000
hemat_kWh       = max(0, baseline_kWh − beban_nyala_kWh)
hemat_rupiah    = hemat_kWh × tarif
hemat_persen    = hemat_kWh / baseline_kWh × 100
```

Daya lampu/kipas adalah **daya nominal** yang diisi pengguna, bukan hasil
pengukuran. Baseline adalah asumsi pemakaian tanpa otomasi. Semua angka di
kartu hemat diberi label "estimasi". Rupiah memakai format `Rp 3.850`
(titik ribuan, tanpa desimal).

## Pengujian otomatis

```bash
npm test            # 64 tes: domain, format, parser MQTT, counter, simulator, settings, alert
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

Untuk pengujian integrasi manual, nyalakan Mosquitto lalu jalankan
`tools/mock-node.mjs`; lihat bagian Node tiruan di atas.

Catatan pengujian integrasi ada di `docs/TESTING.md`.

## Catatan tampilan

- Palet memakai satu warna aksi per layar. Semua pasangan teks/permukaan
  diuji kontras minimal 4.5:1 oleh `__tests__/themeContrast.test.ts`.
- Kartu memakai permukaan solid, bukan blur bertumpuk, agar ringan di HP
  kelas menengah dan teks tetap tajam.
- Switch berukuran tetap 48×28 dp di kedua tema, dengan track abu saat mati
  dan warna aksi saat hidup.
- Animasi memakai Reanimated dan menghormati pengaturan kurangi gerakan.
- Tab yang tidak aktif dibekukan (`freezeOnBlur`) agar grafik dan timer tidak
  memakai CPU di belakang layar.

## Batasan yang diketahui

- Hanya satu perangkat dan satu ruangan. Tidak ada akun, cloud, atau multi-room.
- Relay hanya ON/OFF. Tidak ada dimmer, suhu warna, atau level kipas.
- LDR menghasilkan ADC 0–4095 dan persen terkalibrasi, bukan lux. Tidak ada
  sensor BH1750.
- Tidak ada pengukur daya. Energi dihitung dari daya nominal × jam nyala.
- Counter dari firmware adalah total per hari, jadi grafik 24 jam hanya
  memuat hari ini; rentang 7/30 hari memakai satu blok per hari.
- Riwayat telemetry disimpan maksimal 30 hari di HP dan dipangkas saat aplikasi
  dibuka.
- Notifikasi lokal hanya dievaluasi saat aplikasi aktif; tidak ada push dari
  server.
- Mode demo memakai data simulasi dan tidak boleh dipakai untuk klaim
  penghematan nyata.
- APK release yang dipakai untuk pengujian dibangun lokal lewat
  `android/gradlew assembleRelease`; berkasnya tidak disimpan di repositori.
  Untuk mesin lain jalankan `npx expo prebuild --platform android` lebih dulu.
- Web export hanya untuk pratinjau tata letak; SQLite di web memakai
  penyimpanan memori, bukan database persisten.
- Broker tanpa TLS (`ws://`) hanya untuk lab. Jangan pakai di jaringan publik.

## Lisensi dan kredit

Proyek KAPITA Kelompok 4. Desain mengikuti `DESIGN.md` dan lima gambar acuan
Stitch di `docs/screens/`. Komponen pihak ketiga mengikuti lisensi
masing-masing (Expo, mqtt.js, zustand, gifted-charts).
