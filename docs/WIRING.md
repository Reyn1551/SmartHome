# Wiring ringkas ESP32

Ringkasan dari proposal KAPITA Kelompok 4. Ini bukan skema kelistrikan lengkap;
ikuti modul dan catatan tegangan masing-masing komponen.

## Peta pin

| Komponen | Pin komponen | Pin ESP32 | Catatan |
|---|---|---|---|
| LD2410C | VCC | 3V3 / 5V sesuai modul | Modul umumnya 5 V; cek datasheet modul |
| LD2410C | GND | GND | |
| LD2410C | TX | GPIO16 (RX2) | UART2, 256000 baud default |
| LD2410C | RX | GPIO17 (TX2) | Level 3,3 V |
| DHT22 | VCC | 3V3 | Pull-up 10 kΩ ke VCC pada DATA |
| DHT22 | DATA | GPIO4 | |
| DHT22 | GND | GND | |
| LDR (KY-018) | VCC | 3V3 | Modul sudah punya resistor pembagi |
| LDR (KY-018) | AO | GPIO34 | ADC1, input-only |
| LDR (KY-018) | GND | GND | |
| Relay IN1 (lampu) | IN | GPIO26 | Aktif LOW umumnya; sesuaikan modul |
| Relay IN2 (kipas) | IN | GPIO25 | Aktif LOW umumnya |
| Relay | VCC | 5 V | Kumparan relay butuh 5 V |
| Relay | GND | GND | |

## Beban

- Lampu LED dan kipas DC 5 V dihubungkan lewat kontak relay.
- Relay hanya ON/OFF. Tidak ada dimmer, PWM, atau pengukuran daya.
- Jika kipas DC 5 V memakai arus lebih dari kapasitas kontak relay, gunakan
  modul relay yang sesuai atau tambahkan transistor/MOSFET. Jangan memberi
  beban induktif langsung tanpa dioda flyback.

## Konvensi LDR

Modul LDR dipasang dengan LDR ke VCC dan resistor ke GND. Artinya:

- ruangan terang → ADC tinggi,
- ruangan gelap → ADC rendah.

Aturan lampu menganggap gelap bila `ldr <= dark_adc`. Kalibrasi di aplikasi
mengambil dua titik (terang dan gelap) lalu memakai titik tengah sebagai
`dark_adc`. Jika modul dipasang terbalik, kalibrasi tetap bekerja karena
aplikasi menerima urutan nilai yang terbalik.

## Daya

- ESP32 dan sensor dari adaptor 5 V terpisah atau USB.
- Relay module dan beban sebaiknya memakai catu 5 V yang mampu menyuplai arus
  kipas. Jangan mengambil arus kipas dari pin 3V3 ESP32.
- Tidak ada sensor arus/daya. Angka watt di aplikasi adalah daya nominal yang
  diisi pengguna di Pengaturan.

## Uji tanpa hardware

Gunakan `tools/mock-node.mjs` untuk mensimulasikan node lewat MQTT/TCP:

```bash
node tools/mock-node.mjs 192.168.1.10 1883 smartroom/node1
```

Skrip ini mempublikasikan telemetry/state/counters sesuai kontrak dan menuruti
`cmd/mode`, `cmd/lamp`, `cmd/fan`, serta `config`.
