# Kontrak MQTT Smart Room

Dokumen ini adalah acuan bersama aplikasi React Native dan firmware ESP32.
Perubahan pada nama topik atau bentuk payload harus diubah di tiga tempat:
`src/core/mqttTopics.ts`, dokumen ini, dan firmware.

## Koneksi

| Peran | Protokol | Port default |
|---|---|---|
| ESP32 | MQTT/TCP | 1883 |
| Aplikasi RN | MQTT over WebSocket | 9001, path `/mqtt` |
| Node-RED/Grafana/Telegram | terserah pembaca | 1883 |

Aplikasi tidak bisa memakai MQTT/TCP langsung dari React Native, jadi memakai
WebSocket: `ws://<host-laptop>:9001/mqtt`. Broker Mosquitto harus punya listener
websockets; lihat `docs/mosquitto.conf`.

Prefix topik default: `smartroom/node1`. Prefix bisa diubah di Pengaturan.
Semua payload berupa JSON UTF-8, kecuali `status` yang berupa string.

## Topik

| Topik | Arah | Retain | Payload |
|---|---|---|---|
| `<prefix>/status` | node → app | ya | `"online"` / `"offline"` (offline lewat LWT) |
| `<prefix>/telemetry` | node → app | tidak | `{"ts":1730000000,"temp":27.4,"hum":62,"ldr":2310,"presence":"terisi","dist_cm":120}` tiap 5 detik |
| `<prefix>/state` | node → app | ya | `{"mode":"auto","lamp":true,"fan":false,"occ_since":1730000000,"empty_for_s":0}` tiap berubah |
| `<prefix>/counters` | node → app | ya | `{"day":"2026-10-23","lamp_on_s":15120,"fan_on_s":23400,"occupied_s":28800}` tiap menit |
| `<prefix>/cmd/mode` | app → node | tidak | `{"mode":"auto"}` atau `{"mode":"manual"}` |
| `<prefix>/cmd/lamp` | app → node | tidak | `{"on":true}` (dipakai node hanya saat mode manual) |
| `<prefix>/cmd/fan` | app → node | tidak | `{"on":true}` (dipakai node hanya saat mode manual) |
| `<prefix>/config` | app → node | ya | `{"fan_on_c":28,"fan_off_c":26,"empty_timeout_s":300,"dark_adc":1200,"lamp_rule":true,"fan_rule":true,"autooff_rule":true}` |

### Catatan field

- `ts` dalam detik Unix (bukan milidetik).
- `presence` hanya `terisi`, `mungkin_kosong`, atau `kosong`.
- `temp` °C dan `hum` %RH dari DHT22; boleh `null` bila sensor gagal.
- `ldr` nilai ADC mentah 0–4095 (bukan lux). Konvensi modul KY-018: nilai
  naik saat terang, turun saat gelap.
- `dist_cm` opsional dari LD2410C; boleh `null` atau tidak dikirim.
- `occ_since` detik Unix saat kehadiran berubah menjadi `terisi`; `null` bila
  tidak ada orang.
- `empty_for_s` sudah dihitung node, bukan aplikasi.
- `counters` adalah total sejak awal hari, bukan delta. Aplikasi menyimpan
  satu baris per `day`.
- `lamp` dan `fan` hanya boolean. Tidak ada dimmer, level kipas, atau warna.

## Perilaku yang wajib dipatuhi aplikasi

1. Aplikasi tidak pernah mengubah state lampu/kipas secara lokal. Perintah
   dikirim ke `cmd/*`, UI menunggu `state` dari node. Batas tunggu 3 detik;
   bila lewat, toggle kembali dan muncul banner.
2. Mode `auto`: node memutuskan. Saklar manual di aplikasi nonaktif.
3. Mode `manual`: node menuruti `cmd/lamp` dan `cmd/fan`.
4. `status=offline` (LWT) berarti node mati/terputus. UI menampilkan banner,
   membekukan nilai terakhir dengan stempel waktu, dan menonaktifkan kontrol.
5. Broker terputus berbeda dari node offline. UI menampilkan
   "Broker tidak terjangkau" dan menyambung ulang otomatis (backoff 2 detik,
   `clean: true`, subscribe ulang setelah sambung).
6. Telemetry lebih lama dari 15 detik dianggap basi dan ditandai di UI.
7. Payload JSON rusak diabaikan dan dicatat; aplikasi tidak crash.

## Contoh pengujian dengan mosquitto_pub

```bash
# Status online
mosquitto_pub -h 127.0.0.1 -p 1883 -t smartroom/node1/status -m 'online' -r

# Telemetry
mosquitto_pub -h 127.0.0.1 -p 1883 -t smartroom/node1/telemetry \
  -m '{"ts":1730000000,"temp":27.4,"hum":62,"ldr":2310,"presence":"terisi","dist_cm":120}'

# State
mosquitto_pub -h 127.0.0.1 -p 1883 -t smartroom/node1/state \
  -m '{"mode":"auto","lamp":true,"fan":false,"occ_since":1730000000,"empty_for_s":0}' -r

# Counters
mosquitto_pub -h 127.0.0.1 -p 1883 -t smartroom/node1/counters \
  -m '{"day":"2026-10-23","lamp_on_s":15120,"fan_on_s":23400,"occupied_s":28800}' -r

# Lihat perintah dari aplikasi
mosquitto_sub -h 127.0.0.1 -p 1883 -t 'smartroom/node1/cmd/#' -v

# Lihat config retain
mosquitto_sub -h 127.0.0.1 -p 1883 -t 'smartroom/node1/config' -v
```

## LWT (Last Will and Testament) di firmware

Firmware harus mendaftarkan will saat connect:

```cpp
client.will.setTopic("smartroom/node1/status");
client.will.setPayload("offline");
client.will.setQos(1);
client.will.setRetain(true);
```

Saat node hidup, firmware mempublikasikan `online` dengan retain. Saat koneksi
terputus tanpa DISCONNECT, broker mengirim `offline` otomatis.

## Topik yang tidak dipakai

Tidak ada topik untuk jadwal, preset, akun, atau cloud. Jangan menambah topik
di luar tabel di atas tanpa memperbarui firmware dan dokumen ini.
