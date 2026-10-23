// Plugin konfigurasi Expo: izinkan HTTP/WebSocket tanpa TLS ke broker lab.
// Diperlukan karena MQTT over WebSocket memakai ws:// ke laptop di jaringan
// lokal. Untuk produksi, gunakan wss:// dan hapus plugin ini.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });
};
