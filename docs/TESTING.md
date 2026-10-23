# Catatan pengujian

## Otomatis

```bash
npm test
npm run typecheck
npm run lint
```

Tes mencakup:

- `savings.test.ts`: rumus hemat, baseline 0, beban di atas baseline, tarif berubah.
- `ldr.test.ts`: interpolasi dua titik, kalibrasi terbalik, nilai di luar rentang,
  label Terang/Redup/Gelap, ambang dari titik tengah.
- `ruleEvaluator.test.ts`: aturan lampu, hysteresis kipas, auto-off, validasi.
- `format.test.ts`: rupiah, durasi, tanggal, angka format Indonesia.
- `mqttTopics.test.ts`: prefix, klasifikasi topik, parser payload rusak.
- `db.test.ts`: agregasi counters.
- `demoSimulator.test.ts`: bentuk payload, mode manual, hysteresis, counters.
- `settings.test.ts`: sanitasi pengaturan dari penyimpanan.
- `alerts.test.ts`: ambang notifikasi lokal (offline, suhu, beban saat kosong).
- `themeContrast.test.ts`: kontras teks, tombol, switch, dan garis grafik di
  kedua tema, minimal 4.5:1 untuk teks dan 3:1 untuk elemen grafis.

## Integrasi manual dengan Mosquitto

1. Jalankan broker: `mosquitto -c docs/mosquitto.conf -v`.
2. Jalankan node tiruan: `node tools/mock-node.mjs 127.0.0.1 1883 smartroom/node1`.
3. Buka aplikasi, isi host `127.0.0.1`, port `9001`, prefix `smartroom/node1`.
4. Periksa:
   - Beranda menampilkan suhu, kelembapan, kehadiran, jarak, counters.
   - Kontrol: Auto/Manual mengirim `cmd/mode`; toggle hanya aktif di Manual.
   - Otomasi: ubah ambang → `config` retain terkirim.
   - Matikan node tiruan → LWT `offline` → banner Node offline, kontrol nonaktif.
   - Matikan broker → banner "Broker tidak terjangkau"; hidupkan lagi →
     aplikasi menyambung ulang sendiri.

Lihat perintah yang dikirim aplikasi:

```bash
mosquitto_sub -h 127.0.0.1 -p 1883 -t 'smartroom/node1/cmd/#' -v
mosquitto_sub -h 127.0.0.1 -p 1883 -t 'smartroom/node1/config' -v
```

## Batasan pengujian di lingkungan ini

- Emulator Android tidak tersedia di lingkungan pengembangan ini; verifikasi
  tata letak dilakukan lewat export web pada viewport 360×800 dan dua tema.
  `docs/screens/` menyimpan lima gambar acuan Stitch dengan nama `screen.png`.
- `expo export --platform android` memastikan bundel Android dapat dibangun,
  tetapi bukan pengganti uji di perangkat.
- Notifikasi lokal tidak dapat diverifikasi di web; kode dijaga agar tidak
  memanggil API notifikasi di web.
