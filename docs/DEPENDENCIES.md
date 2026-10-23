# Catatan dependensi

Daftar ini menjelaskan setiap dependensi tambahan di luar daftar minimum pada
`PROMPT.md`, agar aturan "jangan menambah dependensi tanpa alasan tertulis"
terpenuhi.

| Paket | Alasan |
|---|---|
| `expo-dev-client` | Notifikasi lokal dan modul native lain membutuhkan development build; Expo Go membatasi API native. |
| `expo-constants` | Membaca versi aplikasi untuk bagian Tentang. Sudah menjadi peer `expo-router`. |
| `expo-system-ui` | Peer `expo-router` untuk warna latar sistem di Android. |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets` | Peer wajib `expo-router` dan animasi `GlassSwitch`. |
| `@expo/vector-icons` | Ikon antarmuka; bagian dari ekosistem Expo. |
| `mqtt` | Klien MQTT over WebSocket sesuai kontrak. |
| `zustand` | State management sesuai instruksi. |
| `react-native-gifted-charts`, `react-native-svg` | Grafik garis dan batang di Statistik. |
| `expo-sqlite`, `@react-native-async-storage/async-storage` | Riwayat telemetry/counters dan penyimpanan pengaturan. |
| `expo-blur`, `expo-linear-gradient` | Terpasang dari desain awal; tidak lagi dipakai setelah permukaan kartu dibuat solid. Boleh dihapus pada pembersihan dependensi berikutnya. |
| `expo-haptics` | Umpan balik haptic pada switch dan navigasi. |
| `expo-notifications` | Notifikasi lokal. |
| `@expo-google-fonts/*` | Dua keluarga font: Space Grotesk untuk judul dan angka, Inter untuk teks. |

## Dev dependencies

| Paket | Alasan |
|---|---|
| `jest`, `jest-expo`, `@types/jest` | Tes unit. |
| `eslint`, `eslint-config-expo` | Lint standar Expo. |
| `aedes`, `aedes-cli`, `ws`, `@types/ws` | Broker MQTT lokal untuk pengujian integrasi; tidak dipakai di aplikasi. |
| `typescript` | Type checking. |
